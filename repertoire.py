"""
repertoire.py — modulo Aperture di Chess Review.

Cosa fa:
  • CAPITOLI   — uno per apertura di static/openings.json (colore + gruppo).
  • ALBERO     — per ogni capitolo costruisce un albero di posizioni:
                   - mosse dell'avversario: le risposte di teoria più frequenti
                     (peso = quante linee del database lichess passano da lì);
                   - mosse tue: una sola per posizione, scelta da Stockfish tra
                     le mosse di teoria (o quella delle tue varianti in openings.json).
  • RIPASSO    — ogni posizione in cui tocca a te è una "carta" con
                 ripetizione dilazionata (SM-2 semplificato).
  • PARTITE    — importa le partite chess.com e controlla, partita per
                 partita, dove tu o l'avversario siete usciti dal repertorio.
                 Se sei uscito tu, la carta di quella posizione torna da ripassare.

Tutto l'albero è salvato in SQLite (stesso DB delle partite).
"""
from __future__ import annotations

import io
import json
import re
import threading
import time
from datetime import date, timedelta

import chess
import chess.engine
import chess.pgn
from flask import jsonify, request

BUILD_VERSION = 1
CHECK_VERSION = 1

_ctx = {}                 # riferimenti al server (engine, db, config, ...)
_build_lock = threading.Lock()
_build_status = {'running': False, 'job': '', 'done': 0, 'total': 0,
                 'nodes': 0, 'error': None, 'finished_at': None}


# ═══════════════════════════════════════════════════════════════════════
#  Utilità
# ═══════════════════════════════════════════════════════════════════════

def _db():
    return _ctx['get_db']()


def _cfg():
    return _ctx['config']


def _today() -> str:
    return date.today().isoformat()


def _slug(s: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def _score_fields(pov_white):
    """PovScore (lato Bianco) → (cp, mate)."""
    if pov_white is None:
        return None, None
    if pov_white.is_mate():
        return None, pov_white.mate()
    return pov_white.score(), None


def _user_value(cp, mate, color: str) -> float:
    """Valore per il giocatore del repertorio (più alto = meglio per te)."""
    if mate is not None:
        v = 100000 - abs(mate) if mate > 0 else -100000 + abs(mate)
    elif cp is not None:
        v = cp
    else:
        v = 0
    return v if color == 'white' else -v


def init_tables():
    with _db() as conn:
        conn.executescript('''
            CREATE TABLE IF NOT EXISTS rep_studied (
                chapter_id    TEXT NOT NULL,
                epd           TEXT NOT NULL,
                at            TEXT,
                PRIMARY KEY (chapter_id, epd)
            );
            CREATE TABLE IF NOT EXISTS rep_chapters (
                id            TEXT PRIMARY KEY,
                color         TEXT NOT NULL,
                name          TEXT NOT NULL,
                root_uci      TEXT NOT NULL DEFAULT '',
                context       TEXT NOT NULL DEFAULT '',
                sort          INTEGER NOT NULL DEFAULT 0,
                built_at      TEXT,
                build_version INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS rep_nodes (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                chapter_id    TEXT NOT NULL REFERENCES rep_chapters(id) ON DELETE CASCADE,
                parent_id     INTEGER REFERENCES rep_nodes(id) ON DELETE CASCADE,
                ply           INTEGER NOT NULL,
                move_uci      TEXT,
                move_san      TEXT,
                fen           TEXT NOT NULL,
                epd           TEXT NOT NULL,
                user_to_move  INTEGER NOT NULL,
                weight        INTEGER NOT NULL DEFAULT 0,
                eval_cp       INTEGER,
                eval_mate     INTEGER,
                name          TEXT,
                eco           TEXT,
                seeded        INTEGER NOT NULL DEFAULT 0,
                main          INTEGER NOT NULL DEFAULT 0,
                flag          TEXT,
                comment       TEXT,
                comment_src   TEXT,
                srs_state     TEXT NOT NULL DEFAULT 'new',
                srs_interval  REAL NOT NULL DEFAULT 0,
                srs_ease      REAL NOT NULL DEFAULT 2.5,
                srs_due       TEXT,
                srs_reps      INTEGER NOT NULL DEFAULT 0,
                srs_lapses    INTEGER NOT NULL DEFAULT 0,
                srs_last      TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_rep_nodes_ch  ON rep_nodes(chapter_id);
            CREATE INDEX IF NOT EXISTS idx_rep_nodes_par ON rep_nodes(parent_id);
            CREATE TABLE IF NOT EXISTS online_games (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                source      TEXT NOT NULL,
                url         TEXT NOT NULL UNIQUE,
                pgn         TEXT NOT NULL,
                white       TEXT NOT NULL DEFAULT '?',
                black       TEXT NOT NULL DEFAULT '?',
                result      TEXT NOT NULL DEFAULT '*',
                end_time    INTEGER,
                time_class  TEXT
            );
            CREATE TABLE IF NOT EXISTS rep_check_cache (
                game_key    TEXT PRIMARY KEY,
                ver         TEXT NOT NULL,
                result_json TEXT
            );
            CREATE TABLE IF NOT EXISTS rep_game_flags (
                game_key    TEXT PRIMARY KEY,
                node_id     INTEGER,
                applied_at  TEXT
            );
        ''')


# ═══════════════════════════════════════════════════════════════════════
#  Capitoli (da static/openings.json)
# ═══════════════════════════════════════════════════════════════════════

def _line_to_ucis(pgn_line: str) -> list[str]:
    game = chess.pgn.read_game(io.StringIO(pgn_line))
    return [m.uci() for m in game.mainline_moves()] if game else []


def load_chapter_defs() -> list[dict]:
    """Legge openings.json e ricava radice e varianti-seme di ogni capitolo."""
    path = _ctx['static_dir'] / 'openings.json'
    data = json.loads(path.read_text(encoding='utf-8'))
    out, sort = [], 0
    for color in ('white', 'black'):
        for group, variants in (data.get(color) or {}).items():
            seeds = [_line_to_ucis(v['pgn']) for v in variants if v.get('pgn')]
            seeds = [s for s in seeds if s]
            if not seeds:
                continue
            # radice = prefisso comune, tagliato all'ultima mossa del repertorio
            root = seeds[0]
            for s in seeds[1:]:
                k = 0
                while k < min(len(root), len(s)) and root[k] == s[k]:
                    k += 1
                root = root[:k]
            user_parity = 0 if color == 'white' else 1   # indice ply delle mosse tue
            while root and (len(root) - 1) % 2 != user_parity:
                root = root[:-1]
            context = next((v.get('context', '') for v in variants
                            if v.get('pgn') and len(_line_to_ucis(v['pgn'])) == len(root)), '')
            if not context:
                context = variants[0].get('context', '')
            ecos = sorted(v['eco'] for v in variants if v.get('eco'))
            out.append({
                'id': f"{color}-{_slug(group)}", 'color': color, 'name': group,
                'root': root, 'seeds': seeds, 'context': context, 'sort': sort,
                'eco_range': (ecos[0], ecos[-1]) if ecos else None,
            })
            sort += 1
    return out


def sync_chapters():
    """Allinea la tabella capitoli a openings.json (senza toccare gli alberi)."""
    defs = load_chapter_defs()
    with _db() as conn:
        for d in defs:
            conn.execute('''INSERT INTO rep_chapters (id, color, name, root_uci, context, sort)
                            VALUES (?,?,?,?,?,?)
                            ON CONFLICT(id) DO UPDATE SET name=excluded.name,
                              root_uci=excluded.root_uci, context=excluded.context,
                              sort=excluded.sort''',
                         (d['id'], d['color'], d['name'], ' '.join(d['root']),
                          d['context'], d['sort']))
    return {d['id']: d for d in defs}


# ═══════════════════════════════════════════════════════════════════════
#  Costruzione dell'albero
# ═══════════════════════════════════════════════════════════════════════

def _analyse_moves(board: chess.Board, moves: list[chess.Move], depth: int) -> dict:
    """Valuta un insieme di mosse candidate. Ritorna {move: PovScore lato Bianco}."""
    engine = _ctx['get_engine']()
    if engine is None or not moves:
        return {}
    with _ctx['engine_lock']:
        infos = engine.analyse(board, chess.engine.Limit(depth=depth),
                               multipv=len(moves), root_moves=moves)
    if isinstance(infos, dict):
        infos = [infos]
    res = {}
    for info in infos:
        pv = info.get('pv')
        if pv:
            res[pv[0]] = info['score'].white()
    return res


class _Builder:
    def __init__(self, conn, chapter: dict):
        self.conn = conn
        self.ch = chapter
        self.color = chapter['color']
        self.book = _ctx['get_book']()
        self.named = _ctx['get_named']()
        cfg = _cfg()
        self.max_ply = int(cfg.get('rep_max_ply', 20))
        self.max_nodes = int(cfg.get('rep_max_nodes', 160))
        self.depth = int(cfg.get('rep_build_depth', 12))
        self.tolerance = int(cfg.get('rep_tolerance_cp', 40))
        self.count = conn.execute('SELECT COUNT(*) FROM rep_nodes WHERE chapter_id=?',
                                  (chapter['id'],)).fetchone()[0]
        self.expanded_epds = set()
        self._eco_cache = {}

    def inherited_eco(self, node):
        """ECO dell'ultima posizione con nome lungo il percorso."""
        nid = node['id']
        if nid in self._eco_cache:
            return self._eco_cache[nid]
        eco, cur = None, node
        while cur is not None:
            if cur['eco']:
                eco = cur['eco']
                break
            cur = self.conn.execute('SELECT * FROM rep_nodes WHERE id=?', (cur['parent_id'],)).fetchone() \
                if cur['parent_id'] else None
        self._eco_cache[nid] = eco
        return eco

    def in_chapter(self, eco):
        r = self.ch.get('eco_range')
        return bool(r and eco and r[0] <= eco <= r[1])

    def choose_user_move(self, node, board, theory, scores):
        """Tra le mosse di teoria vicine alla migliore (entro `tolerance` cp)
        preferisce quelle che restano nell'apertura del capitolo (codice ECO),
        poi la più giocata. Così il repertorio resta "tuo" e non salta in
        un'altra apertura solo perché il motore la vede di 10 centipawn."""
        if not scores:
            return theory[0][0]
        vals = {m: _user_value(*_score_fields(sc), self.color) for m, sc in scores.items()}
        best_val = max(vals.values())
        weights = dict(theory)
        near = [m for m in vals if vals[m] >= best_val - self.tolerance]
        parent_eco = self.inherited_eco(node)
        def eco_after(m):
            board.push(m)
            info = self.named.get(board.epd()) or {}
            board.pop()
            return info.get('eco') or parent_eco
        inside = [m for m in near if self.in_chapter(eco_after(m))]
        pool = inside or near
        return max(pool, key=lambda m: (weights.get(m, 0), vals[m]))

    # ── nodi ──────────────────────────────────────────────────────────
    def children(self, node_id):
        return self.conn.execute('SELECT * FROM rep_nodes WHERE parent_id=? ORDER BY main DESC, weight DESC, id',
                                 (node_id,)).fetchall()

    def insert(self, parent, board: chess.Board, move: chess.Move | None,
               san: str | None, seeded=0, main=0, score=None, flag=None):
        epd = board.epd()
        info = self.named.get(epd) or {}
        cp, mate = _score_fields(score)
        cur = self.conn.execute('''
            INSERT INTO rep_nodes (chapter_id, parent_id, ply, move_uci, move_san, fen, epd,
                                   user_to_move, weight, eval_cp, eval_mate, name, eco,
                                   seeded, main, flag)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (self.ch['id'], parent['id'] if parent else None, board.ply(),
             move.uci() if move else None, san, board.fen(), epd,
             int((board.turn == chess.WHITE) == (self.color == 'white')),
             int(self.book.get(epd, 0)), cp, mate, info.get('name'), info.get('eco'),
             seeded, main, flag))
        self.count += 1
        return self.conn.execute('SELECT * FROM rep_nodes WHERE id=?', (cur.lastrowid,)).fetchone()

    def child_for(self, node, move: chess.Move):
        return self.conn.execute('SELECT * FROM rep_nodes WHERE parent_id=? AND move_uci=?',
                                 (node['id'], move.uci())).fetchone()

    def get_or_create(self, node, move: chess.Move, seeded=0, main=0):
        existing = self.child_for(node, move)
        if existing:
            if seeded and not existing['seeded']:
                self.conn.execute('UPDATE rep_nodes SET seeded=1 WHERE id=?', (existing['id'],))
            return existing
        board = chess.Board(node['fen'])
        san = board.san(move)
        board.push(move)
        return self.insert(node, board, move, san, seeded=seeded, main=main)

    # ── costruzione ───────────────────────────────────────────────────
    def build(self, progress=None):
        conn, ch = self.conn, self.ch
        conn.execute('DELETE FROM rep_nodes WHERE chapter_id=?', (ch['id'],))
        self.count = 0
        root = self.insert(None, chess.Board(), None, None, seeded=1, main=1)
        cur = root
        for uci in ch['root']:
            cur = self.get_or_create(cur, chess.Move.from_uci(uci), seeded=1, main=1)
        # le varianti di openings.json entrano sempre nell'albero
        for seed in ch['seeds']:
            node = root
            for i, uci in enumerate(seed):
                mv = chess.Move.from_uci(uci)
                if not chess.Board(node['fen']).is_legal(mv):
                    break
                node = self.get_or_create(node, mv, seeded=1, main=int(i < len(ch['root'])))
        # valutazioni anche per le mosse della radice (1.e4, 1...c6, ...)
        node = root
        for _ in ch['root']:
            kids = self.children(node['id'])
            main = next((k for k in kids if k['main']), None)
            if not main:
                break
            self._fill_evals(chess.Board(node['fen']), [main])
            node = main
        self.expand_from([n for n in conn.execute(
            'SELECT * FROM rep_nodes WHERE chapter_id=? AND ply>=? ORDER BY ply, id',
            (ch['id'], len(ch['root'])))], progress)
        conn.execute('UPDATE rep_chapters SET built_at=?, build_version=? WHERE id=?',
                     (time.strftime('%Y-%m-%dT%H:%M:%S'), BUILD_VERSION, ch['id']))

    def expand_from(self, start_nodes, progress=None):
        """Espansione in ampiezza: prima le posizioni vicine alla radice."""
        queue = list(start_nodes)
        seen = set()
        while queue:
            node = queue.pop(0)
            if node['id'] in seen:
                continue
            seen.add(node['id'])
            self.expand(node)
            if progress:
                progress(self.count)
            kids = self.children(node['id'])
            queue.extend(kids)

    def expand(self, node):
        board = chess.Board(node['fen'])
        if board.is_game_over() or node['ply'] >= self.max_ply:
            return
        existing = self.children(node['id'])
        # trasposizione: la stessa posizione è già stata sviluppata altrove
        if node['epd'] in self.expanded_epds and not existing:
            self.conn.execute("UPDATE rep_nodes SET flag=COALESCE(flag, 'transpose') WHERE id=?", (node['id'],))
            return
        self.expanded_epds.add(node['epd'])
        theory = []
        for mv in board.legal_moves:
            board.push(mv)
            w = self.book.get(board.epd(), 0)
            board.pop()
            if w:
                theory.append((mv, w))
        theory.sort(key=lambda x: -x[1])

        if node['user_to_move']:
            if existing:
                # mossa già scelta (dalle tue varianti): calcola solo le valutazioni
                self._fill_evals(board, existing)
                return
            if not theory or self.count >= self.max_nodes:
                return                                   # fine della teoria
            cands = [m for m, _ in theory[:6]]
            scores = _analyse_moves(board, cands, self.depth)
            best = self.choose_user_move(node, board, theory, scores)
            child = self.get_or_create(node, best, main=1)
            cp, mate = _score_fields(scores.get(best))
            self.conn.execute('UPDATE rep_nodes SET eval_cp=?, eval_mate=? WHERE id=?',
                              (cp, mate, child['id']))
            return

        # tocca all'avversario: risposte di teoria più frequenti
        ply = node['ply']
        k = 4 if ply < 8 else 3 if ply < 14 else 2
        keep = [m for i, (m, w) in enumerate(theory[:k]) if i == 0 or w >= 2]
        have = {c['move_uci'] for c in existing}
        new_moves = [m for m in keep if m.uci() not in have]
        budget = self.max_nodes - self.count
        if budget <= 0:
            new_moves = []
        new_moves = new_moves[:max(0, budget)]
        all_moves = [chess.Move.from_uci(c['move_uci']) for c in existing] + new_moves
        if not all_moves:
            return
        scores = _analyse_moves(board, all_moves, self.depth)
        for mv in new_moves:
            self.get_or_create(node, mv)
        # valutazioni + segnala le risposte che sono errori dell'avversario
        vals = {m: _user_value(*_score_fields(s), self.color) for m, s in scores.items()}
        worst_for_you = min(vals.values()) if vals else 0
        for mv in all_moves:
            child = self.child_for(node, mv)
            if not child:
                continue
            cp, mate = _score_fields(scores.get(mv))
            flag = None
            if mv in vals and vals[mv] - worst_for_you >= 120 and vals[mv] >= 80:
                flag = 'punish'          # l'avversario sbaglia: c'è da punire
            self.conn.execute('UPDATE rep_nodes SET eval_cp=?, eval_mate=?, flag=? WHERE id=?',
                              (cp, mate, flag, child['id']))

    def _fill_evals(self, board, children):
        missing = [c for c in children if c['eval_cp'] is None and c['eval_mate'] is None]
        if not missing:
            return
        moves = [chess.Move.from_uci(c['move_uci']) for c in missing]
        scores = _analyse_moves(board, moves, self.depth)
        for c, mv in zip(missing, moves):
            cp, mate = _score_fields(scores.get(mv))
            self.conn.execute('UPDATE rep_nodes SET eval_cp=?, eval_mate=? WHERE id=?',
                              (cp, mate, c['id']))


def _run_build(chapter_ids: list[str], force: bool):
    defs = sync_chapters()
    todo = []
    with _db() as conn:
        for cid in chapter_ids:
            row = conn.execute('SELECT built_at, build_version FROM rep_chapters WHERE id=?',
                               (cid,)).fetchone()
            if cid in defs and (force or not row or not row['built_at']
                                or row['build_version'] < BUILD_VERSION):
                todo.append(defs[cid])
    _build_status.update(running=True, job='build', done=0, total=len(todo),
                         nodes=0, error=None, chapter='')
    try:
        for d in todo:
            _build_status['chapter'] = d['name']
            with _db() as conn:
                b = _Builder(conn, d)
                b.build(progress=lambda n: _build_status.update(nodes=n))
            _build_status['done'] += 1
    except Exception as ex:                                  # noqa: BLE001
        _build_status['error'] = str(ex)
        print(f"[repertorio] errore costruzione: {ex}")
    finally:
        _build_status.update(running=False, finished_at=time.time())


def missing_seeds(conn, d: dict) -> int:
    """Quante varianti di openings.json non sono (ancora tutte) nell'albero già costruito."""
    root = conn.execute('SELECT id FROM rep_nodes WHERE chapter_id=? AND parent_id IS NULL',
                        (d['id'],)).fetchone()
    if not root:
        return 0
    miss = 0
    for seed in d['seeds']:
        nid = root['id']
        for uci in seed:
            r = conn.execute('SELECT id FROM rep_nodes WHERE parent_id=? AND move_uci=?', (nid, uci)).fetchone()
            if not r:
                miss += 1
                break
            nid = r['id']
    return miss


def _run_merge(chapter_id: str):
    """Aggiorna un capitolo già costruito con le varianti nuove di openings.json
    SENZA ricostruirlo: le carte esistenti tengono i loro progressi di ripasso.
    - le mosse delle varianti entrano nell'albero (anche oltre rep_max_ply);
    - dove una variante sceglie una TUA mossa diversa da quella che c'era, il ramo
      vecchio in conflitto viene tolto (solo quello);
    - Stockfish valuta le posizioni nuove e le espande come una costruzione normale."""
    _build_status.update(running=True, job='merge', done=0, total=1, nodes=0, error=None, chapter='')
    try:
        defs = sync_chapters()
        d = defs.get(chapter_id)
        if not d:
            raise ValueError('Capitolo non trovato')
        _build_status['chapter'] = d['name']
        with _db() as conn:
            conn.execute('PRAGMA foreign_keys=ON')
            b = _Builder(conn, d)
            root = conn.execute('SELECT * FROM rep_nodes WHERE chapter_id=? AND parent_id IS NULL',
                                (d['id'],)).fetchone()
            if not root:
                raise ValueError('Capitolo non ancora costruito')
            allowed, new_nodes = {}, []
            for seed in d['seeds']:
                node = root
                for uci in seed:
                    mv = chess.Move.from_uci(uci)
                    if not chess.Board(node['fen']).is_legal(mv):
                        break
                    first = False
                    if node['user_to_move']:
                        first = node['id'] not in allowed
                        allowed.setdefault(node['id'], []).append(uci)
                    had = b.child_for(node, mv)
                    child = b.get_or_create(node, mv, seeded=1, main=int(first))
                    if not had:
                        new_nodes.append(child)
                    node = child
            # rami vecchi in conflitto: una tua mossa diversa da quelle delle varianti
            removed = 0
            for nid, ok in allowed.items():
                for c in b.children(nid):
                    if c['move_uci'] not in ok:
                        conn.execute('DELETE FROM rep_nodes WHERE id=?', (c['id'],))
                        removed += 1
            b.count = conn.execute('SELECT COUNT(*) FROM rep_nodes WHERE chapter_id=?', (d['id'],)).fetchone()[0]
            b.max_nodes = b.count + int(_cfg().get('rep_merge_nodes', 200))
            # valutazioni delle mosse nuove (anche oltre la profondità massima)
            alive = [conn.execute('SELECT * FROM rep_nodes WHERE id=?', (n['id'],)).fetchone() for n in new_nodes]
            alive = [n for n in alive if n]
            by_parent = {}
            for n in alive:
                by_parent.setdefault(n['parent_id'], []).append(n)
            for pid, kids in by_parent.items():
                par = conn.execute('SELECT fen FROM rep_nodes WHERE id=?', (pid,)).fetchone()
                b._fill_evals(chess.Board(par['fen']), kids)
            # le posizioni già sviluppate non vanno toccate
            b.expanded_epds = {r['epd'] for r in conn.execute(
                'SELECT DISTINCT n.epd FROM rep_nodes n WHERE n.chapter_id=? AND EXISTS '
                '(SELECT 1 FROM rep_nodes c WHERE c.parent_id=n.id)', (d['id'],))
                if r['epd'] not in {x['epd'] for x in alive}}
            b.expand_from(sorted(alive, key=lambda n: n['ply']),
                          progress=lambda n: _build_status.update(nodes=n))
            conn.execute('UPDATE rep_chapters SET built_at=? WHERE id=?',
                         (time.strftime('%Y-%m-%dT%H:%M:%S'), d['id']))
            _build_status.update(added=len(alive), removed=removed)
        _build_status['done'] = 1
    except Exception as ex:                                  # noqa: BLE001
        _build_status['error'] = str(ex)
        print(f"[repertorio] errore aggiornamento: {ex}")
    finally:
        _build_status.update(running=False, finished_at=time.time())


def _start_job(target, *args):
    if not _build_lock.acquire(blocking=False):
        return False
    def run():
        try:
            target(*args)
        finally:
            _build_lock.release()
    threading.Thread(target=run, daemon=True).start()
    return True


# ═══════════════════════════════════════════════════════════════════════
#  Ripetizione dilazionata (SM-2 semplificato)
# ═══════════════════════════════════════════════════════════════════════

def _srs_update(row, correct: bool) -> dict:
    today = date.today()
    state, interval, ease = row['srs_state'], row['srs_interval'], row['srs_ease']
    reps, lapses = row['srs_reps'], row['srs_lapses']
    if correct:
        if state == 'new' or interval < 1:
            interval = 1
        else:
            interval = max(1, int(interval * ease + 0.5))
            ease = min(3.0, ease + 0.05)
        state = 'review'
        reps += 1
    else:
        lapses += 1
        ease = max(1.3, ease - 0.2)
        interval = 0
        state = 'relearn'
    due = (today + timedelta(days=int(interval))).isoformat()
    return {'srs_state': state, 'srs_interval': interval, 'srs_ease': round(ease, 2),
            'srs_due': due, 'srs_reps': reps, 'srs_lapses': lapses,
            'srs_last': today.isoformat()}


def _node_json(r) -> dict:
    return {k: r[k] for k in r.keys()}


# ═══════════════════════════════════════════════════════════════════════
#  Controllo delle partite contro il repertorio
# ═══════════════════════════════════════════════════════════════════════

def _load_trees(color: str) -> list[dict]:
    with _db() as conn:
        chapters = conn.execute(
            'SELECT * FROM rep_chapters WHERE color=? AND built_at IS NOT NULL ORDER BY sort',
            (color,)).fetchall()
        trees = []
        for ch in chapters:
            nodes = conn.execute('SELECT id, parent_id, epd, move_san, move_uci, user_to_move, ply '
                                 'FROM rep_nodes WHERE chapter_id=?', (ch['id'],)).fetchall()
            by_parent, by_epd, root = {}, {}, None
            for n in nodes:
                by_parent.setdefault(n['parent_id'], []).append(n)
                by_epd.setdefault(n['epd'], n)
                if n['parent_id'] is None:
                    root = n
            root_len = len(ch['root_uci'].split()) if ch['root_uci'] else 0
            trees.append({'ch': ch, 'root': root, 'by_parent': by_parent,
                          'by_epd': by_epd, 'root_len': root_len})
    return trees


def account_list(value) -> list[str]:
    """"account1, account2" → ['account1', 'account2'] (accetta anche una lista)."""
    if isinstance(value, (list, tuple, set)):
        items = value
    else:
        items = re.split(r'[,;\s]+', value or '')
    out = []
    for x in items:
        x = str(x).strip()
        if x and x.lower() not in {o.lower() for o in out}:
            out.append(x)
    return out


def usernames() -> list[str]:
    """Tutti i tuoi account chess.com (impostati, altrimenti suggeriti)."""
    return account_list(_cfg().get('chesscom_username')) or account_list(suggested_username())


def check_game(pgn_text: str, username, trees_cache: dict) -> dict | None:
    game = chess.pgn.read_game(io.StringIO(pgn_text))
    if game is None:
        return None
    h = game.headers
    names = {n.lower() for n in account_list(username)}
    white, black = h.get('White', '?'), h.get('Black', '?')
    if white.lower() in names:
        color = 'white'
    elif black.lower() in names:
        color = 'black'
    else:
        return None
    if color not in trees_cache:
        trees_cache[color] = _load_trees(color)
    trees = trees_cache[color]
    result = h.get('Result', '*')
    score = {'1-0': 1.0, '0-1': 0.0, '1/2-1/2': 0.5}.get(result)
    if score is not None and color == 'black':
        score = 1.0 - score
    base = {'color': color, 'white': white, 'black': black, 'result': result,
            'score': score, 'date': h.get('Date', ''), 'link': h.get('Link', ''),
            'eco': h.get('ECO', ''), 'time_control': h.get('TimeControl', '')}
    if not trees:
        return {**base, 'status': 'no_tree'}

    moves = list(game.mainline_moves())
    candidates = []
    for tr in trees:
        board = chess.Board()
        node, reached, status, dev = tr['root'], 0, 'end', None
        for i, mv in enumerate(moves):
            before_turn = board.turn
            san = board.san(mv)
            board.push(mv)
            epd = board.epd()
            kids = tr['by_parent'].get(node['id'], [])
            match = next((k for k in kids if k['epd'] == epd), None)
            if match is None and kids:
                # trasposizione: stessa posizione raggiunta per un'altra strada
                alt = tr['by_epd'].get(epd)
                if alt is not None and alt['ply'] == board.ply():
                    match = alt
            if match is not None:
                node, reached = match, i + 1
                continue
            if not kids:
                status = 'end'                              # teoria del repertorio finita
            else:
                mine = (before_turn == chess.WHITE) == (color == 'white')
                status = 'you' if mine else 'opp'
                dev = {'ply': i + 1, 'played': san, 'expected': [k['move_san'] for k in kids],
                       'node_id': node['id']}
            break
        candidates.append({'tr': tr, 'reached': reached, 'status': status, 'dev': dev})

    best_reached = max(c['reached'] for c in candidates)
    top = [c for c in candidates if c['reached'] == best_reached]
    pick = next((c for c in top if c['status'] == 'you'), top[0])
    out = {**base, 'status': pick['status'], 'reached': best_reached,
           'chapter_id': pick['tr']['ch']['id'], 'chapter': pick['tr']['ch']['name']}
    if pick['dev']:
        dev = dict(pick['dev'])
        if pick['status'] == 'you':
            # più capitoli possibili alla stessa profondità → unisci le mosse attese
            exp = []
            for c in top:
                if c['status'] == 'you' and c['dev']:
                    exp += [e for e in c['dev']['expected'] if e not in exp]
            dev['expected'] = exp
        out.update(dev)
        # l'avversario esce PRIMA che inizi qualunque tuo capitolo → buco nel repertorio
        if pick['status'] == 'opp' and all(c['dev'] and c['dev']['ply'] <= c['tr']['root_len']
                                           for c in top):
            out['status'] = 'uncovered'
            out['chapter'] = ''
            out['chapter_id'] = ''
    if out.get('ply'):
        n = (out['ply'] + 1) // 2
        out['move_label'] = f"{n}." if out['ply'] % 2 == 1 else f"{n}…"
    return out


def tree_version() -> str:
    """Cambia quando il repertorio viene costruito o modificato."""
    with _db() as conn:
        a = conn.execute("SELECT group_concat(id || ':' || IFNULL(built_at, ''), ',') "
                         "FROM rep_chapters").fetchone()[0] or ''
        b = conn.execute('SELECT COUNT(*), IFNULL(MAX(id), 0) FROM rep_nodes').fetchone()
    return f"{a}|{b[0]}|{b[1]}"


def checks_for(games: list[dict], username, trees: dict | None = None) -> dict:
    """Controllo repertorio per molte partite, con cache su DB.
    Si ricalcola solo se cambiano il repertorio o gli account."""
    names = ','.join(sorted(n.lower() for n in account_list(username)))
    ver = f"{tree_version()}|{names}"
    with _db() as conn:
        cached = {r['game_key']: r['result_json'] for r in conn.execute(
            'SELECT game_key, result_json FROM rep_check_cache WHERE ver=?', (ver,))}
    trees = {} if trees is None else trees
    out, new = {}, []
    for g in games:
        if g['key'] in cached:
            out[g['key']] = json.loads(cached[g['key']]) if cached[g['key']] else None
            continue
        try:
            res = check_game(g['pgn'], username, trees)
        except Exception as ex:                              # noqa: BLE001
            print(f"[repertorio] partita non leggibile ({g['key']}): {ex}")
            res = None
        out[g['key']] = res
        new.append((g['key'], ver, json.dumps(res) if res else None))
    if new:
        with _db() as conn:
            conn.executemany('INSERT OR REPLACE INTO rep_check_cache (game_key, ver, result_json) '
                             'VALUES (?,?,?)', new)
    return out


def _all_games(username: str) -> list[dict]:
    """Partite chess.com importate + partite salvate nell'app."""
    games = []
    with _db() as conn:
        for r in conn.execute('SELECT id, url, pgn, end_time, time_class FROM online_games '
                              'ORDER BY end_time DESC'):
            games.append({'key': 'cc:' + r['url'], 'source': 'chess.com', 'pgn': r['pgn'],
                          'url': r['url'], 'end_time': r['end_time'],
                          'time_class': r['time_class'], 'local_id': None})
        known = {g['url'] for g in games}
        for r in conn.execute('SELECT id, pgn_text, created_at FROM games ORDER BY created_at DESC'):
            m = re.search(r'\[Link "([^"]+)"\]', r['pgn_text'])
            link = m.group(1) if m else ''
            if link and link in known:
                continue
            games.append({'key': f"db:{r['id']}", 'source': 'app', 'pgn': r['pgn_text'],
                          'url': link, 'end_time': None, 'time_class': None,
                          'local_id': r['id']})
    return games


def _apply_lapse(game_key: str, node_id: int):
    """Uscita tua dal repertorio → la carta torna da ripassare (una volta per partita)."""
    with _db() as conn:
        if conn.execute('SELECT 1 FROM rep_game_flags WHERE game_key=?', (game_key,)).fetchone():
            return False
        row = conn.execute('SELECT * FROM rep_nodes WHERE id=?', (node_id,)).fetchone()
        if not row:
            return False
        upd = _srs_update(row, correct=False)
        if row['srs_state'] == 'new':
            upd['srs_state'] = 'new'                      # mai studiata: resta "nuova"
        conn.execute('UPDATE rep_nodes SET srs_state=?, srs_interval=?, srs_ease=?, srs_due=?, '
                     'srs_reps=?, srs_lapses=?, srs_last=? WHERE id=?',
                     (upd['srs_state'], upd['srs_interval'], upd['srs_ease'], upd['srs_due'],
                      upd['srs_reps'], upd['srs_lapses'], upd['srs_last'], node_id))
        conn.execute('INSERT INTO rep_game_flags (game_key, node_id, applied_at) VALUES (?,?,?)',
                     (game_key, node_id, _today()))
    return True


# chess.com chiede agli strumenti esterni di identificarsi con nome e contatto.
USER_AGENT = 'Tessera/1.0 (open-source chess analysis app, local single-user; +https://github.com/grassopher03ux/tessera)'


def fetch_chesscom(username: str, months: int = 2) -> dict:
    import requests
    u = username.strip().lower()
    headers = {'User-Agent': USER_AGENT}
    r = requests.get(f'https://api.chess.com/pub/player/{u}/games/archives',
                     headers=headers, timeout=20)
    if r.status_code == 404:
        return {'ok': False, 'error': f'Utente chess.com "{username}" non trovato'}
    r.raise_for_status()
    archives = r.json().get('archives', [])[-max(1, months):]
    added = total = 0
    with _db() as conn:
        for url in archives:
            a = requests.get(url, headers=headers, timeout=30)
            a.raise_for_status()
            for g in a.json().get('games', []):
                if g.get('rules', 'chess') != 'chess' or not g.get('pgn'):
                    continue
                total += 1
                m = re.search(r'\[Result "([^"]+)"\]', g['pgn'])
                cur = conn.execute(
                    'INSERT OR IGNORE INTO online_games (source, url, pgn, white, black, result, '
                    'end_time, time_class) VALUES (?,?,?,?,?,?,?,?)',
                    ('chess.com', g.get('url', ''), g['pgn'],
                     (g.get('white') or {}).get('username', '?'),
                     (g.get('black') or {}).get('username', '?'),
                     m.group(1) if m else '*', g.get('end_time'), g.get('time_class')))
                added += cur.rowcount
    return {'ok': True, 'added': added, 'seen': total, 'archives': len(archives)}


def suggested_username() -> str:
    """Il nome che compare più spesso nelle partite salvate (probabilmente sei tu)."""
    counts = {}
    with _db() as conn:
        for r in conn.execute('SELECT white, black FROM games'):
            for n in (r['white'], r['black']):
                if n and n != '?':
                    counts[n] = counts.get(n, 0) + 1
    # i nomi che compaiono in almeno 3 partite sono quasi certamente i tuoi account
    mine = [n for n, c in sorted(counts.items(), key=lambda x: -x[1]) if c >= 3]
    return ', '.join(mine)


# ═══════════════════════════════════════════════════════════════════════
#  Rotte
# ═══════════════════════════════════════════════════════════════════════

def register(app, ctx: dict):
    _ctx.update(ctx)
    init_tables()
    try:
        sync_chapters()
    except Exception as ex:                                  # noqa: BLE001
        print(f"[repertorio] openings.json non leggibile: {ex}")

    @app.route('/api/rep/chapters')
    def rep_chapters():
        try:
            defs = sync_chapters()
        except Exception:                                    # noqa: BLE001
            # DB occupato da una costruzione in corso: leggo i capitoli senza riscriverli
            defs = {d['id']: d for d in load_chapter_defs()}
        today = _today()
        out = []
        with _db() as conn:
            for ch in conn.execute('SELECT * FROM rep_chapters ORDER BY sort'):
                stats = conn.execute('''
                    SELECT COUNT(*) AS nodes,
                           SUM(CASE WHEN n.user_to_move=1 AND EXISTS
                                 (SELECT 1 FROM rep_nodes c WHERE c.parent_id=n.id) THEN 1 ELSE 0 END) AS cards,
                           SUM(CASE WHEN n.user_to_move=1 AND n.srs_state='new' AND EXISTS
                                 (SELECT 1 FROM rep_nodes c WHERE c.parent_id=n.id) THEN 1 ELSE 0 END) AS new,
                           SUM(CASE WHEN n.user_to_move=1 AND n.srs_state!='new' AND n.srs_due<=? AND EXISTS
                                 (SELECT 1 FROM rep_nodes c WHERE c.parent_id=n.id) THEN 1 ELSE 0 END) AS due,
                           MAX(n.ply) AS depth
                    FROM rep_nodes n WHERE n.chapter_id=?''', (today, ch['id'])).fetchone()
                board = chess.Board()
                sans = []
                for uci in (ch['root_uci'].split() if ch['root_uci'] else []):
                    mv = chess.Move.from_uci(uci)
                    sans.append(board.san(mv))
                    board.push(mv)
                out.append({**_node_json(ch), 'root_san': sans,
                            'built': bool(ch['built_at']),
                            'nodes': stats['nodes'] or 0, 'cards': stats['cards'] or 0,
                            'new': stats['new'] or 0, 'due': stats['due'] or 0,
                            'depth': stats['depth'] or 0,
                            'new_lines': missing_seeds(conn, defs[ch['id']])
                                         if ch['built_at'] and ch['id'] in defs else 0})
        return jsonify({'chapters': out, 'build': dict(_build_status),
                        'engine': _ctx['get_engine']() is not None,
                        'new_per_day': int(_cfg().get('rep_new_per_day', 10))})

    @app.route('/api/rep/build', methods=['POST'])
    def rep_build():
        data = request.json or {}
        if _ctx['get_engine']() is None:
            return jsonify({'ok': False, 'error': 'Stockfish non disponibile'}), 503
        ids = data.get('chapter_ids')
        if not ids:
            ids = [d['id'] for d in load_chapter_defs()]
        started = _start_job(_run_build, ids, bool(data.get('force')))
        return jsonify({'ok': started, 'build': dict(_build_status)})

    # ── linee studiate (livello 3 fino in fondo): legate alla POSIZIONE finale,
    #    così restano anche quando l'albero viene aggiornato o ricostruito ──
    @app.route('/api/rep/studied', methods=['GET', 'POST'])
    def rep_studied():
        with _db() as conn:
            if request.method == 'POST':
                data = request.json or {}
                items = data.get('items') or [data]
                n = 0
                for it in items:
                    cid, epd = it.get('chapter_id'), it.get('epd')
                    if not epd and it.get('leaf_id'):          # vecchi segni del browser (per id del nodo)
                        r = conn.execute('SELECT epd FROM rep_nodes WHERE id=? AND chapter_id=?',
                                         (it['leaf_id'], cid)).fetchone()
                        epd = r['epd'] if r else None
                    if cid and epd:
                        conn.execute('INSERT OR IGNORE INTO rep_studied (chapter_id, epd, at) VALUES (?,?,?)',
                                     (cid, epd, time.strftime('%Y-%m-%dT%H:%M:%S')))
                        n += 1
                return jsonify({'ok': True, 'saved': n})
            rows = conn.execute('SELECT chapter_id, epd FROM rep_studied').fetchall()
        return jsonify({'studied': [f"{r['chapter_id']}:{r['epd']}" for r in rows]})

    @app.route('/api/rep/merge', methods=['POST'])
    def rep_merge():
        if _ctx['get_engine']() is None:
            return jsonify({'ok': False, 'error': 'Stockfish non disponibile'}), 503
        cid = (request.json or {}).get('chapter_id', '')
        started = _start_job(_run_merge, cid)
        return jsonify({'ok': started, 'build': dict(_build_status)})

    @app.route('/api/rep/build_status')
    def rep_build_status():
        return jsonify(dict(_build_status))

    @app.route('/api/rep/tree/<chapter_id>')
    def rep_tree(chapter_id):
        with _db() as conn:
            ch = conn.execute('SELECT * FROM rep_chapters WHERE id=?', (chapter_id,)).fetchone()
            if not ch:
                return jsonify({'error': 'Capitolo non trovato'}), 404
            nodes = [_node_json(r) for r in conn.execute(
                'SELECT * FROM rep_nodes WHERE chapter_id=? ORDER BY ply, main DESC, weight DESC, id',
                (chapter_id,))]
        return jsonify({'chapter': _node_json(ch), 'nodes': nodes, 'today': _today()})

    @app.route('/api/rep/review', methods=['POST'])
    def rep_review():
        data = request.json or {}
        node_id, correct = int(data.get('node_id', 0)), bool(data.get('correct'))
        with _db() as conn:
            row = conn.execute('SELECT * FROM rep_nodes WHERE id=?', (node_id,)).fetchone()
            if not row:
                return jsonify({'error': 'Nodo non trovato'}), 404
            upd = _srs_update(row, correct)
            conn.execute('UPDATE rep_nodes SET srs_state=?, srs_interval=?, srs_ease=?, srs_due=?, '
                         'srs_reps=?, srs_lapses=?, srs_last=? WHERE id=?',
                         (upd['srs_state'], upd['srs_interval'], upd['srs_ease'], upd['srs_due'],
                          upd['srs_reps'], upd['srs_lapses'], upd['srs_last'], node_id))
        return jsonify({'ok': True, 'node_id': node_id, **upd})

    @app.route('/api/rep/node/<int:node_id>/candidates')
    def rep_candidates(node_id):
        """Mosse di teoria possibili in una tua posizione, con valutazione."""
        with _db() as conn:
            row = conn.execute('SELECT * FROM rep_nodes WHERE id=?', (node_id,)).fetchone()
            ch = conn.execute('SELECT * FROM rep_chapters WHERE id=?',
                              (row['chapter_id'],)).fetchone() if row else None
        if not row or not ch:
            return jsonify({'error': 'Nodo non trovato'}), 404
        board = chess.Board(row['fen'])
        book = _ctx['get_book']()
        cands = []
        for mv in board.legal_moves:
            board.push(mv)
            w = book.get(board.epd(), 0)
            board.pop()
            if w:
                cands.append((mv, w))
        cands.sort(key=lambda x: -x[1])
        cands = cands[:8]
        engine_moves = [m for m, _ in cands]
        # aggiungi anche la migliore del motore se non è teoria
        engine = _ctx['get_engine']()
        if engine is not None:
            with _ctx['engine_lock']:
                info = engine.analyse(board, chess.engine.Limit(depth=int(_cfg().get('rep_build_depth', 12))))
            pv = info.get('pv') or []
            if pv and pv[0] not in engine_moves:
                engine_moves.append(pv[0])
        scores = _analyse_moves(board, engine_moves, int(_cfg().get('rep_build_depth', 12)))
        weights = dict(cands)
        out = []
        for mv in engine_moves:
            cp, mate = _score_fields(scores.get(mv))
            out.append({'uci': mv.uci(), 'san': board.san(mv), 'weight': weights.get(mv, 0),
                        'eval_cp': cp, 'eval_mate': mate,
                        'value': _user_value(cp, mate, ch['color'])})
        out.sort(key=lambda x: -x['value'])
        return jsonify({'node_id': node_id, 'candidates': out})

    @app.route('/api/rep/node/<int:node_id>/set_move', methods=['POST'])
    def rep_set_move(node_id):
        """Cambia la TUA mossa in una posizione: sostituisce il ramo e lo ricostruisce."""
        uci = (request.json or {}).get('uci', '')
        with _db() as conn:
            row = conn.execute('SELECT * FROM rep_nodes WHERE id=?', (node_id,)).fetchone()
        if not row or not row['user_to_move']:
            return jsonify({'error': 'Non è una tua posizione'}), 400
        try:
            mv = chess.Move.from_uci(uci)
            if not chess.Board(row['fen']).is_legal(mv):
                raise ValueError
        except ValueError:
            return jsonify({'error': 'Mossa non valida'}), 400

        def job():
            _build_status.update(running=True, job='set_move', done=0, total=1, nodes=0,
                                 error=None, chapter='')
            try:
                defs = sync_chapters()
                with _db() as conn:
                    conn.execute('PRAGMA foreign_keys=ON')
                    conn.execute('DELETE FROM rep_nodes WHERE parent_id=?', (node_id,))
                    ch = defs.get(row['chapter_id'])
                    b = _Builder(conn, ch)
                    b.max_nodes = b.count + int(_cfg().get('rep_branch_nodes', 60))
                    node = conn.execute('SELECT * FROM rep_nodes WHERE id=?', (node_id,)).fetchone()
                    child = b.get_or_create(node, mv, seeded=1, main=1)
                    b.expand(node)                       # valutazione della nuova mossa
                    b.expand_from([child], progress=lambda n: _build_status.update(nodes=n))
                _build_status['done'] = 1
            except Exception as ex:                          # noqa: BLE001
                _build_status['error'] = str(ex)
            finally:
                _build_status.update(running=False, finished_at=time.time())

        if not _start_job(job):
            return jsonify({'ok': False, 'error': 'Costruzione già in corso'}), 409
        return jsonify({'ok': True})

    @app.route('/api/rep/node/<int:node_id>/comment', methods=['POST'])
    def rep_comment(node_id):
        text = ((request.json or {}).get('text') or '').strip()
        with _db() as conn:
            conn.execute('UPDATE rep_nodes SET comment=?, comment_src=? WHERE id=?',
                         (text or None, 'manual' if text else None, node_id))
        return jsonify({'ok': True})

    @app.route('/api/rep/node/<int:node_id>/explain', methods=['POST'])
    def rep_explain(node_id):
        lang = (request.json or {}).get('lang', 'it')
        with _db() as conn:
            row = conn.execute('SELECT * FROM rep_nodes WHERE id=?', (node_id,)).fetchone()
            if not row:
                return jsonify({'error': 'Nodo non trovato'}), 404
            ch = conn.execute('SELECT * FROM rep_chapters WHERE id=?', (row['chapter_id'],)).fetchone()
            path, cur = [], row
            while cur is not None and cur['move_san']:
                path.append(cur['move_san'])
                cur = conn.execute('SELECT * FROM rep_nodes WHERE id=?', (cur['parent_id'],)).fetchone() \
                    if cur['parent_id'] else None
            kids = conn.execute('SELECT move_san, weight, flag FROM rep_nodes WHERE parent_id=? '
                                'ORDER BY main DESC, weight DESC', (node_id,)).fetchall()
        path.reverse()
        line = ' '.join((f"{i // 2 + 1}. " if i % 2 == 0 else '') + s for i, s in enumerate(path))
        side = 'Bianco' if ch['color'] == 'white' else 'Nero'
        ev = (f"matto in {row['eval_mate']}" if row['eval_mate'] is not None
              else f"{(row['eval_cp'] or 0) / 100:+.2f} (lato Bianco)")
        if row['user_to_move']:
            nxt = 'La mossa del repertorio qui è: ' + ', '.join(k['move_san'] for k in kids)
        else:
            nxt = 'Risposte principali dell\'avversario: ' + ', '.join(
                k['move_san'] + (' (errore da punire)' if k['flag'] == 'punish' else '') for k in kids)
        context = (f"Repertorio del {side}: {ch['name']}. Linea: {line}. "
                   f"Nome della posizione: {row['name'] or 'n.d.'} ({row['eco'] or ''}). "
                   f"Valutazione Stockfish: {ev}. {nxt}. "
                   f"Spiega il piano per il {side} in questa posizione e perché la mossa del repertorio "
                   f"(o la risposta alle mosse avversarie) ha senso. Resta sulle idee, niente varianti lunghe.")
        import sys
        sys.path.insert(0, str(_ctx['bundle_dir']))
        try:
            from openai_comment import get_opening_explanation
        except ImportError:
            return jsonify({'explanation': ''})
        text = get_opening_explanation(_ctx['app_dir'], context, lang=lang)
        if text:
            with _db() as conn:
                conn.execute('UPDATE rep_nodes SET comment=?, comment_src=? WHERE id=?',
                             (text, 'ai', node_id))
        return jsonify({'explanation': text})

    @app.route('/api/rep/settings', methods=['GET', 'POST'])
    def rep_settings():
        cfg = _cfg()
        if request.method == 'POST':
            data = request.json or {}
            if 'chesscom_username' in data:
                cfg['chesscom_username'] = ', '.join(account_list(data['chesscom_username']))
            if 'rep_new_per_day' in data:
                cfg['rep_new_per_day'] = max(1, min(50, int(data['rep_new_per_day'])))
            _ctx['save_config']()
        return jsonify({'chesscom_username': cfg.get('chesscom_username', ''),
                        'suggested_username': suggested_username(),
                        'rep_new_per_day': int(cfg.get('rep_new_per_day', 10))})

    @app.route('/api/rep/games/sync', methods=['POST'])
    def rep_games_sync():
        data = request.json or {}
        names = account_list(data.get('username') or _cfg().get('chesscom_username')
                             or suggested_username())
        if not names:
            return jsonify({'ok': False, 'error': 'Imposta prima il tuo username chess.com'}), 400
        joined = ', '.join(names)
        if joined != _cfg().get('chesscom_username'):
            _cfg()['chesscom_username'] = joined
            _ctx['save_config']()
        total = {'ok': True, 'added': 0, 'seen': 0, 'archives': 0, 'accounts': names, 'errors': []}
        for name in names:                       # un account alla volta
            try:
                r = fetch_chesscom(name, int(data.get('months', 2)))
            except Exception as ex:                          # noqa: BLE001
                r = {'ok': False, 'error': f'{name}: chess.com non raggiungibile ({ex})'}
            if r.get('ok'):
                for k in ('added', 'seen', 'archives'):
                    total[k] += r.get(k, 0)
            else:
                total['errors'].append(r.get('error'))
        if total['errors'] and not total['seen']:
            return jsonify({'ok': False, 'error': ' · '.join(total['errors'])}), 502
        if total['errors']:
            total['error'] = ' · '.join(total['errors'])
        return jsonify(total)

    @app.route('/api/rep/games')
    def rep_games():
        username = ', '.join(usernames())
        if not username:
            return jsonify({'username': '', 'games': [], 'chapters': {}})
        rows = []
        games = _all_games(username)
        checks = checks_for(games, username)
        for g in games:
            res = checks.get(g['key'])
            if res is None:
                continue
            res = dict(res)
            res.update({'key': g['key'], 'source': g['source'], 'url': g['url'] or res['link'],
                        'time_class': g['time_class'], 'local_id': g['local_id'],
                        'end_time': g['end_time']})
            if res['status'] == 'you' and res.get('node_id'):
                res['lapse_applied'] = _apply_lapse(g['key'], res['node_id'])
            rows.append(res)
        rows.sort(key=lambda r: (r['end_time'] or 0, r['date']), reverse=True)
        # statistiche per capitolo
        chapters = {}
        for r in rows:
            cid = r.get('chapter_id') or ''
            s = chapters.setdefault(cid, {'games': 0, 'points': 0.0, 'scored': 0,
                                          'you': 0, 'opp': 0, 'end': 0, 'uncovered': 0})
            s['games'] += 1
            if r.get('score') is not None:
                s['points'] += r['score']
                s['scored'] += 1
            s[r['status']] = s.get(r['status'], 0) + 1
        return jsonify({'username': username, 'games': rows, 'chapters': chapters})

    @app.route('/api/rep/games/<path:key>/pgn')
    def rep_game_pgn(key):
        with _db() as conn:
            if key.startswith('cc:'):
                r = conn.execute('SELECT pgn FROM online_games WHERE url=?', (key[3:],)).fetchone()
                pgn = r['pgn'] if r else None
            elif key.startswith('db:'):
                r = conn.execute('SELECT pgn_text FROM games WHERE id=?', (int(key[3:]),)).fetchone()
                pgn = r['pgn_text'] if r else None
            else:
                pgn = None
        if not pgn:
            return jsonify({'error': 'Partita non trovata'}), 404
        return jsonify({'pgn': pgn})
