"""
insights.py — statistiche del giocatore nel tempo.

1. ANALISI IN BLOCCO: tutte le tue partite (chess.com importate + salvate
   nell'app) passano da Stockfish in sottofondo, una volta sola.
2. FATTI PER MOSSA: per ogni tua mossa si salvano fase, orologio, probabilità
   di vittoria persa, teoria sì/no e — soprattutto — il PERCHÉ degli errori:
     • hung           pezzo lasciato in presa (minaccia NUOVA creata dalla tua mossa)
     • missed_threat  minaccia dell'avversario che c'era già e che hai ignorato
     • thrown_win     da vinto (≥85%) a non più vinto (<70%)
     • allowed_<tema> tattica concessa all'avversario (forchetta, inchiodatura…)
   e le OCCASIONI TATTICHE: posizioni con una sola mossa vincente, trovata o no,
   con il tema (matto, forchetta, inchiodatura, infilata, scoperta, materiale,
   promozione).
3. AGGREGATI PER PARTITA: il client ci costruisce finestre temporali
   ("prima" / "ora") e tendenze.
"""
from __future__ import annotations

import io
import json
import math
import re
import threading
import time
from datetime import datetime, timedelta, timezone

import chess
import chess.engine
import chess.pgn
from flask import jsonify, request

ANALYSIS_VERSION = 1
_ctx = {}
_lock = threading.Lock()
_status = {'running': False, 'done': 0, 'total': 0, 'current': '', 'error': None,
           'stop': False, 'finished_at': None}

VAL = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0}
MOTIFS = ['mate', 'fork', 'pin', 'skewer', 'discovered', 'material', 'promotion', 'other']


def _db():
    return _ctx['get_db']()


# ═══════════════════════════════════════════════════════════════════════
#  Tabelle
# ═══════════════════════════════════════════════════════════════════════

def init_tables():
    with _db() as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS an_games (
                game_key      TEXT PRIMARY KEY,
                source        TEXT,
                url           TEXT,
                sort_key      TEXT,
                date          TEXT,
                color         TEXT,
                opponent      TEXT,
                time_class    TEXT,
                time_control  TEXT,
                user_elo      INTEGER,
                opp_elo       INTEGER,
                score         REAL,
                n_plies       INTEGER,
                opening       TEXT,
                eco           TEXT,
                accuracy      REAL,
                acc_opening   REAL,
                acc_middle    REAL,
                acc_end       REAL,
                acc15         REAL,
                time_trouble  INTEGER,
                agg_json      TEXT,
                version       INTEGER,
                analyzed_at   TEXT
            );
            CREATE TABLE IF NOT EXISTS an_moves (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                game_key    TEXT NOT NULL REFERENCES an_games(game_key) ON DELETE CASCADE,
                ply         INTEGER,
                fen         TEXT,
                san         TEXT,
                best_san    TEXT,
                phase       TEXT,
                win_before  REAL,
                win_after   REAL,
                loss        REAL,
                clock       REAL,
                clock_frac  REAL,
                cls         TEXT,
                tags        TEXT,
                opp_motif   TEXT,
                opp_found   INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_an_moves_game ON an_moves(game_key);
        ''')


# ═══════════════════════════════════════════════════════════════════════
#  Scacchi: valutazioni e riconoscimento dei temi
# ═══════════════════════════════════════════════════════════════════════

def win_white(score) -> float | None:
    """PovScore lato Bianco → probabilità di vittoria del Bianco (0–100, lichess)."""
    if score is None:
        return None
    if score.is_mate():
        m = score.mate()
        return 100.0 if m > 0 else 0.0
    cp = max(-1000, min(1000, score.score()))
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def see(board: chess.Board, square: int) -> int:
    """Materiale guadagnato dal lato al tratto catturando su `square` (≥0)."""
    target = board.piece_at(square)
    if target is None:
        return 0
    caps = [m for m in board.legal_moves if m.to_square == square]
    if not caps:
        return 0
    caps.sort(key=lambda m: VAL[board.piece_type_at(m.from_square)])
    m = caps[0]
    promo = VAL[chess.QUEEN] - 1 if m.promotion else 0
    board.push(m if not m.promotion else chess.Move(m.from_square, m.to_square, chess.QUEEN))
    gain = VAL[target.piece_type] + promo - see(board, square)
    board.pop()
    return max(0, gain)


def capture_gain(board: chess.Board, move: chess.Move) -> int:
    """Guadagno netto di una cattura, tenendo conto delle ricatture."""
    if not board.is_capture(move):
        return 0
    if board.is_en_passant(move):
        captured = 1
    else:
        captured = VAL[board.piece_type_at(move.to_square)]
    board.push(move)
    back = see(board, move.to_square)
    board.pop()
    return captured - back


def threat(board: chess.Board) -> int:
    """Cosa può vincere SUBITO il lato al tratto: 100 = matto in 1, altrimenti materiale."""
    best = 0
    for m in board.legal_moves:
        if board.is_capture(m):
            best = max(best, capture_gain(board, m))
        if board.gives_check(m):
            board.push(m)
            mate = board.is_checkmate()
            board.pop()
            if mate:
                return 100
    return best


def _ray_next(board: chess.Board, frm: int, through: int):
    """Primo pezzo oltre `through` sulla retta frm→through."""
    df = chess.square_file(through) - chess.square_file(frm)
    dr = chess.square_rank(through) - chess.square_rank(frm)
    step_f = (df > 0) - (df < 0)
    step_r = (dr > 0) - (dr < 0)
    f, r = chess.square_file(through) + step_f, chess.square_rank(through) + step_r
    while 0 <= f < 8 and 0 <= r < 8:
        sq = chess.square(f, r)
        p = board.piece_at(sq)
        if p:
            return sq, p
        f += step_f
        r += step_r
    return None, None


def motif_of(board: chess.Board, move: chess.Move, mate: bool = False) -> str:
    """Tema tattico di una mossa (giocata dal lato al tratto in `board`)."""
    if mate:
        return 'mate'
    mover = board.turn
    opp = not mover
    b = board.copy(stack=False)
    was_capture_gain = capture_gain(board, move) if board.is_capture(move) else 0
    # pezzi avversari attaccati PRIMA dalle altre linee (per la scoperta)
    before = {sq for s in b.pieces(chess.BISHOP, mover) | b.pieces(chess.ROOK, mover) | b.pieces(chess.QUEEN, mover)
              if s != move.from_square for sq in b.attacks(s)}
    b.push(move)
    to = move.to_square
    piece = b.piece_at(to)
    if piece is None:
        return 'other'

    # forchetta: il pezzo mosso attacca 2+ bersagli che valgono la pena
    targets = []
    for sq in b.attacks(to):
        p = b.piece_at(sq)
        if not p or p.color != opp or p.piece_type == chess.PAWN:
            continue
        if p.piece_type == chess.KING or VAL[p.piece_type] > VAL[piece.piece_type] or not b.attackers(opp, sq):
            targets.append(sq)
    if len(targets) >= 2:
        return 'fork'

    # inchiodatura / infilata del pezzo mosso (solo pezzi a lungo raggio)
    if piece.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN):
        for sq in b.attacks(to):
            p = b.piece_at(sq)
            if not p or p.color != opp:
                continue
            bsq, q = _ray_next(b, to, sq)
            if q is None or q.color != opp:
                continue
            if q.piece_type == chess.KING or VAL[q.piece_type] > VAL[p.piece_type]:
                if VAL[p.piece_type] >= 3 or q.piece_type == chess.KING:
                    return 'pin'
            if (p.piece_type == chess.KING or VAL[p.piece_type] > VAL[q.piece_type]) and VAL[q.piece_type] >= 3:
                return 'skewer'

    # scoperta: un altro pezzo ora attacca re o donna
    after = {sq for s in b.pieces(chess.BISHOP, mover) | b.pieces(chess.ROOK, mover) | b.pieces(chess.QUEEN, mover)
             if s != to for sq in b.attacks(s)}
    big = {s for s in b.pieces(chess.KING, opp) | b.pieces(chess.QUEEN, opp)}
    if (after - before) & big:
        return 'discovered'

    if was_capture_gain >= 2:
        return 'material'
    if move.promotion or (piece.piece_type == chess.PAWN and chess.square_rank(to) in (1, 6)):
        return 'promotion'
    return 'other'


def phase_of(board: chess.Board) -> str:
    np_mat = sum(VAL[p.piece_type] for p in board.piece_map().values()
                 if p.piece_type not in (chess.PAWN, chess.KING))
    if np_mat <= 26:
        return 'end'
    if board.ply() <= 24 and np_mat >= 46:
        return 'open'
    return 'middle'


def _accuracy(wins_white: list, movers: list, color: str):
    """Accuratezza lichess (media pesata per volatilità + media armonica)."""
    n = len(wins_white)
    if n < 3:
        return None
    ws = min(8, max(2, (n - 1) // 10))
    wins = list(wins_white)
    windows = [wins[:ws]] * max(0, min(ws, n) - 2) + [wins[i:i + ws] for i in range(0, n - ws + 1)]

    def sd(xs):
        m = sum(xs) / len(xs)
        return math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs))
    weights = [min(12, max(0.5, sd(w))) for w in windows]
    accs = []
    for i in range(1, n):
        if movers[i - 1] != color:
            continue
        b, a = wins[i - 1], wins[i]
        if color == 'black':
            b, a = 100 - b, 100 - a
        raw = 103.1668100711649 * math.exp(-0.04354415386753951 * max(0, b - a)) - 3.166924740191411
        accs.append((min(100, max(0, raw + 1)), weights[i - 1] if i - 1 < len(weights) else 1))
    if not accs:
        return None
    wm = sum(a * w for a, w in accs) / sum(w for _, w in accs)
    hm = len(accs) / sum(1 / max(a, 1) for a, _ in accs)
    return round((wm + hm) / 2, 1)


# ═══════════════════════════════════════════════════════════════════════
#  Analisi di una partita
# ═══════════════════════════════════════════════════════════════════════

def _base_seconds(tc: str) -> float | None:
    m = re.match(r'^(\d+)', tc or '')
    return float(m.group(1)) if m else None


def _time_class(tc: str, given: str | None) -> str:
    if given:
        return given
    base = _base_seconds(tc)
    if base is None:
        return 'daily' if '/' in (tc or '') else 'unknown'
    inc = 0
    m = re.match(r'^\d+\+(\d+)', tc or '')
    if m:
        inc = int(m.group(1))
    est = base + 40 * inc
    return 'bullet' if est < 180 else 'blitz' if est < 600 else 'rapid' if est <= 3600 else 'daily'


def _sort_key(h, end_time):
    if end_time:
        return datetime.fromtimestamp(end_time, tz=timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')
    d = (h.get('UTCDate') or h.get('Date') or '').replace('.', '-')
    m = re.match(r'(\d{1,2}):(\d{2}):(\d{2})', h.get('EndTime') or h.get('UTCTime') or '')
    t = f"{int(m.group(1)):02d}:{m.group(2)}:{m.group(3)}" if m else '00:00:00'
    return f"{d}T{t}"


def analyse_game(g: dict, username: str, depth: int) -> bool:
    game = chess.pgn.read_game(io.StringIO(g['pgn']))
    if game is None:
        return False
    h = game.headers
    import repertoire
    names = {n.lower() for n in repertoire.account_list(username)}
    if h.get('White', '').lower() in names:
        color = 'white'
    elif h.get('Black', '').lower() in names:
        color = 'black'
    else:
        return False
    if h.get('Variant') and h.get('Variant') != 'Standard':
        return False
    engine = _ctx['get_engine']()
    if engine is None:
        raise RuntimeError('Stockfish non disponibile')

    nodes = list(game.mainline())
    board = game.board()
    positions, movers, clocks = [board.copy()], [], []
    for node in nodes:
        movers.append('white' if board.turn == chess.WHITE else 'black')
        board.push(node.move)
        positions.append(board.copy())
        clocks.append(node.clock())

    # ── Stockfish: 2 linee per ogni posizione ──
    infos = []
    for pos in positions:
        if _status['stop']:
            return False
        if pos.is_game_over():
            if pos.is_checkmate():
                w = 0.0 if pos.turn == chess.WHITE else 100.0
            else:
                w = 50.0
            infos.append({'win': w, 'lines': []})
            continue
        with _ctx['engine_lock']:
            res = engine.analyse(pos, chess.engine.Limit(depth=depth), multipv=2)
        if isinstance(res, dict):
            res = [res]
        lines = []
        for r in res:
            pv = r.get('pv') or []
            if pv:
                sc = r['score'].white()
                lines.append({'move': pv[0], 'win': win_white(sc),
                              'mate': sc.mate() if sc.is_mate() else None})
        infos.append({'win': lines[0]['win'] if lines else 50.0, 'lines': lines})

    wins = [i['win'] for i in infos]
    book = _ctx['get_book']()
    named = _ctx['get_named']()
    base = _base_seconds(h.get('TimeControl', ''))
    user_is_white = color == 'white'

    def uw(w):          # probabilità di vittoria dal tuo punto di vista
        return w if user_is_white else 100 - w

    rows = []
    agg = {'moves': 0, 'phase_moves': {'open': 0, 'middle': 0, 'end': 0},
           'blunder': 0, 'mistake': 0, 'inaccuracy': 0,
           'tags': {}, 'threat_positions': 0, 'win_positions': 0,
           'opp': {m: [0, 0] for m in MOTIFS},        # occasioni, trovate
           'time_errors': 0, 'errors': 0, 'book_moves': 0}
    opening, eco, rep_book_out = '', '', False
    first15 = []

    for i, node in enumerate(nodes):
        pos = positions[i]
        after = positions[i + 1]
        epd_after = after.epd()
        info = named.get(epd_after)
        if info:
            opening, eco = info['name'], info['eco']
        if movers[i] != color:
            continue
        move = node.move
        wb, wa = uw(wins[i]), uw(wins[i + 1])
        loss = max(0.0, wb - wa)
        ph = phase_of(pos)
        in_book = epd_after in book and not rep_book_out
        if not in_book:
            rep_book_out = True
        agg['moves'] += 1
        agg['phase_moves'][ph] += 1
        if in_book:
            agg['book_moves'] += 1
        cls = None
        if not in_book:
            cls = 'blunder' if loss >= 15 else 'mistake' if loss >= 10 else 'inaccuracy' if loss >= 5 else None
        if cls:
            agg[cls] += 1
        clock = clocks[i]
        cfrac = (clock / base) if (clock is not None and base) else None
        tags = []

        # minaccia già presente PRIMA della tua mossa?
        had_threat = 0
        prev_capture = i > 0 and positions[i - 1].is_capture(nodes[i - 1].move)
        # a metà di uno scambio (l'avversario ha appena catturato) non è una "minaccia"
        if not pos.is_check() and not prev_capture:
            nb = pos.copy(stack=False)
            nb.push(chess.Move.null())
            had_threat = threat(nb)
        if had_threat >= 2:
            agg['threat_positions'] += 1

        if cls in ('mistake', 'blunder'):
            agg['errors'] += 1
            now_threat = threat(after) if not after.is_game_over() else 0
            if had_threat >= 2 and now_threat >= 2:
                tags.append('missed_threat')
            elif now_threat >= 2:
                tags.append('hung')
            if wb >= 85 and wa < 70:
                tags.append('thrown_win')
            # quale tattica hai concesso? (la migliore risposta avversaria)
            nxt = infos[i + 1]['lines']
            if nxt:
                reply = nxt[0]
                mate_for_opp = reply['mate'] is not None and ((reply['mate'] < 0) == user_is_white) \
                    and abs(reply['mate']) <= 5
                mt = motif_of(after, reply['move'], mate_for_opp)
                if mt != 'other':
                    tags.append('allowed_' + mt)
            if cfrac is not None and cfrac < 0.1:
                tags.append('time')
                agg['time_errors'] += 1
        if wb >= 85:
            agg['win_positions'] += 1

        # occasione tattica: una sola mossa vincente
        opp_motif, opp_found = None, None
        lines = infos[i]['lines']
        if len(lines) >= 2 and pos.legal_moves.count() > 1 and not in_book:
            w1, w2 = uw(lines[0]['win']), uw(lines[1]['win'])
            prev = nodes[i - 1].move if i > 0 else None
            recapture = prev is not None and pos.is_capture(lines[0]['move']) and \
                positions[i - 1].is_capture(prev) and prev.to_square == lines[0]['move'].to_square
            if w1 - w2 >= 15 and w1 >= 60 and wb < 97 and not recapture:
                mate_flag = lines[0]['mate'] is not None and abs(lines[0]['mate']) <= 5 and \
                    ((lines[0]['mate'] > 0) == user_is_white)
                opp_motif = motif_of(pos, lines[0]['move'], mate_flag)
                opp_found = int(move == lines[0]['move'] or loss < 5)
                agg['opp'][opp_motif][0] += 1
                agg['opp'][opp_motif][1] += opp_found
        for t in tags:
            agg['tags'][t] = agg['tags'].get(t, 0) + 1

        best_san = pos.san(lines[0]['move']) if lines else None
        rows.append((g['key'], i + 1, pos.fen(), pos.san(move), best_san, ph, round(wb, 1),
                     round(wa, 1), round(loss, 1), clock, cfrac, cls,
                     json.dumps(tags) if tags else None, opp_motif, opp_found))
        if len(first15) < 15:
            first15.append((wins[i], wins[i + 1]))

    # accuratezze (totale, per fase, prime 15 mosse)
    acc = _accuracy(wins, movers, color)

    def acc_moves(sel):
        vals = []
        for r in rows:
            if sel(r):
                raw = 103.1668100711649 * math.exp(-0.04354415386753951 * r[8]) - 3.166924740191411
                vals.append(min(100, max(0, raw + 1)))
        return round(sum(vals) / len(vals), 1) if vals else None
    acc_o = acc_moves(lambda r: r[5] == 'open')
    acc_m = acc_moves(lambda r: r[5] == 'middle')
    acc_e = acc_moves(lambda r: r[5] == 'end')
    acc15 = acc_moves(lambda r: r[1] <= 30)
    time_trouble = int(any(r[10] is not None and r[10] < 0.1 for r in rows))

    result = h.get('Result', '*')
    score = {'1-0': 1.0, '0-1': 0.0, '1/2-1/2': 0.5}.get(result)
    if score is not None and color == 'black':
        score = 1 - score

    def elo(k):
        try:
            return int(h.get(k))
        except (TypeError, ValueError):
            return None
    user_elo = elo('WhiteElo' if user_is_white else 'BlackElo')
    opp_elo = elo('BlackElo' if user_is_white else 'WhiteElo')
    with _db() as conn:
        conn.execute('DELETE FROM an_moves WHERE game_key=?', (g['key'],))
        conn.execute('''INSERT OR REPLACE INTO an_games
            (game_key, source, url, sort_key, date, color, opponent, time_class, time_control,
             user_elo, opp_elo, score, n_plies, opening, eco, accuracy, acc_opening, acc_middle,
             acc_end, acc15, time_trouble, agg_json, version, analyzed_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (g['key'], g['source'], g.get('url'), _sort_key(h, g.get('end_time')),
             (h.get('Date') or '').replace('.', '-'), color,
             h.get('Black' if user_is_white else 'White', '?'),
             _time_class(h.get('TimeControl', ''), g.get('time_class')), h.get('TimeControl', ''),
             user_elo, opp_elo, score, len(nodes), opening, eco, acc, acc_o, acc_m, acc_e, acc15,
             time_trouble, json.dumps(agg), ANALYSIS_VERSION, time.strftime('%Y-%m-%dT%H:%M:%S')))
        conn.executemany('''INSERT INTO an_moves (game_key, ply, fen, san, best_san, phase,
            win_before, win_after, loss, clock, clock_frac, cls, tags, opp_motif, opp_found)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''', rows)
    return True


# ═══════════════════════════════════════════════════════════════════════
#  Coda di analisi in sottofondo
# ═══════════════════════════════════════════════════════════════════════

def _username():
    import repertoire
    return ', '.join(repertoire.usernames())


def _scope():
    """Cosa analizzare/mostrare: ultimi N mesi (0 = tutto) e cadenze (vuoto = tutte)."""
    sc = _ctx['config'].get('insights_scope') or {}
    months = int(sc.get('months') or 0)
    tcs = [t for t in (sc.get('time_classes') or []) if t]
    cutoff = ''
    if months:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=round(months * 30.44))).strftime('%Y-%m-%dT%H:%M:%S')
    return months, tcs, cutoff


def _headers(pgn: str) -> dict:
    return dict(re.findall(r'\[(\w+) "([^"]*)"\]', pgn[:3000]))


def _in_scope(time_class: str, sort_key: str, tcs, cutoff) -> bool:
    if tcs and time_class not in tcs:
        return False
    if cutoff and (sort_key or '') < cutoff:
        return False
    return True


def _load_pgns(conn) -> dict:
    pgns = {}
    for r in conn.execute('SELECT url, pgn FROM online_games'):
        pgns['cc:' + r['url']] = r['pgn']
    for r in conn.execute('SELECT id, pgn_text FROM games'):
        pgns[f"db:{r['id']}"] = r['pgn_text']
    return pgns


def _visible(rows, pgns, user):
    """Partite analizzate dei tuoi account attuali, nel periodo e nelle cadenze scelte."""
    import repertoire
    names = {n.lower() for n in repertoire.account_list(user)}
    _, tcs, cutoff = _scope()
    out = []
    for r in rows:
        pgn = pgns.get(r['game_key'])
        if not pgn:
            continue
        h = _headers(pgn)
        me = h.get('White' if r['color'] == 'white' else 'Black', '').lower()
        if me in names and _in_scope(r['time_class'], r['sort_key'], tcs, cutoff):
            out.append(r)
    return out


def _pending_games():
    import repertoire
    user = _username()
    if not user:
        return user, []
    with _db() as conn:
        done = {r['game_key'] for r in conn.execute(
            'SELECT game_key FROM an_games WHERE version=?', (ANALYSIS_VERSION,))}
    names = {n.lower() for n in repertoire.account_list(user)}
    _, tcs, cutoff = _scope()

    def wanted(g):
        h = _headers(g['pgn'])
        if h.get('White', '').lower() not in names and h.get('Black', '').lower() not in names:
            return False
        tc = _time_class(h.get('TimeControl', ''), g.get('time_class'))
        return _in_scope(tc, _sort_key(h, g.get('end_time')), tcs, cutoff)
    games = [g for g in repertoire._all_games(user) if g['key'] not in done and wanted(g)]
    # prima le più recenti: le tendenze "ora" diventano affidabili subito
    games.sort(key=lambda g: (g.get('end_time') or 0), reverse=True)
    return user, games


def _run_queue():
    user, games = _pending_games()
    import repertoire
    depth = int(_ctx['config'].get('insights_depth', 12))
    trees = {}
    _status.update(running=True, done=0, total=len(games), error=None, stop=False, current='')
    try:
        for g in games:
            if _status['stop']:
                break
            _status['current'] = g['key']
            try:
                if analyse_game(g, user, depth):
                    # controllo repertorio subito, così la pagina non deve rifarlo
                    repertoire.checks_for([g], user, trees)
            except RuntimeError as ex:
                _status['error'] = str(ex)
                break
            except Exception as ex:                          # noqa: BLE001
                print(f"[statistiche] partita saltata {g['key']}: {ex}")
            _status['done'] += 1
    finally:
        _status.update(running=False, current='', finished_at=time.time())


# ═══════════════════════════════════════════════════════════════════════
#  Rotte
# ═══════════════════════════════════════════════════════════════════════

def register(app, ctx: dict):
    _ctx.update(ctx)
    init_tables()

    @app.route('/api/insights/status')
    def insights_status():
        user, pending = _pending_games()
        months, tcs, cutoff = _scope()
        with _db() as conn:
            rows = conn.execute('SELECT game_key, color, time_class, sort_key FROM an_games '
                                'WHERE version=?', (ANALYSIS_VERSION,)).fetchall()
            n = len(_visible(rows, _load_pgns(conn), user))
        return jsonify({'username': user, 'analyzed': n, 'pending': len(pending),
                        'scope': {'months': months, 'time_classes': tcs},
                        'engine': _ctx['get_engine']() is not None, **_status})

    @app.route('/api/insights/scope', methods=['POST'])
    def insights_scope():
        """Periodo e cadenze da analizzare (e mostrare)."""
        data = request.json or {}
        cfg = _ctx['config']
        sc = dict(cfg.get('insights_scope') or {})
        if 'months' in data:
            sc['months'] = max(0, int(data['months'] or 0))
        if 'time_classes' in data:
            sc['time_classes'] = [t for t in data['time_classes'] if t in ('bullet', 'blitz', 'rapid', 'daily')]
        cfg['insights_scope'] = sc
        _ctx['save_config']()
        return jsonify({'ok': True, 'scope': sc})

    @app.route('/api/insights/analyze', methods=['POST'])
    def insights_analyze():
        if (request.json or {}).get('stop'):
            _status['stop'] = True
            return jsonify({'ok': True})
        if _ctx['get_engine']() is None:
            return jsonify({'ok': False, 'error': 'Stockfish non disponibile'}), 503
        if not _lock.acquire(blocking=False):
            return jsonify({'ok': True, 'already': True})

        def run():
            try:
                _run_queue()
            finally:
                _lock.release()
        threading.Thread(target=run, daemon=True).start()
        return jsonify({'ok': True})

    @app.route('/api/insights/data')
    def insights_data():
        """Aggregati per partita (in ordine cronologico) + stato del repertorio."""
        import repertoire
        user = _username()
        with _db() as conn:
            rows = conn.execute('SELECT * FROM an_games WHERE version=? ORDER BY sort_key',
                                (ANALYSIS_VERSION,)).fetchall()
            pgns = _load_pgns(conn)
        # solo i tuoi account attuali e solo il periodo/cadenze scelti
        rows = _visible(rows, pgns, user)
        checks = repertoire.checks_for(
            [{'key': r['game_key'], 'pgn': pgns[r['game_key']]} for r in rows if r['game_key'] in pgns],
            user) if user else {}
        games = []
        for r in rows:
            g = {k: r[k] for k in r.keys() if k != 'agg_json'}
            g['agg'] = json.loads(r['agg_json'] or '{}')
            rep = checks.get(r['game_key'])
            if rep:
                g['rep'] = {k: rep.get(k) for k in ('status', 'ply', 'reached', 'chapter', 'chapter_id')}
            games.append(g)
        return jsonify({'username': user, 'games': games})

    @app.route('/api/insights/game')
    def insights_game():
        """Le mie mosse analizzate di una partita (per la vista partita nel pop-up)."""
        key = request.args.get('key', '')
        with _db() as conn:
            rows = [dict(r) for r in conn.execute(
                'SELECT ply, san, best_san, cls, win_before, win_after, phase FROM an_moves WHERE game_key=? ORDER BY ply', (key,))]
        return jsonify({'moves': rows})

    @app.route('/api/insights/examples')
    def insights_examples():
        """Posizioni di esempio per un tema (le più recenti)."""
        kind = request.args.get('kind', '')          # tag:<nome> | missed:<tema> | found:<tema>
        keys = request.args.get('games', '')
        allowed = set(keys.split(',')) if keys else None
        with _db() as conn:
            q = '''SELECT m.*, g.date, g.opponent, g.color, g.sort_key FROM an_moves m
                   JOIN an_games g ON g.game_key=m.game_key WHERE g.version=? '''
            args = [ANALYSIS_VERSION]
            if kind.startswith('tag:'):
                q += 'AND m.tags LIKE ? '
                args.append(f'%"{kind[4:]}"%')
            elif kind.startswith('missed:'):
                q += 'AND m.opp_motif=? AND m.opp_found=0 '
                args.append(kind[7:])
            elif kind.startswith('found:'):
                q += 'AND m.opp_motif=? AND m.opp_found=1 '
                args.append(kind[6:])
            elif kind.startswith('cls:'):
                q += 'AND m.cls=? '
                args.append(kind[4:])
            elif kind.startswith('phase:'):
                q += "AND m.phase=? AND m.cls IN ('blunder','mistake') "
                args.append(kind[6:])
            q += 'ORDER BY g.sort_key DESC, m.ply LIMIT 200'
            rows = [dict(r) for r in conn.execute(q, args)]
        if allowed is not None:
            rows = [r for r in rows if r['game_key'] in allowed]
        return jsonify({'examples': rows[:24]})
