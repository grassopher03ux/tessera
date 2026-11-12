"""
puzzles.py — modulo Puzzle di Chess Review.

Cosa fa:
  • ESTRAZIONE — dopo "Analizza partita" prende i TUOI blunder (classificazione
                 'blunder' nella tabella moves) e ne fa dei puzzle. Non usa il
                 motore: tutto arriva dall'analisi già salvata (profondità 18).
  • ARCHIVIO   — massimo `puzzle_max` puzzle (default 100). Quando ne arrivano
                 di nuovi, escono i più vecchi per data di creazione.
  • PUZZLE     — si parte dalla posizione PRIMA della mossa dell'avversario;
                 la sua mossa viene giocata, poi si mostra il tuo blunder e tu
                 cerchi la mossa migliore. Il puzzle dura MAX_STEPS tue mosse:
                 dopo ognuna giusta Stockfish risponde con la sua migliore.
  • CONTROLLO  — ogni mossa è controllata live con Stockfish: è giusta se è la
                 migliore oppure perde al massimo `puzzle_tolerance` punti di
                 probabilità di vittoria rispetto alla migliore.
  • HINT       — due livelli, gestiti dal client; il server dà solo la mossa.

Tutto è salvato in SQLite (stesso DB delle partite). L'accuratezza delle partite
NON viene mai modificata dai puzzle: qui si tengono statistiche separate.
"""
from __future__ import annotations

import math
import re
import threading
import time

import chess
import chess.engine
from flask import jsonify, request

MAX_STEPS = 3             # quante mosse tue per puzzle
MIN_WIN_BEFORE = 30.0     # sotto questa % di vittoria la posizione era già persa: niente puzzle
MAX_WIN_AFTER = 85.0      # sopra questa % dopo il blunder eri ancora nettamente meglio
WIN_EPS = 0.05            # "100%" = matto forzato

_ctx = {}
_cache = {}               # (fen, profondità, multipv) -> linee del motore
_cache_lock = threading.Lock()
_CACHE_MAX = 600


# ═══════════════════════════════════════════════════════════════════════
#  Utilità
# ═══════════════════════════════════════════════════════════════════════

def _db():
    return _ctx['get_db']()


def _cfg():
    return _ctx['config']


def _max() -> int:
    try:
        return max(1, int(_cfg().get('puzzle_max', 100)))
    except (TypeError, ValueError):
        return 100


def _depth() -> int:
    try:
        return max(6, int(_cfg().get('puzzle_depth', 14)))
    except (TypeError, ValueError):
        return 14


def _tolerance() -> float:
    try:
        return max(0.0, float(_cfg().get('puzzle_tolerance', 3)))
    except (TypeError, ValueError):
        return 3.0


def _now() -> str:
    return time.strftime('%Y-%m-%dT%H:%M:%S')


def _names() -> set:
    """I tuoi account (gli stessi di Aperture e Statistiche), in minuscolo."""
    out = []
    try:
        import repertoire
        out = repertoire.usernames()
    except Exception:                                        # noqa: BLE001
        raw = _cfg().get('chesscom_username') or ''
        out = [x for x in re.split(r'[,;\s]+', raw if isinstance(raw, str) else ' '.join(raw)) if x]
    return {n.lower() for n in out}


def win_pct(cp: float) -> float:
    """Probabilità di vittoria (0–100) da centipawn, come lichess."""
    cp = max(-1000, min(1000, cp))
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def _win_white_from_row(ev_type, ev_val, fen: str):
    """Valutazione salvata nel DB (lato Bianco) → % di vittoria del Bianco."""
    if ev_val is None:
        return None
    if ev_type == 'mate':
        if ev_val > 0:
            return 100.0
        if ev_val < 0:
            return 0.0
        # mate 0: chi ha il tratto è già matto
        return 0.0 if fen.split(' ')[1] == 'w' else 100.0
    return win_pct(ev_val)


def move_accuracy(drop: float) -> float:
    """Accuratezza di una mossa (formula lichess) dal calo di probabilità di vittoria."""
    raw = 103.1668100711649 * math.exp(-0.04354415386753951 * max(0.0, drop)) - 3.166924740191411
    return round(min(100.0, max(0.0, raw + 1)), 1)


# ═══════════════════════════════════════════════════════════════════════
#  Tabelle
# ═══════════════════════════════════════════════════════════════════════

def init_tables():
    with _db() as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS pz_puzzles (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id       INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
                ply           INTEGER NOT NULL,
                color         TEXT    NOT NULL,
                opponent      TEXT,
                game_date     TEXT,
                start_fen     TEXT,
                prev_uci      TEXT,
                prev_san      TEXT,
                fen           TEXT    NOT NULL,
                played_uci    TEXT    NOT NULL,
                played_san    TEXT    NOT NULL,
                best_uci      TEXT    NOT NULL,
                best_san      TEXT    NOT NULL,
                win_before    REAL,
                win_after     REAL,
                created_at    TEXT    NOT NULL,
                attempts      INTEGER NOT NULL DEFAULT 0,
                solved        INTEGER NOT NULL DEFAULT 0,
                last_result   TEXT,
                last_at       TEXT,
                UNIQUE (game_id, ply)
            );
            CREATE INDEX IF NOT EXISTS idx_pz_game ON pz_puzzles(game_id);
            CREATE TABLE IF NOT EXISTS pz_games (
                game_id      INTEGER PRIMARY KEY REFERENCES games(id) ON DELETE CASCADE,
                processed_at TEXT NOT NULL,
                n_puzzles    INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS pz_attempts (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                puzzle_id  INTEGER,
                ts         TEXT NOT NULL,
                solved     INTEGER NOT NULL,
                wrong      INTEGER NOT NULL DEFAULT 0,
                hints      INTEGER NOT NULL DEFAULT 0,
                hard       INTEGER NOT NULL DEFAULT 0
            );
        ''')


# ═══════════════════════════════════════════════════════════════════════
#  Estrazione dei puzzle dalle partite analizzate
# ═══════════════════════════════════════════════════════════════════════

def _user_color(game, names: set):
    if (game['white'] or '').lower() in names:
        return 'white'
    if (game['black'] or '').lower() in names:
        return 'black'
    return None


def extract_game(conn, game_id: int, names: set) -> list[dict]:
    """Puzzle possibili di una partita (non scrive nulla)."""
    game = conn.execute('SELECT * FROM games WHERE id=?', (game_id,)).fetchone()
    if not game:
        return []
    color = _user_color(game, names)
    if color is None:
        return []
    rows = conn.execute(
        'SELECT ply, fen, move_san, best_move_uci, eval_cp, eval_type, classification, '
        'top_moves_json FROM moves WHERE game_id=? ORDER BY ply', (game_id,)).fetchall()
    opponent = game['black'] if color == 'white' else game['white']
    out = []
    for i in range(1, len(rows)):
        r, prev = rows[i], rows[i - 1]
        if r['classification'] != 'blunder' or not r['move_san']:
            continue
        try:
            board = chess.Board(prev['fen'])
        except ValueError:
            continue
        mover = 'white' if board.turn == chess.WHITE else 'black'
        if mover != color:
            continue                                         # blunder dell'avversario

        wb_w = _win_white_from_row(prev['eval_type'], prev['eval_cp'], prev['fen'])
        wa_w = _win_white_from_row(r['eval_type'], r['eval_cp'], r['fen'])
        if wb_w is None or wa_w is None:
            continue
        wb = wb_w if color == 'white' else 100 - wb_w
        wa = wa_w if color == 'white' else 100 - wa_w
        if wb < MIN_WIN_BEFORE or wa >= MAX_WIN_AFTER:
            continue                                         # già perso / ancora vinto
        if prev['eval_type'] == 'mate' and r['eval_type'] == 'mate' and wb > 99.9 and wa > 99.9:
            continue                                         # solo "matto in 3 invece di 2"

        try:
            played = board.parse_san(r['move_san'])
        except ValueError:
            continue
        best_uci = prev['best_move_uci'] or ''
        if not best_uci:
            continue
        try:
            best = chess.Move.from_uci(best_uci)
        except ValueError:
            continue
        if best not in board.legal_moves or best == played:
            continue

        # la mossa dell'avversario (quella di partenza del puzzle)
        start_fen = prev_uci = prev_san = None
        if i >= 2 and prev['move_san']:
            try:
                b0 = chess.Board(rows[i - 2]['fen'])
                m0 = b0.parse_san(prev['move_san'])
                start_fen, prev_uci, prev_san = rows[i - 2]['fen'], m0.uci(), prev['move_san']
            except ValueError:
                start_fen = prev_uci = prev_san = None

        out.append({
            'game_id': game_id, 'ply': r['ply'], 'color': color, 'opponent': opponent,
            'game_date': game['date'], 'start_fen': start_fen, 'prev_uci': prev_uci,
            'prev_san': prev_san, 'fen': prev['fen'], 'played_uci': played.uci(),
            'played_san': r['move_san'], 'best_uci': best.uci(), 'best_san': board.san(best),
            'win_before': round(wb, 1), 'win_after': round(wa, 1),
        })
    return out


def _insert(conn, items: list[dict]) -> int:
    n = 0
    for it in items:
        cur = conn.execute('''
            INSERT OR IGNORE INTO pz_puzzles
              (game_id, ply, color, opponent, game_date, start_fen, prev_uci, prev_san, fen,
               played_uci, played_san, best_uci, best_san, win_before, win_after, created_at)
            VALUES (:game_id, :ply, :color, :opponent, :game_date, :start_fen, :prev_uci,
                    :prev_san, :fen, :played_uci, :played_san, :best_uci, :best_san,
                    :win_before, :win_after, :created_at)''', {**it, 'created_at': _now()})
        n += cur.rowcount
    return n


def _trim(conn):
    """Tiene al massimo `puzzle_max` puzzle: escono i più vecchi per creazione."""
    mx = _max()
    total = conn.execute('SELECT COUNT(*) FROM pz_puzzles').fetchone()[0]
    if total > mx:
        conn.execute('DELETE FROM pz_puzzles WHERE id IN '
                     '(SELECT id FROM pz_puzzles ORDER BY id ASC LIMIT ?)', (total - mx,))


def on_game_analyzed(game_id: int, force: bool = True) -> int:
    """Da chiamare dopo il salvataggio di un'analisi (server.save_game).
    Rifà i puzzle di quella partita (l'analisi può essere cambiata)."""
    names = _names()
    if not names:
        return 0
    with _db() as conn:
        if not force and conn.execute('SELECT 1 FROM pz_games WHERE game_id=?', (game_id,)).fetchone():
            return 0                                         # già elaborata: non toccare i progressi
        conn.execute('DELETE FROM pz_puzzles WHERE game_id=?', (game_id,))
        n = _insert(conn, extract_game(conn, game_id, names))
        conn.execute('INSERT OR REPLACE INTO pz_games (game_id, processed_at, n_puzzles) VALUES (?,?,?)',
                     (game_id, _now(), n))
        _trim(conn)
    return n


def backfill() -> dict:
    """Puzzle dalle partite già analizzate e mai elaborate. Le più vecchie per
    prime, così le più recenti restano le ultime ad uscire dall'archivio."""
    names = _names()
    if not names:
        return {'games': 0, 'puzzles': 0, 'reason': 'no_username'}
    games = puzzles = 0
    with _db() as conn:
        ids = [r['id'] for r in conn.execute('''
            SELECT g.id FROM games g
            WHERE NOT EXISTS (SELECT 1 FROM pz_games p WHERE p.game_id = g.id)
              AND EXISTS (SELECT 1 FROM moves m WHERE m.game_id = g.id)
            ORDER BY g.date ASC, g.id ASC''')]
        for gid in ids:
            n = _insert(conn, extract_game(conn, gid, names))
            conn.execute('INSERT OR REPLACE INTO pz_games (game_id, processed_at, n_puzzles) VALUES (?,?,?)',
                         (gid, _now(), n))
            games += 1
            puzzles += n
        _trim(conn)
    return {'games': games, 'puzzles': puzzles}


# ═══════════════════════════════════════════════════════════════════════
#  Lettura
# ═══════════════════════════════════════════════════════════════════════

_ORDER = 'ORDER BY game_date ASC, game_id ASC, ply ASC'   # percorso: dal più vecchio al più nuovo


def _payload(r) -> dict:
    d = {k: r[k] for k in r.keys()}
    wb, wa = d.get('win_before'), d.get('win_after')
    d['acc_played'] = move_accuracy(wb - wa) if wb is not None and wa is not None else None
    d['steps'] = MAX_STEPS
    d['solved'] = bool(d['solved'])
    return d


def _locks(conn) -> dict:
    """{id: (indice 1.., bloccato)}. Un puzzle è sbloccato solo se tutti i precedenti sono risolti."""
    out, ok = {}, True
    for i, r in enumerate(conn.execute(f'SELECT id, solved FROM pz_puzzles {_ORDER}'), start=1):
        out[r['id']] = (i, not ok)
        if not r['solved']:
            ok = False
    return out


def _ordered_ids(conn) -> list[int]:
    return [r['id'] for r in conn.execute(f'SELECT id FROM pz_puzzles {_ORDER}')]


# ═══════════════════════════════════════════════════════════════════════
#  Motore: controllo delle mosse
# ═══════════════════════════════════════════════════════════════════════

class EngineBusy(RuntimeError):
    pass


def _engine():
    eng = _ctx['get_engine']()
    if eng is None:
        raise RuntimeError('Stockfish non disponibile')
    return eng


def _win_white_from_score(pov) -> float:
    w = pov.white()
    if w.is_mate():
        return 100.0 if (w.mate() or 0) > 0 else 0.0
    return win_pct(w.score())


def _cache_get(key):
    with _cache_lock:
        return _cache.get(key)


def _cache_put(key, val):
    with _cache_lock:
        if len(_cache) >= _CACHE_MAX:
            _cache.pop(next(iter(_cache)))
        _cache[key] = val


def _analyse_top(fen: str, multipv: int = 3) -> list[dict]:
    """Prime `multipv` mosse del motore: [{'uci', 'win'}] con win = % del Bianco."""
    depth = _depth()
    key = ('top', fen, depth, multipv)
    hit = _cache_get(key)
    if hit is not None:
        return hit
    board = chess.Board(fen)
    eng = _engine()
    if not _ctx['engine_lock'].acquire(timeout=10):
        raise EngineBusy('Motore occupato')
    try:
        infos = eng.analyse(board, chess.engine.Limit(depth=depth), multipv=multipv)
    finally:
        _ctx['engine_lock'].release()
    if isinstance(infos, dict):
        infos = [infos]
    res = [{'uci': i['pv'][0].uci(), 'win': _win_white_from_score(i['score'])}
           for i in infos if i.get('pv')]
    _cache_put(key, res)
    return res


def _analyse_move(fen: str, move: chess.Move) -> float:
    """% di vittoria del Bianco dopo `move` (valutazione limitata a quella mossa)."""
    depth = _depth()
    key = ('mv', fen, depth, move.uci())
    hit = _cache_get(key)
    if hit is not None:
        return hit
    board = chess.Board(fen)
    eng = _engine()
    if not _ctx['engine_lock'].acquire(timeout=10):
        raise EngineBusy('Motore occupato')
    try:
        info = eng.analyse(board, chess.engine.Limit(depth=depth), root_moves=[move])
    finally:
        _ctx['engine_lock'].release()
    w = _win_white_from_score(info['score'])
    _cache_put(key, w)
    return w


def _parse_uci(board: chess.Board, uci: str):
    """Mossa UCI legale oppure None (aggiunge la promozione a donna se manca)."""
    try:
        mv = chess.Move.from_uci(uci)
    except ValueError:
        return None
    if mv not in board.legal_moves and len(uci) == 4:
        mv2 = chess.Move.from_uci(uci + 'q')
        if mv2 in board.legal_moves:
            return mv2
    return mv if mv in board.legal_moves else None


def check_move(fen: str, uci: str, step: int, known_best: str | None = None) -> dict:
    """Controlla una mossa dell'utente e, se è giusta, calcola la risposta del motore."""
    try:
        board = chess.Board(fen)
    except ValueError:
        return {'ok': False, 'error': 'FEN non valido'}
    mv = _parse_uci(board, uci)
    if mv is None:
        return {'ok': False, 'error': 'Mossa non legale'}
    mover_white = board.turn == chess.WHITE

    def pov(w):                                              # % del Bianco → % di chi muove
        return w if mover_white else 100 - w

    if known_best and mv.uci() == known_best:
        correct, loss = True, 0.0
    else:
        top = _analyse_top(fen, 3)
        if not top:
            return {'ok': False, 'error': 'Nessuna analisi disponibile'}
        best_w = pov(top[0]['win'])
        if mv.uci() == top[0]['uci']:
            correct, loss = True, 0.0
        else:
            hit = next((t for t in top if t['uci'] == mv.uci()), None)
            my_w = pov(hit['win'] if hit else _analyse_move(fen, mv))
            loss = max(0.0, best_w - my_w)
            correct = loss <= _tolerance()
            # se la migliore è un matto forzato, serve un matto anche a te
            if correct and best_w >= 100 - WIN_EPS and my_w < 100 - WIN_EPS:
                correct = False

    if not correct:
        return {'ok': True, 'correct': False, 'loss': round(loss, 1), 'arrows': warn_arrows(board)}

    san = board.san(mv)
    board.push(mv)
    res = {'ok': True, 'correct': True, 'san': san, 'loss': round(loss, 1),
           'finished': False, 'reason': None, 'reply': None, 'fen': board.fen()}
    if board.is_game_over():
        res.update(finished=True, reason='checkmate' if board.is_checkmate() else 'draw')
        return res
    if step >= MAX_STEPS:
        res.update(finished=True, reason='steps')
        return res

    top = _analyse_top(board.fen(), 1)
    if not top:
        res.update(finished=True, reason='steps')
        return res
    reply = chess.Move.from_uci(top[0]['uci'])
    rsan = board.san(reply)
    board.push(reply)
    res.update(reply={'uci': reply.uci(), 'san': rsan}, fen=board.fen())
    if board.is_game_over():
        res.update(finished=True, reason='checkmate' if board.is_checkmate() else 'draw')
    return res


# ═══════════════════════════════════════════════════════════════════════
#  Frecce di avviso (mostrate quando sbagli mossa)
# ═══════════════════════════════════════════════════════════════════════

_VAL = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}


def _hanging_captures(board: chess.Board, side: chess.Color) -> list[dict]:
    """Catture 'gratis' di `side`: il pezzo preso non è difeso, oppure vale più del pezzo che prende."""
    b = board.copy(stack=False)
    b.turn = side
    b.ep_square = None
    out = []
    for mv in b.legal_moves:
        if not b.is_capture(mv) or b.is_en_passant(mv):
            continue
        victim = b.piece_at(mv.to_square)
        mover = b.piece_at(mv.from_square)
        if not victim or not mover or victim.piece_type == chess.KING:
            continue
        v, a = _VAL[victim.piece_type], _VAL[mover.piece_type]
        b.push(mv)
        defended = b.is_attacked_by(not side, mv.to_square)
        b.pop()
        if (not defended and v >= 1) or (defended and v - a >= 2):
            out.append({'from': chess.square_name(mv.from_square), 'to': chess.square_name(mv.to_square),
                        'gain': v if not defended else v - a})
    out.sort(key=lambda x: -x['gain'])
    best = {}
    for o in out:                                            # una sola freccia per pezzo preso
        best.setdefault(o['to'], o)
    return list(best.values())


def warn_arrows(board: chess.Board) -> list[dict]:
    """Verde = cosa posso prendere gratis; arancio = cosa minaccia l'avversario (a cosa punta)."""
    me = board.turn
    arrows = [dict(a, kind='free') for a in _hanging_captures(board, me)[:3]]
    arrows += [dict(a, kind='threat') for a in _hanging_captures(board, not me)[:3]]
    for a in arrows:
        a.pop('gain', None)
    return arrows


# ═══════════════════════════════════════════════════════════════════════
#  Rotte
# ═══════════════════════════════════════════════════════════════════════

def register(app, ctx: dict):
    _ctx.update(ctx)
    init_tables()
    try:
        r = backfill()
        if r.get('puzzles'):
            print(f"[puzzle] {r['puzzles']} puzzle creati da {r['games']} partite già analizzate")
    except Exception as ex:                                  # noqa: BLE001
        print(f"[puzzle] riempimento iniziale non riuscito: {ex}")

    def engine_error(ex):
        code = 503
        return jsonify({'ok': False, 'error': str(ex)}), code

    @app.route('/api/puzzles/summary')
    def pz_summary():
        with _db() as conn:
            total = conn.execute('SELECT COUNT(*) FROM pz_puzzles').fetchone()[0]
            solved = conn.execute('SELECT COUNT(*) FROM pz_puzzles WHERE solved=1').fetchone()[0]
            nxt = conn.execute(f'SELECT * FROM pz_puzzles WHERE solved=0 {_ORDER} LIMIT 1').fetchone() \
                or conn.execute(f'SELECT * FROM pz_puzzles {_ORDER} LIMIT 1').fetchone()
            recent = [dict(r) for r in conn.execute('''
                SELECT game_id, opponent, game_date, color, COUNT(*) AS n, SUM(solved) AS solved
                FROM pz_puzzles GROUP BY game_id
                ORDER BY game_date DESC, game_id DESC LIMIT 3''')]
        return jsonify({'max': _max(), 'total': total, 'solved': solved, 'pending': total - solved,
                        'next': _payload(nxt) if nxt else None, 'recent': recent,
                        'steps': MAX_STEPS, 'engine': _ctx['get_engine']() is not None,
                        'has_username': bool(_names())})

    @app.route('/api/puzzles')
    def pz_list():
        with _db() as conn:
            rows = conn.execute(f'SELECT * FROM pz_puzzles {_ORDER}').fetchall()
            locks = _locks(conn)
        items = []
        for r in rows:
            d = _payload(r)
            d['idx'], d['locked'] = locks[r['id']]
            items.append(d)
        return jsonify({'max': _max(), 'puzzles': items})

    @app.route('/api/puzzles/<int:pid>')
    def pz_get(pid):
        with _db() as conn:
            r = conn.execute('SELECT * FROM pz_puzzles WHERE id=?', (pid,)).fetchone()
            lk = _locks(conn).get(pid)
        if not r:
            return jsonify({'error': 'Puzzle non trovato'}), 404
        if lk and lk[1]:
            return jsonify({'error': 'Puzzle ancora bloccato: risolvi quelli precedenti', 'locked': True}), 403
        d = _payload(r)
        d['idx'], d['locked'] = lk or (0, False)
        return jsonify(d)

    @app.route('/api/puzzles/next')
    def pz_next():
        """Il primo puzzle non risolto del percorso (l'unico sbloccato). done=True se sono tutti risolti."""
        with _db() as conn:
            if not conn.execute('SELECT 1 FROM pz_puzzles').fetchone():
                return jsonify({'puzzle': None, 'done': False, 'empty': True})
            r = conn.execute(f'SELECT * FROM pz_puzzles WHERE solved=0 {_ORDER} LIMIT 1').fetchone()
            if not r:
                return jsonify({'puzzle': None, 'done': True, 'empty': False})
            lk = _locks(conn).get(r['id'], (0, False))
        d = _payload(r)
        d['idx'], d['locked'] = lk
        return jsonify({'puzzle': d, 'done': False, 'empty': False})

    @app.route('/api/puzzles/<int:pid>/check', methods=['POST'])
    def pz_check(pid):
        data = request.json or {}
        fen, uci = data.get('fen', ''), data.get('move', '')
        try:
            step = max(1, min(MAX_STEPS, int(data.get('step', 1))))
        except (TypeError, ValueError):
            step = 1
        with _db() as conn:
            r = conn.execute('SELECT best_uci, fen FROM pz_puzzles WHERE id=?', (pid,)).fetchone()
        if not r:
            return jsonify({'ok': False, 'error': 'Puzzle non trovato'}), 404
        known = r['best_uci'] if step == 1 and fen == r['fen'] else None
        try:
            return jsonify(check_move(fen, uci, step, known))
        except (RuntimeError, chess.engine.EngineError) as ex:
            return engine_error(ex)

    @app.route('/api/puzzles/<int:pid>/hint', methods=['POST'])
    def pz_hint(pid):
        fen = (request.json or {}).get('fen', '')
        try:
            board = chess.Board(fen)
        except ValueError:
            return jsonify({'ok': False, 'error': 'FEN non valido'}), 400
        with _db() as conn:
            r = conn.execute('SELECT best_uci, fen FROM pz_puzzles WHERE id=?', (pid,)).fetchone()
        if not r:
            return jsonify({'ok': False, 'error': 'Puzzle non trovato'}), 404
        try:
            uci = r['best_uci'] if fen == r['fen'] else _analyse_top(fen, 1)[0]['uci']
        except (RuntimeError, IndexError, chess.engine.EngineError) as ex:
            return engine_error(ex)
        mv = chess.Move.from_uci(uci)
        if mv not in board.legal_moves:
            return jsonify({'ok': False, 'error': 'Nessun suggerimento'}), 409
        return jsonify({'ok': True, 'uci': uci, 'from': uci[:2], 'to': uci[2:4]})

    @app.route('/api/puzzles/<int:pid>/result', methods=['POST'])
    def pz_result(pid):
        d = request.json or {}
        solved = 1 if d.get('solved') else 0
        with _db() as conn:
            if not conn.execute('SELECT 1 FROM pz_puzzles WHERE id=?', (pid,)).fetchone():
                return jsonify({'ok': False, 'error': 'Puzzle non trovato'}), 404
            conn.execute('INSERT INTO pz_attempts (puzzle_id, ts, solved, wrong, hints, hard) '
                         'VALUES (?,?,?,?,?,?)',
                         (pid, _now(), solved, int(d.get('wrong') or 0), int(d.get('hints') or 0),
                          1 if d.get('hard') else 0))
            conn.execute('UPDATE pz_puzzles SET attempts=attempts+1, solved=MAX(solved, ?), '
                         'last_result=?, last_at=? WHERE id=?',
                         (solved, 'solved' if solved else 'failed', _now(), pid))
        return jsonify({'ok': True})

    @app.route('/api/puzzles/generate', methods=['POST'])
    def pz_generate():
        try:
            return jsonify({'ok': True, **backfill()})
        except Exception as ex:                              # noqa: BLE001
            return jsonify({'ok': False, 'error': str(ex)}), 500
