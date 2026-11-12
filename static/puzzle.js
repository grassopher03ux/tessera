'use strict';
/* ════════════════════════════════════════════════════════════════
   PUZZLE — i miei blunder diventano esercizi.
   Si parte dalla posizione prima della mossa avversaria (che viene giocata),
   una freccia mostra il blunder che ho fatto, e devo trovare la mossa migliore.
   3 mosse mie; dopo ognuna giusta Stockfish risponde con la sua migliore.
   Usa la scacchiera di app.js (#board, #arrows) ma con la sua partita interna:
   non tocca mainHistory / chess, quindi la partita aperta resta com'era.
   API: /api/puzzles/*  (puzzles.py)
   ════════════════════════════════════════════════════════════════ */
(function () {
  const D = {
    it: {
      navPuzzle: 'Puzzle', crumb: 'Puzzle', find: 'Trova la mossa migliore', moveN: 'Mossa {n} di {m}',
      vs: 'Contro {o} · {d}', playedLow: 'Hai giocato {m}. Si poteva fare molto meglio.', playedHigh: 'Qui hai sbagliato. Trova la mossa giusta.',
      wrong: 'Non è questa. Riprova.', right: 'Giusta!', reply: 'Stockfish risponde {m}.', checking: 'Controllo…', thinking: 'Stockfish sta rispondendo…',
      solved: 'Risolto', solvedMate: 'Risolto: matto!', solvedSub: 'Hai trovato le mosse giuste.', mistakes: 'Errori', hints: 'Hint', moves: 'Mosse',
      hint: 'Hint', hintShow: 'Dove?', diff: 'Difficoltà', low: 'Bassa', high: 'Alta', lowSub: 'con la freccia del blunder', highSub: 'senza freccia',
      next: 'Prossimo ▶', skip: 'Salta ▶', again: 'Rifai', pending: '{n} da risolvere', of: 'su {t}',
      emptyK: 'Nessun puzzle', emptyH: 'Analizza una partita: i miei blunder diventeranno puzzle.', noUser: 'Imposta il mio username chess.com (in Aperture o Statistiche) per riconoscere le mie mosse.',
      gen: 'Cerca nelle partite analizzate', legFree: 'puoi prenderlo gratis', legThreat: 'minaccia dell\'avversario', treeLocked: 'Risolvi i puzzle precedenti per sbloccarlo', treeSolved: 'Risolto', treeN: 'Puzzle {n}',
      doneK: 'Tutti risolti', doneH: 'Ho risolto tutti i puzzle.', doneP: 'Analizza nuove partite per averne altri: quelli più vecchi lasceranno il posto ai nuovi.', replay: 'Rifai dall\'inizio',
      engErr: 'Stockfish non risponde. Riprova tra poco.', netErr: 'Server non raggiungibile.', you: 'Io', opp: 'Avversario',
    },
    en: {
      navPuzzle: 'Puzzle', crumb: 'Puzzle', find: 'Find the best move', moveN: 'Move {n} of {m}',
      vs: 'Against {o} · {d}', playedLow: 'You played {m}. There was a lot better.', playedHigh: 'You went wrong here. Find the right move.',
      wrong: 'Not this one. Try again.', right: 'Correct!', reply: 'Stockfish replies {m}.', checking: 'Checking…', thinking: 'Stockfish is replying…',
      solved: 'Solved', solvedMate: 'Solved: checkmate!', solvedSub: 'You found the right moves.', mistakes: 'Mistakes', hints: 'Hints', moves: 'Moves',
      hint: 'Hint', hintShow: 'Where?', diff: 'Difficulty', low: 'Low', high: 'High', lowSub: 'with the blunder arrow', highSub: 'no arrow',
      next: 'Next ▶', skip: 'Skip ▶', again: 'Retry', pending: '{n} to solve', of: 'of {t}',
      emptyK: 'No puzzles', emptyH: 'Analyze a game: my blunders will become puzzles.', noUser: 'Set my chess.com username (in Openings or Stats) so my moves can be recognised.',
      gen: 'Search the analyzed games', legFree: 'you can take it for free', legThreat: 'opponent\'s threat', treeLocked: 'Solve the previous puzzles to unlock it', treeSolved: 'Solved', treeN: 'Puzzle {n}',
      doneK: 'All solved', doneH: 'I solved every puzzle.', doneP: 'Analyze new games to get more: the oldest ones make room for the new ones.', replay: 'Start over',
      engErr: 'Stockfish is not answering. Try again shortly.', netErr: 'Server not reachable.', you: 'Me', opp: 'Opponent',
    },
  };
  const tr = (k, v = {}) => {
    let s = (D[currentLang] || D.it)[k] ?? D.it[k] ?? k;
    for (const [a, b] of Object.entries(v)) s = s.replace(new RegExp('\\{' + a + '\\}', 'g'), String(b));
    return s;
  };
  const $ = id => document.getElementById(id);
  const esc = s => escHtml(String(s ?? ''));
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function j(path, body) {
    try {
      const r = await fetch(`${API}${path}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => null);
      return d ? { ...d, _status: r.status } : { _status: r.status, ok: false };
    } catch { return { _status: 0, ok: false, _net: true }; }
  }

  const PZ = window.PZ = { active: false };
  const HARD_KEY = 'cr_pz_hard';
  let hard = false;
  try { hard = localStorage.getItem(HARD_KEY) === '1'; } catch { /* nessuna memoria */ }

  // stato del puzzle in corso
  let S = null;           // { p, pc, view, step, wrong, hints, hintLvl, hintMove, busy, over, ready, mate, sel, legal, lastMove, msg, msgKind }
  let mode = 'play';      // 'play' | 'empty' | 'done'
  let sum = null;         // /api/puzzles/summary
  let saved = null;       // stato di app.js da ripristinare alla chiusura
  let token = 0;          // annulla animazioni di un puzzle abbandonato
  let T = [];             // percorso: tutti i puzzle in ordine (dal più vecchio), con solved / locked
  let treeTop = 0;        // posizione di scorrimento del tree
  let treeCenter = true;  // al prossimo disegno porta il puzzle corrente al centro

  // ── apertura / chiusura ─────────────────────────────────────────────
  PZ.open = async function (id) {
    if (window.OP && OP.active) OP.close();
    if (window.ST && ST.active) ST.close();
    if (window.AR && AR.active) AR.close();
    if (window.HM && HM.active) HM.close();
    if (!PZ.active) {
      saved = { flip: isFlipped, meta: $gameMeta.innerHTML };
      PZ.active = true;
      document.body.classList.add('pz-active');
      $('pzBtn')?.setAttribute('aria-current', 'true');
    }
    await loadSummary(); await loadTree();
    treeCenter = true;
    if (id) await startById(id); else await startNext(null);
  };

  PZ.close = function () {
    if (!PZ.active) return;
    token++;
    PZ.active = false;
    S = null;
    document.body.classList.remove('pz-active');
    $('pzBtn')?.removeAttribute('aria-current');
    if (saved) {
      $gameMeta.innerHTML = saved.meta;
      if (isFlipped !== saved.flip) isFlipped = saved.flip;
      saved = null;
    }
    buildLabels();
    renderBoard();
  };

  async function loadSummary() {
    const d = await j('/api/puzzles/summary');
    sum = d && d.total !== undefined ? d : { total: 0, solved: 0, pending: 0, has_username: true };
  }

  async function loadTree() {
    const d = await j('/api/puzzles');
    T = (d && d.puzzles) || [];
  }
  function recalcLocks() {
    let ok = true;
    T.forEach(x => { x.locked = !ok; if (!x.solved) ok = false; });
  }

  async function startById(id) {
    const d = await j(`/api/puzzles/${id}`);
    if (d && d.id) startPuzzle(d);
    else if (d && d.locked) return;                       // bloccato: resta dov'eri
    else showEmpty();
  }

  /** Dopo `after`: il puzzle successivo del percorso se è sbloccato, altrimenti il primo da risolvere. */
  async function startNext(after) {
    const i = T.findIndex(x => x.id === after);
    const nx = i >= 0 ? T[i + 1] : null;
    if (nx && !nx.locked) { treeCenter = true; return startById(nx.id); }
    const d = await j('/api/puzzles/next');
    treeCenter = true;
    if (d && d.puzzle) startPuzzle(d.puzzle);
    else if (d && d.done) showDone();
    else showEmpty();
  }

  function setCrumb(p) {
    $gameMeta.innerHTML = `<b>${esc(tr('crumb'))}</b>` + (p ? ` · ${esc(tr('vs', { o: p.opponent || '?', d: fmtDate(p.game_date) }))}` : '');
  }

  function fmtDate(d) {
    const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(d || '');
    if (!m) return '';
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(currentLang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short' });
  }

  function showEmpty() {
    mode = 'empty'; S = null; token++;
    setCrumb(null); drawCol(); clearBoardState();
  }
  function showDone() {
    mode = 'done'; S = null; token++;
    setCrumb(null); drawCol(); clearBoardState();
  }
  function clearBoardState() {
    const c = new Chess();
    S = { empty: true, pc: c, step: 1, sel: null, legal: [], busy: true, over: false };
    isFlipped = false; buildLabels(); renderBoard();
  }

  // ── puzzle ──────────────────────────────────────────────────────────
  async function startPuzzle(p) {
    const my = ++token;
    mode = 'play';
    S = {
      p, pc: new Chess(), view: null, step: 1, wrong: 0, hints: 0, hintLvl: 0, hintMove: null,
      busy: true, over: false, ready: false, mate: false, sel: null, legal: [], lastMove: null,
      msg: '', msgKind: '',
    };
    isFlipped = p.color === 'black';
    buildLabels();
    setCrumb(p);
    const first = p.start_fen && p.prev_uci;
    S.pc.load(first ? p.start_fen : p.fen);
    renderBoard(); drawCol();
    if (first) {
      await wait(650);
      if (my !== token) return;
      const mv = S.pc.move({ from: p.prev_uci.slice(0, 2), to: p.prev_uci.slice(2, 4), promotion: p.prev_uci[4] || undefined });
      if (mv) {
        SFX.playMove(mv);
        S.lastMove = { from: mv.from, to: mv.to };
        S.pc.load(p.fen);                        // la posizione salvata è la verità (en-passant, contatori)
        renderBoard({ anim: { from: mv.from, to: mv.to } });
        await wait(380);
        if (my !== token) return;
      } else {
        S.pc.load(p.fen);
      }
    }
    S.pc.load(p.fen);
    S.ready = true; S.busy = false;
    renderBoard(); drawCol();
  }

  // ── scacchiera ──────────────────────────────────────────────────────
  PZ.render = function (opts) {
    if (!S) { $board.innerHTML = ''; return; }
    renderBoardPZ(opts || {});
  };

  function renderBoardPZ(opts) {
    const pos = S.view || S.pc;
    $board.innerHTML = '';
    fitBoard();
    const lm = S.view ? null : S.lastMove;
    const hintSq = S.hintLvl >= 1 && S.hintMove ? S.hintMove.from : null;
    let animImg = null;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const fileIdx = isFlipped ? 7 - col : col;
        const rankIdx = isFlipped ? row : 7 - row;
        const sq = 'abcdefgh'[fileIdx] + (rankIdx + 1);
        const div = document.createElement('div');
        div.className = 'square ' + ((fileIdx + rankIdx) % 2 === 1 ? 'light' : 'dark');
        div.dataset.sq = sq;
        if (lm) {
          if (sq === lm.from) div.classList.add('last-from');
          if (sq === lm.to) div.classList.add('last-to');
        }
        if (sq === S.sel) div.classList.add('selected');
        if (sq === hintSq && !S.view) div.classList.add('pz-hint');
        const piece = pos.get(sq);
        if (piece) {
          div.classList.add('has-piece');
          const img = document.createElement('img');
          img.className = 'piece' + (piece.type === 'p' ? ' piece-pawn' : '');
          img.src = '/static/pieces/' + PIECE_MAP[piece.color + piece.type] + '.svg';
          img.draggable = false;
          if (S.dragFrom === sq) img.classList.add('pz-dragsrc');
          if (opts.bad && opts.bad === sq) img.classList.add('pz-bad');
          if (opts.anim && opts.anim.to === sq) animImg = img;
          div.appendChild(img);
        }
        if (S.legal.some(m => m.to === sq) && !S.view) div.classList.add('legal-dest');
        $board.appendChild(div);
      }
    }
    if (animImg) slide(animImg, opts.anim.from, opts.anim.to, opts.anim.red);
    renderArrows();
    PZ.strips();
  }

  /** Il pezzo parte dalla casa `from` e scivola in `to` (FLIP). `red`: parte rosso e torna al suo colore. */
  function slide(img, from, to, red) {
    const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sq')) || 64;
    const pos = sq => ({ c: 'abcdefgh'.indexOf(sq[0]), r: +sq[1] - 1 });
    const a = pos(from), b = pos(to);
    const dx = (a.c - b.c) * (isFlipped ? -1 : 1) * s;
    const dy = (a.r - b.r) * (isFlipped ? 1 : -1) * s;
    img.style.transition = 'none';
    img.style.transform = `translate(${dx}px, ${dy}px)`;
    if (red) img.classList.add('pz-bad');
    void img.offsetWidth;                                  // forza il layout: parte da qui
    img.style.transition = '';
    img.classList.add('pz-anim');
    img.style.transform = '';
    if (red) img.classList.remove('pz-bad');
  }

  PZ.drawArrows = function () {
    if (!S || !S.p || S.view || !S.ready) return;
    const p = S.p;
    if (!hard && S.step === 1 && !S.over) {
      svgArrow(p.played_uci.slice(0, 2), p.played_uci.slice(2, 4), cssVar('--arrow-red', 'rgba(178,58,42,.85)'), 7);
    }
    if (S.warn) {
      S.warn.forEach(a => svgArrow(a.from, a.to, a.kind === 'free' ? cssVar('--pz-free', 'rgba(47,125,76,.88)') : cssVar('--pz-threat', 'rgba(214,126,32,.9)'), 6));
    }
    if (S.hintLvl >= 2 && S.hintMove) {
      svgArrow(S.hintMove.from, S.hintMove.to, cssVar('--arrow-green', 'rgba(51,46,46,.9)'), 8);
    }
  };

  PZ.strips = function () {
    if (!S || !S.p) return;
    const mine = S.p.color, theirs = mine === 'white' ? 'black' : 'white';
    const paint = (sw, nm, ac, side, name) => {
      const a = $(sw), b = $(nm), c = $(ac);
      if (a) a.className = 'sw sw-' + side;
      if (b) b.innerHTML = esc(name);
      if (c) c.hidden = true;
    };
    // la scacchiera è sempre orientata dal mio lato: io in basso
    paint('swBot', 'nameBot', 'accBot', mine, tr('you'));
    paint('swTop', 'nameTop', 'accTop', theirs, S.p.opponent || tr('opp'));
    if ($('capTop')) $('capTop').innerHTML = '';
    if ($('capBot')) $('capBot').innerHTML = '';
  };

  // ── input: click-click e drag & drop ────────────────────────────────
  let drag = null;       // { from, x0, y0, started, ghost }

  function canMove() { return PZ.active && S && S.p && S.ready && !S.busy && !S.over; }

  function select(sq) {
    S.sel = sq;
    S.legal = S.pc.moves({ square: sq, verbose: true });
    renderBoard();
  }
  function deselect() { S.sel = null; S.legal = []; }

  $board.addEventListener('pointerdown', e => {
    if (!canMove() || e.button !== 0) return;
    const sq = squareFromEvent(e);
    if (!sq) return;
    if (S.sel && S.legal.some(m => m.to === sq)) {            // secondo click: destinazione
      const from = S.sel; deselect(); e.preventDefault();
      attempt(from, sq, false);
      return;
    }
    const piece = S.pc.get(sq);
    if (piece && piece.color === S.pc.turn()) {
      e.preventDefault();
      drag = { from: sq, x0: e.clientX, y0: e.clientY, started: false, ghost: null };
      select(sq);
    } else if (S.sel) {
      deselect(); renderBoard();
    }
  });

  document.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.started) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      const pc = S.pc.get(drag.from);
      if (!pc) { drag = null; return; }
      drag.started = true;
      const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sq')) || 64;
      const g = document.createElement('img');
      g.className = 'pz-ghost';
      g.src = '/static/pieces/' + PIECE_MAP[pc.color + pc.type] + '.svg';
      g.style.width = g.style.height = Math.round(s * 0.98) + 'px';
      document.body.appendChild(g);
      drag.ghost = g;
      S.dragFrom = drag.from;
      renderBoard();
    }
    drag.ghost.style.left = e.clientX + 'px';
    drag.ghost.style.top = e.clientY + 'px';
  });

  function endDrag(e, cancel) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    S && (S.dragFrom = null);
    if (!d.started || !S) return;                             // era un click: resta la selezione
    const to = cancel ? null : squareFromEvent(e);
    if (to && to !== d.from && S.legal.some(m => m.to === to)) {
      deselect();
      attempt(d.from, to, true);
    } else {
      renderBoard();                                          // lasciato fuori o su casa illegale: torna al posto
    }
  }
  document.addEventListener('pointerup', e => endDrag(e, false));
  document.addEventListener('pointercancel', e => endDrag(e, true));

  // ── tentativo di mossa ──────────────────────────────────────────────
  async function attempt(from, to, dropped) {
    const my = token;
    const mvInfo = S.pc.moves({ square: from, verbose: true }).find(m => m.to === to);
    if (!mvInfo) { renderBoard(); return; }
    const promo = mvInfo.flags.includes('p') ? 'q' : undefined;
    const uci = from + to + (promo || '');
    S.busy = true; S.warn = null;
    setMsg(tr('checking'), '');
    // posizione provvisoria: il pezzo sta già sulla destinazione
    const view = new Chess(S.pc.fen());
    view.move({ from, to, promotion: promo });
    S.view = view;
    renderBoard(dropped ? {} : { anim: { from, to } });
    drawCol();

    const r = await j(`/api/puzzles/${S.p.id}/check`, { fen: S.pc.fen(), move: uci, step: S.step });
    if (my !== token) return;

    if (!r || r.ok === false || r.correct === undefined) {   // errore del motore / rete
      await wait(250);
      if (my !== token) return;
      S.view = null; S.busy = false;
      setMsg(r && r._net ? tr('netErr') : tr('engErr'), 'bad');
      renderBoard({ anim: { from: to, to: from } }); drawCol();
      return;
    }

    if (!r.correct) {                                         // sbagliata: rossa, poi torna indietro
      S.wrong++;
      S.warn = (r.arrows && r.arrows.length) ? r.arrows : null;
      renderBoard({ bad: to });
      const img = $board.querySelector(`[data-sq="${to}"] .piece`);
      if (img) img.classList.add('pz-bad');
      setMsg(tr('wrong'), 'bad');
      drawCol();
      await wait(520);
      if (my !== token) return;
      S.view = null; S.busy = false;
      renderBoard({ anim: { from: to, to: from, red: true } });
      drawCol();
      return;
    }

    // giusta
    const res = S.pc.move({ from, to, promotion: promo });
    S.view = null;
    SFX.playMove(res);
    S.lastMove = { from: res.from, to: res.to };
    S.hintLvl = 0; S.hintMove = null; S.warn = null;
    renderBoard(dropped ? {} : { anim: { from, to } });

    if (r.finished && !r.reply) { await finish(r.reason === 'checkmate', my); return; }
    S.step++;
    setMsg(tr('right') + (r.reply ? ' ' + tr('thinking') : ''), 'ok');
    drawCol();

    if (r.reply) {
      await wait(560);
      if (my !== token) return;
      const rv = S.pc.move({ from: r.reply.uci.slice(0, 2), to: r.reply.uci.slice(2, 4), promotion: r.reply.uci[4] || undefined });
      if (rv) {
        SFX.playMove(rv);
        S.lastMove = { from: rv.from, to: rv.to };
        renderBoard({ anim: { from: rv.from, to: rv.to } });
      }
      if (r.finished) { await wait(300); await finish(r.reason === 'checkmate', my); return; }
    }
    S.busy = false;
    setMsg(tr('right') + (r.reply ? ' ' + tr('reply', { m: r.reply.san }) : ''), 'ok');
    renderBoard(); drawCol();
  }

  async function finish(mate, my) {
    S.over = true; S.mate = mate; S.busy = true;
    if (mate) S.step = Math.min(S.step, 3);
    renderBoard();
    setMsg('', '');
    drawCol();
    const r = await j(`/api/puzzles/${S.p.id}/result`, { solved: true, wrong: S.wrong, hints: S.hints, hard });
    if (my !== token) return;
    if (r && r.ok && sum) {
      if (!S.p.solved) sum.solved++;
      sum.pending = Math.max(0, sum.total - sum.solved); S.p.solved = true; badge();
      const t = T.find(x => x.id === S.p.id); if (t) { t.solved = true; recalcLocks(); }
    }
    drawCol();
  }

  // ── hint a due livelli ──────────────────────────────────────────────
  async function hint() {
    if (!canMove() || S.hintLvl >= 2) return;
    if (S.hintLvl === 0) {
      S.busy = true; drawCol();
      const my = token;
      const r = await j(`/api/puzzles/${S.p.id}/hint`, { fen: S.pc.fen() });
      if (my !== token) return;
      S.busy = false;
      if (!r || !r.ok) { setMsg(r && r._net ? tr('netErr') : tr('engErr'), 'bad'); drawCol(); return; }
      S.hintMove = { from: r.from, to: r.to };
      S.hintLvl = 1; S.hints++;
      deselect();
      renderBoard();
    } else {
      S.hintLvl = 2; S.hints++;
      renderBoard();
    }
    drawCol();
  }

  function setDifficulty(h) {
    hard = h;
    try { localStorage.setItem(HARD_KEY, h ? '1' : '0'); } catch { /* ok */ }
    if (S && !S.empty) { renderBoard(); }
    drawCol();
  }

  function setMsg(text, kind) { if (S) { S.msg = text; S.msgKind = kind; } }

  // ── colonna di sinistra ─────────────────────────────────────────────
  function drawCol() {
    const el = $('pzCol');
    if (!el) return;
    const old = $('pzTree'); if (old) treeTop = old.scrollTop;
    if (mode === 'empty') {
      el.innerHTML = `<div class="gc-step"><div class="gc-stp"><span class="gc-lab">${esc(tr('crumb'))}</span></div></div>` +
        `<div class="gc-body tall"><span class="gc-k">${esc(tr('emptyK'))}</span><div class="gc-h1">${esc(tr('emptyH'))}</div>` +
        `${sum && sum.has_username === false ? `<p class="gc-p">${esc(tr('noUser'))}</p>` : ''}` +
        `<div class="gc-row"><button class="gc-btn pri" data-a="gen">${esc(tr('gen'))}</button></div></div>`;
      return;
    }
    if (mode === 'done') {
      el.innerHTML = `<div class="gc-step"><div class="gc-stp"><span class="gc-lab">${esc(tr('crumb'))}</span></div></div>` +
        `<div class="gc-body"><span class="gc-k">${esc(tr('doneK'))}</span><div class="gc-h1">${esc(tr('doneH'))}</div>` +
        `<p class="gc-p">${esc(tr('doneP'))}</p></div><div class="pz-tree" id="pzTree"></div>` +
        `<div class="pz-foot one"><button class="gc-btn pri" data-a="replay">${esc(tr('replay'))}</button></div>`;
      paintTree();
      return;
    }
    if (!S || !S.p) { el.innerHTML = ''; return; }
    const p = S.p, steps = p.steps || 3;
    const doneN = S.over ? steps : S.step - 1;
    const segs = Array.from({ length: steps }, (_, i) => `<span class="gc-seg${i < doneN ? ' on' : ''}"></span>`).join('');
    const pend = sum ? tr('pending', { n: sum.pending }) : '';
    const head = `<div class="gc-step"><div class="gc-stp"><span class="gc-lab">${esc(S.over ? tr('solved') : tr('moveN', { n: S.step, m: steps }))}${pend ? ' · ' + esc(pend) : ''}</span><div class="gc-segs">${segs}</div></div></div>`;
    const stats = (S.over ? `<div><b>${steps}</b><span>${esc(tr('moves'))}</span></div>` : '') +
      `<div><b>${S.wrong}</b><span>${esc(tr('mistakes'))}</span></div><div><b>${S.hints}</b><span>${esc(tr('hints'))}</span></div>`;
    const who = esc(tr('vs', { o: p.opponent || '?', d: fmtDate(p.game_date) }));
    let body, foot;
    if (S.over) {
      body = `<div class="gc-body"><span class="gc-k">${who}</span><div class="gc-h1">${esc(S.mate ? tr('solvedMate') : tr('solved'))}</div>` +
        `<div class="pz-stats">${stats}</div></div>`;
      foot = `<div class="pz-foot two"><button class="gc-btn ter" data-a="again">${esc(tr('again'))}</button><button class="gc-btn pri" data-a="next">${esc(tr('next'))}</button></div>`;
    } else {
      const playedTxt = hard ? tr('playedHigh') : tr('playedLow', { m: p.played_san });
      const leg = S.warn ? `<div class="pz-leg">${S.warn.some(a => a.kind === 'free') ? `<span class="f"><i></i>${esc(tr('legFree'))}</span>` : ''}${S.warn.some(a => a.kind === 'threat') ? `<span class="t"><i></i>${esc(tr('legThreat'))}</span>` : ''}</div>` : '';
      body = `<div class="gc-body"><span class="gc-k">${who}</span>` +
        `<div class="gc-h1">${esc(tr('find'))}</div><p class="gc-p">${esc(S.ready ? playedTxt : '')}</p>` +
        `<div class="pz-fb ${S.msgKind || ''}">${esc(S.msg || '')}</div>${leg}` +
        `<div class="pz-stats">${stats}</div></div>`;
      const dis = !canMove() || S.hintLvl >= 2 ? ' disabled' : '';
      const hintLbl = S.hintLvl === 0 ? tr('hint') : S.hintLvl === 1 ? `${tr('hint')} · ${tr('hintShow')}` : `${tr('hint')} ✓`;
      foot = `<div class="pz-foot two"><button class="gc-btn pri" data-a="hint"${dis}>${esc(hintLbl)}</button>` +
        `<button class="gc-btn pz-diff" data-a="diff" aria-pressed="${hard}"><span class="gc-k">${esc(tr('diff'))}</span><b>${esc(hard ? tr('high') : tr('low'))}</b><small>${esc(hard ? tr('highSub') : tr('lowSub'))}</small></button></div>`;
    }
    el.innerHTML = head + body + `<div class="pz-tree" id="pzTree"></div>` + foot;
    paintTree();
  }

  // ── percorso: prismi in assonometria militare su una griglia a rombi ──
  // ogni tessera sta al centro di una casella; zig-zag regolare centro · destra · centro · sinistra; il pedone segna dove sono
  function paintTree() {
    const box = $('pzTree');
    if (!box) return;
    if (!T.length) { box.innerHTML = ''; return; }
    const W = 740, X0 = W / 2, R = 76, TOP = 196, HW = 50, HH = 50, TH = 18, ZZ = [0, 1, 0, -1];
    const pos = i => ({ x: X0 + ZZ[i % 4] * R, y: TOP + i * R });
    const H = TOP + (T.length - 1) * R + 130;
    const curId = S && S.p ? S.p.id : null;
    const f = n => n.toFixed(1);
    const pl = a => a.map(q => f(q[0]) + ',' + f(q[1])).join(' ');
    let threads = '', tiles = '', pawn = '';
    // griglia di fondo: quadrati ruotati di 45°, a due toni per righe
    for (let r = -3; r <= T.length + 1; r++) {
      for (let k = -5; k <= 5; k++) {
        if ((r + k) % 2 !== 0) continue;
        const gx = X0 + k * R, gy = TOP + r * R;
        threads += `<polygon class="pzg${((r % 2) + 2) % 2 ? ' b' : ''}" points="${pl([[gx, gy - R], [gx + R, gy], [gx, gy + R], [gx - R, gy]])}"/>`;
      }
    }
    T.forEach((q, i) => {
      const { x, y } = pos(i);
      const st = q.solved ? 'solved' : q.locked ? 'locked' : 'open';
      const cur = q.id === curId;
      const N = [x, y - HH], E = [x + HW, y], S2 = [x, y + HH], Wv = [x - HW, y];
      const dn = a => [a[0], a[1] + TH];
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const P = (u, w) => [N[0] + u * (E[0] - N[0]) + w * (Wv[0] - N[0]), N[1] + u * (E[1] - N[1]) + w * (Wv[1] - N[1])];
      const cellsD = [[0, 1], [1, 0]].map(([a, b]) => `<polygon class="ce" points="${pl([P(a / 2, b / 2), P((a + 1) / 2, b / 2), P((a + 1) / 2, (b + 1) / 2), P(a / 2, (b + 1) / 2)])}"/>`).join('');
      const mL = mid(Wv, S2), mR = mid(S2, E);
      const sil = `M${pl([Wv, N, E, dn(E), dn(S2), dn(Wv)]).replace(/ /g, ' L')} Z`;
      const shadow = pl([[Wv[0] - 4, Wv[1] + TH + 6], [S2[0], S2[1] + TH + 12], [E[0] + 4, E[1] + TH + 6], [N[0], N[1] + TH + 6]]);
      const mark = q.solved
        ? `<path class="pzt-ck" d="M${f(x - 13)} ${f(y + 0.7)} L${f(x - 3.9)} ${f(y + 9.1)} L${f(x + 14.3)} ${f(y - 10.4)}"/>`
        : `<text class="pzt-n" x="${x}" y="${y + 10}" text-anchor="middle">${q.idx || i + 1}</text>`;
      tiles += `<g class="pzt ${st}${cur ? ' cur' : ''}" data-id="${q.id}" tabindex="${q.locked ? -1 : 0}" role="button" aria-label="${esc(tr('treeN', { n: q.idx || i + 1 }))}${q.locked ? ' · ' + esc(tr('treeLocked')) : q.solved ? ' · ' + esc(tr('treeSolved')) : ''}">` +
        `<title>${esc(tr('treeN', { n: q.idx || i + 1 }))} · ${esc(q.opponent || '')} · ${esc(fmtDate(q.game_date))}${q.locked ? ' · ' + esc(tr('treeLocked')) : ''}</title>` +
        `<polygon class="sh" points="${shadow}"/>` +
        `<polygon class="sl" points="${pl([Wv, S2, dn(S2), dn(Wv)])}"/><polygon class="sr" points="${pl([E, S2, dn(S2), dn(E)])}"/>` +
        `<polygon class="sb" points="${pl([Wv, mL, dn(mL), dn(Wv)])}"/><polygon class="sb" points="${pl([mR, E, dn(E), dn(mR)])}"/>` +
        `<polygon class="t" points="${pl([N, E, S2, Wv])}"/>${cellsD}` +
        `<path class="ol" d="${sil}"/><path class="ng" d="${sil}"/><path class="nc" d="${sil}"/>${mark}</g>`;
      if (cur) {
        // solo il pedone, 2.5x, con la freccia sotto che punta alla tessera; la punta tocca il centro del bordo alto
        pawn = `<g transform="translate(${f(x)},${f(y - HH - 4)}) scale(2.5) translate(-28,-60)"><g class="pzt-pawn">` +
          `<g class="po"><circle cx="28" cy="17" r="6.5"/><path d="M20 38 L22 30 Q28 25 34 30 L36 38 Z"/><rect x="18" y="37" width="20" height="4.5" rx="2"/><path d="M20 49 L28 60 L36 49 Z"/></g>` +
          `<path class="pf" d="M20 49 L28 60 L36 49 Z"/><circle class="pf" cx="28" cy="17" r="6.5"/><path class="pf" d="M20 38 L22 30 Q28 25 34 30 L36 38 Z"/><rect class="pf" x="18" y="37" width="20" height="4.5" rx="2"/></g></g>`;
      }
    });
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="overflow:visible" aria-label="Percorso puzzle">${threads}${tiles}${pawn}</svg>`;
    if (treeCenter && curId) {
      const i = T.findIndex(x => x.id === curId);
      if (i >= 0) box.scrollTop = Math.max(0, pos(i).y - box.clientHeight / 2);
      treeCenter = false;
    } else box.scrollTop = treeTop;
  }

  $('pzCol')?.addEventListener('click', ev => {
    const t = ev.target.closest('.pzt');
    if (!t) return;
    const q = T.find(x => x.id === +t.dataset.id);
    if (!q || q.locked) return;
    if (S && S.p && S.p.id === q.id) return;
    startById(q.id);
  });

  $('pzCol')?.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-a]');
    if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'hint') hint();
    else if (a === 'diff') setDifficulty(!hard);
    else if (a === 'next') { const id = S && S.p ? S.p.id : null; await loadSummary(); startNext(id); }
    else if (a === 'again') { if (S && S.p) startById(S.p.id); }
    else if (a === 'replay') {
      const d = await j('/api/puzzles');
      if (d && d.puzzles && d.puzzles.length) { await loadTree(); treeCenter = true; startPuzzle(d.puzzles[0]); }
    } else if (a === 'gen') {
      await j('/api/puzzles/generate', {});
      await loadSummary(); await loadTree();
      startNext(null);
    }
  });

  PZ.translate = () => { if (PZ.active) { if (S && S.p) setCrumb(S.p); else setCrumb(null); drawCol(); } };

  // ── collegamenti con il resto dell'app ──────────────────────────────
  function wire() {
    const btn = $('pzBtn');
    if (btn) btn.onclick = () => PZ.open();
    // le altre schermate chiudono i puzzle quando si aprono
    ['OP', 'ST', 'HM', 'AR'].forEach(n => {
      const m = window[n];
      if (!m || !m.open || m.open._pz) return;
      const o = m.open;
      m.open = function (...a) { if (PZ.active) PZ.close(); return o.apply(this, a); };
      m.open._pz = true;
    });
    ['navGame', 'navHome', 'gamesBtn', 'settingsBtn'].forEach(id => {
      const b = $(id);
      if (b) b.addEventListener('click', () => PZ.close(), true);
    });
    // badge: puzzle ancora da risolvere
    loadSummary().then(() => badge());
  }
  function badge() {
    const b = $('pzBadge');
    if (!b) return;
    const n = sum ? sum.pending : 0;
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
  }
  PZ.refreshBadge = async () => { await loadSummary(); badge(); };
  wire();
})();
