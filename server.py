import os
import sys
import json
import threading
import shutil
import atexit
import sqlite3
import hashlib
import io
import queue
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import chess
import chess.engine
import chess.pgn
import chess.polyglot

# ── Path resolution (works both as script and as PyInstaller .exe) ─────────
if getattr(sys, 'frozen', False):
    BUNDLE_DIR = Path(sys._MEIPASS)
    APP_DIR    = Path(sys.executable).parent
else:
    BUNDLE_DIR = Path(__file__).parent
    APP_DIR    = Path(__file__).parent

STATIC_DIR     = BUNDLE_DIR / 'static'
CONFIG_FILE    = APP_DIR / 'config.json'
OPENINGS_CACHE = APP_DIR / 'openings_cache.json'
DB_FILE        = APP_DIR / 'chess_reviewer.db'

# ── Flask setup ────────────────────────────────────────────────────────────
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder=str(STATIC_DIR))
# Solo richieste dalla stessa macchina (la pagina usa URL relativi, quindi
# CORS serve solo se apri l'interfaccia da un'altra porta in sviluppo).
CORS(app, origins=[r'http://localhost(:\d+)?', r'http://127\.0\.0\.1(:\d+)?'])

# ── Global state ───────────────────────────────────────────────────────────
engine       = None   # chess.engine.SimpleEngine instance
engine_lock  = threading.Lock()
engine_error = None
openings_db  = {}      # EPD -> {eco, name}   (solo posizioni con un nome)
book_positions = {}    # EPD → quante linee di teoria passano da lì (peso)
polyglot_reader = None # libro Polyglot opzionale (book.bin)
config       = {}

ANALYSIS_VERSION = 2   # bump quando cambia il formato dei risultati salvati

STOCKFISH_CANDIDATES = [
    shutil.which('stockfish') or '',
    r'C:\stockfish\stockfish.exe',
    r'C:\stockfish\stockfish-windows-x86-64-avx2.exe',
    r'C:\Program Files\Stockfish\stockfish.exe',
    str(APP_DIR / 'stockfish.exe'),
    str(APP_DIR / 'stockfish-windows-x86-64-avx2.exe'),
    str(APP_DIR / 'stockfish-windows-x86-64.exe'),      # versione compatibile (PC senza AVX2)
    'stockfish.exe',
]


# ── Config ─────────────────────────────────────────────────────────────────

def load_config():
    global config
    if CONFIG_FILE.exists():
        try:
            config = json.loads(CONFIG_FILE.read_text(encoding='utf-8'))
        except Exception:
            config = {}
    # Assicura default
    config.setdefault('depth', 16)
    config.setdefault('openai_model', 'gpt-4.1-mini')
    config.setdefault('review_multipv', 2)   # 2 linee in analisi completa → serve per "Grande"
    config.setdefault('host', '127.0.0.1')   # 0.0.0.0 solo se vuoi usarla da altri device


def save_config():
    try:
        CONFIG_FILE.write_text(json.dumps(config, indent=2, ensure_ascii=False),
                               encoding='utf-8')
    except Exception as ex:
        print(f"Impossibile salvare config: {ex}")


# ── Engine (python-chess) ──────────────────────────────────────────────────

# ── SQLite helpers ─────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    """Apre una connessione SQLite con WAL e foreign keys attivi."""
    conn = sqlite3.connect(str(DB_FILE), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    conn.execute('PRAGMA foreign_keys=ON')
    return conn


def init_db():
    """Crea le tabelle se non esistono."""
    with get_db() as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS games (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                pgn_hash   TEXT    NOT NULL UNIQUE,
                pgn_text   TEXT    NOT NULL,
                white      TEXT    NOT NULL DEFAULT '?',
                black      TEXT    NOT NULL DEFAULT '?',
                event      TEXT    NOT NULL DEFAULT '',
                date       TEXT    NOT NULL DEFAULT '',
                result     TEXT    NOT NULL DEFAULT '*',
                created_at TEXT    NOT NULL
                           DEFAULT (strftime(\'%Y-%m-%dT%H:%M:%S\',\'now\'))
            );
            CREATE TABLE IF NOT EXISTS moves (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id        INTEGER NOT NULL
                               REFERENCES games(id) ON DELETE CASCADE,
                ply            INTEGER NOT NULL,
                fen            TEXT    NOT NULL,
                move_san       TEXT,
                best_move_uci  TEXT,
                eval_cp        INTEGER,
                eval_type      TEXT    NOT NULL DEFAULT \'cp\',
                classification TEXT,
                cp_loss        INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_moves_game ON moves(game_id, ply);
        ''')
        # Migrazioni leggere (DB creati con versioni precedenti)
        game_cols = {r['name'] for r in conn.execute('PRAGMA table_info(games)')}
        if 'analysis_version' not in game_cols:
            conn.execute('ALTER TABLE games ADD COLUMN analysis_version INTEGER NOT NULL DEFAULT 1')
        move_cols = {r['name'] for r in conn.execute('PRAGMA table_info(moves)')}
        if 'top_moves_json' not in move_cols:
            conn.execute('ALTER TABLE moves ADD COLUMN top_moves_json TEXT')
    print(f"  DB: {DB_FILE}")


def normalize_pgn(pgn: str) -> str:
    """Normalizza il PGN collassando whitespace per un hash stabile."""
    return ' '.join(pgn.split())


def pgn_hash(pgn: str) -> str:
    return hashlib.sha256(normalize_pgn(pgn).encode('utf-8')).hexdigest()


def find_stockfish():
    sp = config.get('stockfish_path', '')
    if sp:
        resolved = sp if os.path.isabs(sp) else str(APP_DIR / sp)   # relativo = cartella dell'app
        if os.path.isfile(resolved):
            return resolved
        if os.path.isfile(sp):
            return os.path.abspath(sp)
    for path in STOCKFISH_CANDIDATES:
        if path and os.path.isfile(path):
            return path
    return None


def init_engine(path=None):
    """Avvia Stockfish. Se il file scelto non parte (es. versione AVX2 su un PC vecchio)
    prova gli altri candidati, compresa la versione compatibile accanto all'app."""
    if _start_engine(path or find_stockfish()):
        return True
    if path:
        return False
    first_error = engine_error
    tried = set()
    for cand in [config.get('stockfish_path', '')] + STOCKFISH_CANDIDATES:
        if cand and os.path.isfile(cand) and cand not in tried:
            tried.add(cand)
            if _start_engine(cand):
                return True
    globals()['engine_error'] = first_error or engine_error
    return False


def _start_engine(sf_path):
    global engine, engine_error

    if not sf_path:
        engine_error = "Stockfish non trovato. Specifica il percorso nelle impostazioni."
        print(engine_error)
        return False

    try:
        new_engine = chess.engine.SimpleEngine.popen_uci(sf_path)
        threads = 1
        new_engine.configure({"Threads": threads, "Hash": 512})

        # Chiudi il vecchio processo se esiste
        old = engine
        engine = new_engine
        engine_error = None
        if old:
            try:
                old.quit()
            except Exception:
                pass

        globals()['engine_path'] = sf_path
        print(f"Stockfish avviato: {sf_path}  (threads={threads}, hash=256MB)")
        return True
    except Exception as ex:
        engine_error = str(ex)
        print(f"Errore Stockfish: {ex}")
        return False


def _shutdown_engine():
    global engine
    if engine:
        try:
            engine.quit()
        except Exception:
            pass


atexit.register(_shutdown_engine)


# ── Helpers ────────────────────────────────────────────────────────────────

def score_to_dict(pov_score):
    """
    Converte un PovScore (già orientato verso il Bianco con .white())
    in {type, value} coerente col frontend.
    Matti: type='mate', value=N (positivo=Bianco vince).
    Centipawn: type='cp', value=N (positivo=vantaggio Bianco).
    """
    if pov_score.is_mate():
        return {'type': 'mate', 'value': pov_score.mate()}
    cp = pov_score.score()
    return {'type': 'cp', 'value': cp}


def pv_to_san(board, pv_moves, max_moves=6):
    """Converte una lista di chess.Move in stringa SAN."""
    b = board.copy()
    parts = []
    for mv in pv_moves[:max_moves]:
        try:
            parts.append(b.san(mv))
            b.push(mv)
        except Exception:
            break
    return ' '.join(parts)


# ── Openings ───────────────────────────────────────────────────────────────
#
# Due concetti distinti:
#   • NOME   → openings_db: solo le ~3.700 posizioni che hanno un nome (TSV lichess).
#   • TEORIA → book_positions: TUTTE le posizioni attraversate dalle linee dei TSV.
#     Es. 5.Ng3 nella Caro-Kann classica non ha un nome proprio, ma è teoria
#     perché sta sulla strada di "Classical Variation, Main Line".
# Opzionale: un libro Polyglot (book.bin accanto all'app o config 'polyglot_book')
# allarga la teoria oltre i TSV.

OPENINGS_CACHE_VERSION = 3


def epd_of(fen_or_board) -> str:
    """EPD normalizzato da python-chess (en passant solo se catturabile).
    chess.js scrive sempre la casa e.p. dopo una spinta doppia: per questo
    lo split grezzo della FEN non trovava quasi mai l'apertura."""
    board = fen_or_board if isinstance(fen_or_board, chess.Board) else chess.Board(fen_or_board)
    return board.epd()


def parse_openings_tsv(text: str, named: dict, book: dict):
    """Legge un TSV lichess (eco, name, pgn) e popola named/book."""
    lines = text.strip().split('\n')
    for line in lines[1:]:  # salta header
        parts = line.split('\t')
        if len(parts) < 3:
            continue
        eco, name, pgn_str = parts[0].strip(), parts[1].strip(), parts[2].strip()
        try:
            game = chess.pgn.read_game(io.StringIO(pgn_str))
            if game is None:
                continue
            board = game.board()
            for mv in game.mainline_moves():
                board.push(mv)
                e = board.epd()
                book[e] = book.get(e, 0) + 1
            named[board.epd()] = {'eco': eco, 'name': name}
        except Exception:
            pass


def _save_openings_cache(named, book):
    try:
        OPENINGS_CACHE.write_text(json.dumps({
            'version': OPENINGS_CACHE_VERSION,
            'named':   named,
            'book':    book,
        }, ensure_ascii=False), encoding='utf-8')
    except Exception as ex:
        print(f"Impossibile salvare cache aperture: {ex}")


def load_openings():
    global openings_db, book_positions
    named, book = {}, {}

    # 1. TSV locali (a.tsv … e.tsv)
    tsvs = [APP_DIR / f'{l}.tsv' for l in 'abcde']
    if any(p.exists() for p in tsvs):
        print("Caricamento aperture da TSV locali...")
        for p in tsvs:
            if p.exists():
                try:
                    parse_openings_tsv(p.read_text(encoding='utf-8'), named, book)
                except Exception as ex:
                    print(f"Errore lettura {p.name}: {ex}")
        if named:
            openings_db, book_positions = named, book
            _save_openings_cache(named, book)
            print(f"Aperture: {len(named)} nomi, {len(book)} posizioni di teoria (TSV)")
            return

    # 2. Cache JSON
    if OPENINGS_CACHE.exists():
        try:
            data = json.loads(OPENINGS_CACHE.read_text(encoding='utf-8'))
            if isinstance(data, dict) and data.get('version') == OPENINGS_CACHE_VERSION:
                openings_db    = data.get('named', {})
                book_positions = dict(data.get('book', {}))
                print(f"Aperture dalla cache: {len(openings_db)} nomi, "
                      f"{len(book_positions)} posizioni di teoria")
                return
            # vecchio formato {epd: {...}}: usalo solo come ripiego
            if isinstance(data, dict) and data and 'version' not in data:
                named = data
        except Exception:
            pass

    # 3. Download da GitHub (formato attuale: eco, name, pgn)
    print("Download database aperture da lichess...")
    try:
        import requests as req
        dl_named, dl_book = {}, {}
        for letter in 'abcde':
            url = (f'https://raw.githubusercontent.com/lichess-org/'
                   f'chess-openings/master/{letter}.tsv')
            try:
                r = req.get(url, timeout=15)
                r.raise_for_status()
                parse_openings_tsv(r.text, dl_named, dl_book)
            except Exception as ex:
                print(f"Errore {letter}.tsv: {ex}")
        if dl_named:
            openings_db, book_positions = dl_named, dl_book
            _save_openings_cache(dl_named, dl_book)
            print(f"Aperture scaricate: {len(dl_named)} nomi")
            return
    except ImportError:
        print("Modulo 'requests' non disponibile.")

    # 4. Ultimo ripiego: vecchia cache senza percorsi di teoria
    openings_db, book_positions = named, {k: 1 for k in named}


def load_polyglot():
    """Apre un libro Polyglot opzionale. Nessun errore se manca."""
    global polyglot_reader
    path = config.get('polyglot_book') or str(APP_DIR / 'book.bin')
    if not os.path.isfile(path):
        return
    try:
        polyglot_reader = chess.polyglot.open_reader(path)
        print(f"  Libro Polyglot: {path}")
    except Exception as ex:
        print(f"Libro Polyglot non valido ({path}): {ex}")


def is_book_move(board_before: chess.Board, move: chess.Move, board_after: chess.Board) -> bool:
    """Una mossa è di teoria se la posizione raggiunta è sulle linee TSV
    oppure se è una mossa del libro Polyglot nella posizione precedente."""
    if board_after.epd() in book_positions:
        return True
    if polyglot_reader is not None:
        try:
            return any(e.move == move for e in polyglot_reader.find_all(board_before))
        except Exception:
            return False
    return False


# ── Routes ─────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    resp = send_from_directory(str(STATIC_DIR), 'index.html')
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return resp


@app.route('/api/status')
def status():
    # Prova a caricare .env per leggere OPENAI_API_KEY
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv(APP_DIR / '.env', override=False)
    except ImportError:
        pass
    openai_key = bool(os.environ.get('OPENAI_API_KEY', '').strip())
    return jsonify({
        'engine':            engine is not None,
        'engine_error':      engine_error,
        'openings':          len(openings_db),
        'book_positions':    len(book_positions),
        'polyglot':          polyglot_reader is not None,
        'openai_key':        openai_key,
        'stockfish_path':    config.get('stockfish_path', ''),
        'depth':             config.get('depth', 16),
        'brilliant_enabled': bool(config.get('brilliant_enabled', False)),
        'openai_model':      config.get('openai_model', ''),
        'review_multipv':    config.get('review_multipv', 2),
        'insights_depth':    int(config.get('insights_depth', 12)),
    })


@app.route('/api/opening')
def get_opening():
    """Nome dell'apertura per una singola posizione (usato nelle varianti)."""
    fen = request.args.get('fen', '')
    try:
        epd = epd_of(fen)
    except Exception:
        return jsonify({})
    info = dict(openings_db.get(epd, {}))
    if info or epd in book_positions:
        info['book'] = True
    return jsonify(info)


@app.route('/api/book_moves', methods=['POST'])
def book_moves():
    """
    Riceve la sequenza di FEN della partita (indice 0 = posizione iniziale).
    Restituisce, per ogni posizione:
      book[i]      → la mossa che ha portato a i è teoria
      names[i]     → ultimo nome di apertura raggiunto fino a i (portato avanti)
      eco[i]       → codice ECO corrispondente
      named_at[i]  → indice della posizione in cui quel nome è stato raggiunto
    """
    data = request.json or {}
    fens = data.get('fens', [])
    book, names, ecos, named_at = [], [], [], []
    last_name, last_eco, last_idx = '', '', -1
    prev_board = None
    for i, fen in enumerate(fens):
        try:
            board = chess.Board(fen)
        except Exception:
            board = None
        in_book = False
        if board is not None and i > 0 and prev_board is not None:
            # ricava la mossa giocata confrontando le due posizioni
            target = board.epd()
            move = next((m for m in prev_board.legal_moves
                         if _push_epd(prev_board, m) == target), None)
            if move is not None:
                in_book = is_book_move(prev_board, move, board)
            else:
                in_book = target in book_positions
            info = openings_db.get(target)
            # named_at cambia solo quando cambia il nome: così "chi ha scelto
            # l'apertura" è la mossa che l'ha raggiunta per prima
            if info and info['name'] != last_name:
                last_name, last_eco, last_idx = info['name'], info['eco'], i
        book.append(in_book)
        names.append(last_name)
        ecos.append(last_eco)
        named_at.append(last_idx)
        prev_board = board
    return jsonify({'book': book, 'names': names, 'eco': ecos, 'named_at': named_at})


def _push_epd(board: chess.Board, move: chess.Move) -> str:
    board.push(move)
    try:
        return board.epd()
    finally:
        board.pop()


@app.route('/api/analyze', methods=['POST'])
def analyze():
    if not engine:
        return jsonify({'error': engine_error or 'Engine non disponibile'}), 503

    data    = request.json or {}
    fen     = data.get('fen', '')
    multipv = max(1, min(int(data.get('multipv', 3)), 5))
    if not fen:
        return jsonify({'error': 'FEN mancante'}), 400

    try:
        board = chess.Board(fen)
    except ValueError as ex:
        return jsonify({'error': f'FEN non valido: {ex}'}), 400

    depth = config.get('depth', 16)

    if not engine_lock.acquire(timeout=5):
        return jsonify({'error': 'Engine occupato'}), 503
    try:
        info_list = engine.analyse(
            board,
            chess.engine.Limit(depth=depth),
            multipv=multipv,
        )
    except Exception as ex:
        return jsonify({'error': str(ex)}), 500
    finally:
        engine_lock.release()

    # python-chess restituisce lista quando multipv > 1
    if isinstance(info_list, dict):
        info_list = [info_list]

    top_moves = []
    for info in info_list:
        pv = info.get('pv', [])
        if not pv:
            continue
        # Valutazione SEMPRE dal punto di vista del Bianco
        white_score = info['score'].white()
        ev = score_to_dict(white_score)
        top_moves.append({
            'Move':      pv[0].uci(),
            'Centipawn': ev['value'] if ev['type'] == 'cp'   else None,
            'Mate':      ev['value'] if ev['type'] == 'mate' else None,
            'PV_SAN':    pv_to_san(board, pv, 6),
        })

    evaluation = None
    if top_moves:
        t = top_moves[0]
        if t['Mate'] is not None:
            evaluation = {'type': 'mate', 'value': t['Mate']}
        else:
            evaluation = {'type': 'cp',   'value': t['Centipawn']}

    return jsonify({'evaluation': evaluation, 'top_moves': top_moves})


def _analyze_fen(eng, fen, depth, multipv):
    """Analizza una singola FEN con l'istanza di engine data."""
    try:
        board = chess.Board(fen)
        if board.is_game_over():
            # matto/stallo: niente da analizzare
            if board.is_checkmate():
                # mate 0 = chi ha il tratto è matto (il client lo sa dalla FEN)
                ev = {'type': 'mate', 'value': 0}
            else:
                ev = {'type': 'cp', 'value': 0}
            return {'evaluation': ev, 'top_moves': []}
        infos = eng.analyse(board, chess.engine.Limit(depth=depth),
                            multipv=multipv)
        if isinstance(infos, dict):
            infos = [infos]
        top_moves = []
        for info in infos:
            pv = info.get('pv', [])
            if not pv:
                continue
            ev = score_to_dict(info['score'].white())
            top_moves.append({
                'Move':      pv[0].uci(),
                'Centipawn': ev['value'] if ev['type'] == 'cp'   else None,
                'Mate':      ev['value'] if ev['type'] == 'mate' else None,
                'PV_SAN':    pv_to_san(board, pv, 4),
            })
        evaluation = score_to_dict(infos[0]['score'].white()) if infos else None
        return {'evaluation': evaluation, 'top_moves': top_moves}
    except Exception as ex:
        print(f"analyze_game error on fen {fen[:30]}: {ex}")
        return {'evaluation': None, 'top_moves': []}


@app.route('/api/analyze_game', methods=['POST'])
def analyze_game():
    """
    Analisi di tutte le posizioni della partita, in parallelo.
    Usa un pool di istanze Stockfish dedicate (config 'review_workers',
    default 4; Threads=1, Hash=256) separate dall'engine live.
    Usa multipv=2 (config 'review_multipv'): la seconda linea serve a capire
    se la mossa migliore era anche l'UNICA buona → classificazione "Grande".
    """
    if not engine:
        return jsonify({'error': engine_error or 'Engine non disponibile'}), 503

    data    = request.json or {}
    fens    = data.get('fens', [])
    depth   = config.get('depth', 16)
    multipv = max(1, min(int(config.get('review_multipv', 2)), 3))
    try:
        workers = int(config.get('review_workers', 4))
    except (TypeError, ValueError):
        workers = 4
    workers = max(1, min(workers, len(fens) or 1))

    sf_path = globals().get('engine_path') or find_stockfish()   # quello che parte davvero su questo PC
    if not sf_path:
        return jsonify({'error': 'Stockfish non trovato'}), 503

    pool = queue.Queue()
    instances = []
    try:
        for _ in range(workers):
            eng = chess.engine.SimpleEngine.popen_uci(sf_path)
            instances.append(eng)
            eng.configure({"Threads": 1, "Hash": 256})
            pool.put(eng)
    except Exception as ex:
        for eng in instances:
            try:
                eng.quit()
            except Exception:
                pass
        return jsonify({'error': f'Impossibile avviare il pool Stockfish: {ex}'}), 500

    total    = len(fens)
    done     = [0]
    done_lck = threading.Lock()
    last_pct = [-1]

    def work(fen):
        eng = pool.get()
        try:
            res = _analyze_fen(eng, fen, depth, multipv)
        finally:
            pool.put(eng)
        with done_lck:
            done[0] += 1
            pct = done[0] * 100 // total
            if pct != last_pct[0]:
                last_pct[0] = pct
                print(f"analyze_game: {pct}% ({done[0]}/{total})", flush=True)
        return res

    try:
        # map mantiene l'ordine dei risultati come quello delle FEN
        with ThreadPoolExecutor(max_workers=workers) as ex:
            results = list(ex.map(work, fens))
    finally:
        for eng in instances:
            try:
                eng.quit()
            except Exception:
                pass

    return jsonify({'results': results})


@app.route('/api/explain', methods=['POST'])
def explain():
    data           = request.json or {}
    fen            = data.get('fen', '')
    move_san       = data.get('move_san', '')
    eval_before    = data.get('eval_before', 'N/A')
    eval_after     = data.get('eval_after',  'N/A')
    classification = data.get('classification', 'N/A')
    best_move_san  = data.get('best_move_san', '')
    pv_san         = data.get('pv_san', '')
    lang           = data.get('lang', 'it')
    if lang not in ('it', 'en'):
        lang = 'it'

    # Importa modulo commento (nella stessa cartella)
    sys.path.insert(0, str(BUNDLE_DIR))
    try:
        from openai_comment import get_comment
    except ImportError as ex:
        print(f"openai_comment non trovato: {ex}")
        return jsonify({'explanation': ''}), 200

    comment = get_comment(
        APP_DIR, fen, move_san,
        eval_before, eval_after,
        classification, best_move_san, pv_san,
        lang=lang,
    )
    return jsonify({'explanation': comment})


@app.route('/api/explain-opening', methods=['POST'])
def explain_opening():
    data    = request.json or {}
    context = data.get('context', '').strip()
    lang    = data.get('lang', 'it')
    if lang not in ('it', 'en'):
        lang = 'it'
    if not context:
        return jsonify({'explanation': ''}), 200
    sys.path.insert(0, str(BUNDLE_DIR))
    try:
        from openai_comment import get_opening_explanation
    except ImportError as ex:
        print(f"openai_comment non trovato: {ex}")
        return jsonify({'explanation': ''}), 200
    explanation = get_opening_explanation(APP_DIR, context, lang=lang)
    return jsonify({'explanation': explanation})


# ── Games DB endpoints ────────────────────────────────────────────────────

@app.route('/api/check_game', methods=['POST'])
def check_game():
    """Cerca una partita nel DB tramite hash del PGN.
    Restituisce valutazioni + top moves salvati. 'current' = False significa
    analisi di una versione precedente (una sola linea): il client può
    mostrarla, ma "Analizza Partita" la rifà."""
    data     = request.json or {}
    pgn_text = data.get('pgn_text', '').strip()
    if not pgn_text:
        return jsonify({'found': False})

    h = pgn_hash(pgn_text)
    try:
        with get_db() as conn:
            game = conn.execute(
                'SELECT id, analysis_version FROM games WHERE pgn_hash=?', (h,)
            ).fetchone()
            if not game:
                return jsonify({'found': False})
            game_id = game['id']
            version = game['analysis_version'] or 1
            rows = conn.execute(
                'SELECT ply, eval_type, eval_cp, best_move_uci, classification, '
                'top_moves_json FROM moves WHERE game_id=? ORDER BY ply',
                (game_id,)
            ).fetchall()
    except Exception as ex:
        print(f"check_game error: {ex}")
        return jsonify({'found': False})

    if not rows:
        return jsonify({'found': False})

    results = []
    for row in rows:
        ev_type = row['eval_type']
        ev_cp   = row['eval_cp']
        best    = row['best_move_uci'] or ''
        evaluation = None if ev_cp is None else {'type': ev_type, 'value': ev_cp}

        top_moves = []
        if row['top_moves_json']:
            try:
                top_moves = json.loads(row['top_moves_json'])
            except Exception:
                top_moves = []
        if not top_moves and best and evaluation:
            top_moves = [{
                'Move':      best,
                'Centipawn': ev_cp if ev_type == 'cp'   else None,
                'Mate':      ev_cp if ev_type == 'mate' else None,
                'PV_SAN':    '',
            }]

        results.append({
            'evaluation':     evaluation,
            'top_moves':      top_moves,
            'classification': row['classification'],
        })

    return jsonify({
        'found':      True,
        'from_cache': True,
        'game_id':    game_id,
        'version':    version,
        'current':    version >= ANALYSIS_VERSION,
        'results':    results,
    })


@app.route('/api/save_game', methods=['POST'])
def save_game():
    """Salva partita e analisi nel DB.
    Se la partita c'è già con un'analisi di versione vecchia, le mosse
    vengono sostituite; se è già aggiornata non fa nulla."""
    _chess = chess

    data      = request.json or {}
    pgn_text  = data.get('pgn_text', '').strip()
    white     = data.get('white',  '?')
    black     = data.get('black',  '?')
    event     = data.get('event',  '')
    date      = data.get('date',   '')
    result    = data.get('result', '*')
    positions = data.get('positions', [])

    if not pgn_text or not positions:
        return jsonify({'ok': False, 'error': 'Dati mancanti'}), 400

    h = pgn_hash(pgn_text)

    def _num(ev_type, ev_val):
        """Converti eval in numero per calcolo cp_loss."""
        if ev_val is None:
            return None
        if ev_type == 'mate':
            return 10000 if ev_val > 0 else -10000
        return ev_val

    class _AlreadyCached(Exception):
        pass

    cached_hit = False
    try:
        try:
          with get_db() as conn:
            conn.execute(
                '''INSERT OR IGNORE INTO games
                   (pgn_hash, pgn_text, white, black, event, date, result)
                   VALUES (?,?,?,?,?,?,?)''',
                (h, pgn_text, white, black, event, date, result)
            )
            game_id = conn.execute(
                'SELECT id FROM games WHERE pgn_hash=?', (h,)
            ).fetchone()['id']

            version = conn.execute(
                'SELECT analysis_version FROM games WHERE id=?', (game_id,)
            ).fetchone()[0] or 1
            has_moves = conn.execute(
                'SELECT COUNT(*) FROM moves WHERE game_id=?', (game_id,)
            ).fetchone()[0] > 0
            if has_moves and version >= ANALYSIS_VERSION:
                cached_hit = True
                raise _AlreadyCached()
            if has_moves:
                conn.execute('DELETE FROM moves WHERE game_id=?', (game_id,))
            conn.execute('UPDATE games SET analysis_version=? WHERE id=?',
                         (ANALYSIS_VERSION, game_id))

            for i, pos in enumerate(positions):
                ply        = pos.get('ply', i)
                fen        = pos.get('fen', '')
                move_san   = pos.get('move_san')
                best_uci   = pos.get('best_move_uci', '')
                ev_type    = pos.get('eval_type', 'cp')
                ev_cp      = pos.get('eval_cp')
                cls        = pos.get('classification')
                top_json   = json.dumps(pos.get('top_moves') or [])

                cp_loss = None
                if ply > 0 and i > 0:
                    prev       = positions[i - 1]
                    prev_score = _num(prev.get('eval_type', 'cp'), prev.get('eval_cp'))
                    curr_score = _num(ev_type, ev_cp)
                    if prev_score is not None and curr_score is not None:
                        try:
                            board = _chess.Board(prev.get('fen', ''))
                            delta = (prev_score - curr_score) \
                                    if board.turn == _chess.WHITE \
                                    else (curr_score - prev_score)
                            cp_loss = max(0, delta)
                        except Exception:
                            pass

                conn.execute(
                    '''INSERT INTO moves
                       (game_id, ply, fen, move_san, best_move_uci,
                        eval_cp, eval_type, classification, cp_loss,
                        top_moves_json)
                       VALUES (?,?,?,?,?,?,?,?,?,?)''',
                    (game_id, ply, fen, move_san, best_uci,
                     ev_cp, ev_type, cls, cp_loss, top_json)
                )

        except _AlreadyCached:
            pass

        # Puzzle dai tuoi blunder di questa partita (idempotente, mai bloccante)
        try:
            import puzzles
            puzzles.on_game_analyzed(game_id, force=not cached_hit)
        except Exception as pex:
            print(f"puzzle error: {pex}")

        if cached_hit:
            return jsonify({'ok': True, 'game_id': game_id, 'cached': True})
        return jsonify({'ok': True, 'game_id': game_id})
    except Exception as ex:
        print(f"save_game error: {ex}")
        return jsonify({'ok': False, 'error': str(ex)}), 500


import math
import re as _re


def _win_white(ev_type, ev_cp, turn):
    """Probabilità di vittoria del Bianco (0-100) da una valutazione salvata (come l'app)."""
    if ev_cp is None:
        return None
    if ev_type == 'mate':
        if ev_cp > 0:
            return 100.0
        if ev_cp < 0:
            return 0.0
        return 0.0 if turn == 'w' else 100.0
    cp = max(-1000, min(1000, ev_cp))
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def _std(xs):
    m = sum(xs) / len(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs))


def _move_acc(before, after):
    drop = max(0.0, before - after)
    raw = 103.1668100711649 * math.exp(-0.04354415386753951 * drop) - 3.166924740191411
    return min(100.0, max(0.0, raw + 1))


def _game_accuracy(wins, movers):
    """Precisione per colore come lichess (stessa formula del client). wins[i] = win% Bianco dopo la ply i."""
    n = len(wins)
    if n < 3:
        return {'w': None, 'b': None}
    win_size = min(8, max(2, (n - 1) // 10))
    windows = [wins[:win_size] for _ in range(max(0, min(win_size, n) - 2))]
    for st in range(0, n - win_size + 1):
        windows.append(wins[st:st + win_size])
    weights = [min(12, max(0.5, _std(w))) for w in windows]
    per = {'w': [], 'b': []}
    for i in range(1, n):
        mover = movers[i - 1]
        b = wins[i - 1] if mover == 'w' else 100 - wins[i - 1]
        a = wins[i] if mover == 'w' else 100 - wins[i]
        per[mover].append((_move_acc(b, a), weights[i - 1] if i - 1 < len(weights) else 1))

    def combine(lst):
        if not lst:
            return None
        wsum = sum(w for _, w in lst)
        weighted = sum(a * w for a, w in lst) / wsum
        harmonic = len(lst) / sum(1 / max(a, 1) for a, _ in lst)
        return round((weighted + harmonic) / 2, 1)
    return {'w': combine(per['w']), 'b': combine(per['b'])}


def _pgn_header(pgn, name):
    m = _re.search(r'\[' + name + r' "([^"]*)"\]', pgn or '')
    return m.group(1) if m else ''


def _fmt_tc(tc):
    m = _re.match(r'^(\d+)(?:\+(\d+))?$', tc or '')
    if not m:
        return tc or ''
    base = int(m.group(1))
    head = str(base // 60) if base >= 60 and base % 60 == 0 else str(base) + 's'
    return head + '+' + (m.group(2) or '0')


@app.route('/api/games', methods=['GET'])
def list_games():
    """Elenco partite salvate, dalla più recente, con stato dell'analisi, precisione e momenti chiave."""
    try:
        import repertoire
        try:
            mine_names = [n.lower() for n in repertoire.usernames()]
        except Exception:
            mine_names = []
        with get_db() as conn:
            rows = conn.execute(
                '''SELECT id, white, black, event, date, result, created_at, pgn_text, analysis_version
                   FROM games ORDER BY created_at DESC'''
            ).fetchall()
            moves = {}
            for m in conn.execute(
                    'SELECT game_id, ply, fen, eval_cp, eval_type, classification FROM moves ORDER BY game_id, ply'):
                moves.setdefault(m['game_id'], []).append(m)
        out = []
        for r in rows:
            d = {k: r[k] for k in ('id', 'white', 'black', 'event', 'date', 'result', 'created_at')}
            pgn = r['pgn_text'] or ''
            d['time_control'] = _fmt_tc(_pgn_header(pgn, 'TimeControl'))
            d['opening'] = _pgn_header(pgn, 'Opening') or ''
            wl, bl = (r['white'] or '').lower(), (r['black'] or '').lower()
            mine = 'b' if (bl in mine_names and wl not in mine_names) else 'w'
            d['mine'] = mine
            ms = moves.get(r['id'], [])
            if not ms:
                d.update(analysis='none', accuracy=None, moments=None)
            else:
                d['analysis'] = 'ok' if (r['analysis_version'] or 1) >= ANALYSIS_VERSION else 'old'
                fens = [m['fen'] for m in ms]
                turns = [f.split(' ')[1] for f in fens]
                wins = []
                for i, m in enumerate(ms):
                    w = _win_white(m['eval_type'], m['eval_cp'], turns[i])
                    wins.append(w if w is not None else (wins[i - 1] if i else 50.0))
                movers = turns[:-1]
                acc = _game_accuracy(wins, movers)
                d['accuracy'] = acc[mine]
                notable = {'brilliant', 'great', 'inaccuracy', 'mistake', 'blunder'}
                cnt = 0
                for i in range(1, len(ms)):
                    if turns[i - 1] != mine:
                        continue
                    b = wins[i - 1] if mine == 'w' else 100 - wins[i - 1]
                    a = wins[i] if mine == 'w' else 100 - wins[i]
                    if ms[i]['classification'] in notable or (b - 50) * (a - 50) < 0:
                        cnt += 1
                d['moments'] = cnt
            out.append(d)
        return jsonify(out)
    except Exception as ex:
        print(f"list_games error: {ex}")
        return jsonify([])


@app.route('/api/games/<int:game_id>', methods=['DELETE'])
def delete_game(game_id):
    """Elimina partita e relative mosse (CASCADE)."""
    try:
        with get_db() as conn:
            conn.execute('DELETE FROM games WHERE id=?', (game_id,))
        return jsonify({'ok': True})
    except Exception as ex:
        print(f"delete_game error: {ex}")
        return jsonify({'ok': False, 'error': str(ex)}), 500


@app.route('/api/games/<int:game_id>/pgn', methods=['GET'])
def get_game_pgn(game_id):
    """Restituisce il PGN salvato per una partita."""
    try:
        with get_db() as conn:
            row = conn.execute(
                'SELECT pgn_text FROM games WHERE id=?', (game_id,)
            ).fetchone()
        if not row:
            return jsonify({'error': 'Partita non trovata'}), 404
        return jsonify({'pgn': row['pgn_text']})
    except Exception as ex:
        return jsonify({'error': str(ex)}), 500


# ── Coach chat — disabilitato in questa versione ───────────────────────────

@app.route('/api/chat', methods=['POST'])
def chat():
    return jsonify({
        'error': 'Coach temporaneamente disabilitato. '
                 'Verrà reintrodotto in una versione successiva.'
    }), 503


# ── Settings routes ────────────────────────────────────────────────────────

@app.route('/api/set_stockfish', methods=['POST'])
def set_stockfish():
    data = request.json or {}
    path = data.get('path', '').strip()
    resolved = path if os.path.isabs(path) else str(APP_DIR / path)
    if not os.path.isfile(resolved):
        return jsonify({'error': f'File non trovato: {resolved}'}), 400
    ok = init_engine(resolved)
    if ok:
        config['stockfish_path'] = resolved
        save_config()
        return jsonify({'success': True})
    return jsonify({'error': engine_error}), 500


# ── Entry point ────────────────────────────────────────────────────────────

def open_browser():
    import time, webbrowser
    time.sleep(1.5)
    webbrowser.open('http://localhost:5000')


def main():
    load_config()

    # Carica .env una volta sola all'avvio
    try:
        from dotenv import load_dotenv  # type: ignore
        loaded = load_dotenv(APP_DIR / '.env', override=False)
        if loaded:
            print("  .env caricato")
    except ImportError:
        pass

    init_db()
    load_polyglot()

    # Modulo Aperture (albero del repertorio, ripasso, controllo partite)
    import repertoire
    repertoire.register(app, {
        'get_db':      get_db,
        'config':      config,
        'save_config': save_config,
        'get_engine':  lambda: engine,
        'engine_lock': engine_lock,
        'get_book':    lambda: book_positions,
        'get_named':   lambda: openings_db,
        'static_dir':  STATIC_DIR,
        'app_dir':     APP_DIR,
        'bundle_dir':  BUNDLE_DIR,
    })

    # Statistiche del giocatore (analisi in blocco + tendenze nel tempo)
    import insights
    insights.register(app, {
        'get_db':      get_db,
        'config':      config,
        'save_config': save_config,
        'get_engine':  lambda: engine,
        'engine_lock': engine_lock,
        'get_book':    lambda: book_positions,
        'get_named':   lambda: openings_db,
    })

    # Puzzle dai tuoi blunder (tabelle, estrazione, controllo mosse)
    import puzzles
    puzzles.register(app, {
        'get_db':      get_db,
        'config':      config,
        'get_engine':  lambda: engine,
        'engine_lock': engine_lock,
    })

    print("=" * 50)
    print("  Tessera")
    print("=" * 50)
    print(f"  Cartella app:  {APP_DIR}")
    print(f"  Static:        {STATIC_DIR}")
    print(f"  Depth analisi: {config.get('depth', 16)}")
    print(f"  OpenAI:        {'OK' if os.environ.get('OPENAI_API_KEY') else 'no (senza .env)'}")
    print()

    threading.Thread(target=load_openings, daemon=True).start()
    threading.Thread(target=init_engine,   daemon=True).start()

    if getattr(sys, 'frozen', False):
        threading.Thread(target=open_browser, daemon=True).start()

    print("  Server in ascolto su http://localhost:5000")
    print("  Premi Ctrl+C per fermare.")
    print()

    host = config.get('host', '127.0.0.1')
    app.run(host=host, port=5000, debug=False, threaded=True)


@app.route('/<filename>')
def static_files(filename):
    resp = send_from_directory(str(STATIC_DIR), filename)
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return resp


if __name__ == '__main__':
    main()
