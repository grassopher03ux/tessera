'use strict';
/* ════════════════════════════════════════════════════════════════
   HOME — "cosa faccio oggi": ultima partita · carte da ripassare · progressi.
   Solo lettura delle API esistenti (/api/games, /api/rep/*, /api/insights/data).
   ════════════════════════════════════════════════════════════════ */
(function () {
  const D = {
    it: {
      home: 'Home', morning: 'Buongiorno', afternoon: 'Buon pomeriggio', evening: 'Buonasera', three: 'Tre cose per oggi',
      game: 'Partita', lastGame: 'Ultima partita · {d}', vs: 'contro {o}', accuracy: 'precisione {a}%', keyN: '{n} momenti chiave', keyOne: '1 momento chiave', review: 'Rivedi la partita ▶',
      noGame: 'Nessuna partita salvata', noGameP: 'Importa un PGN dall\'Archivio: qui comparirà la tua ultima partita.', openArchive: 'Apri l\'Archivio ▶', cleanGame: 'Nessun errore grave', lostMove: 'mossa persa',
      openings: 'Aperture', reviewDue: 'Ripasso in scadenza', cards: 'carte', dueNew: '{d} da ripassare · {n} nuove', yourMove: 'La mia mossa · {m}?', reviewN: 'Ripassa · {n} ▶',
      nothing: 'Niente da ripassare oggi', nothingP: 'Torna domani o esplora l\'albero del repertorio.', explore: 'Esplora ▶',
      puzzle: 'Puzzle', pzSide: 'Dai miei errori', pzWord: 'da risolvere', pzSub: '{s} risolti su {t}', pzFind: 'Trova la mossa migliore', pzVs: 'contro {o}', pzSolve: 'Risolvi · {n} ▶', pzOpen: 'Apri ▶', pzTot: '{t} in archivio',
      pzNone: 'Nessun puzzle ancora', pzNoneP: 'I miei blunder nelle partite analizzate diventeranno puzzle.', pzNoUser: 'Username mancante', pzNoUserP: 'Imposta il mio username chess.com (in Aperture o Statistiche) per riconoscere le mie mosse.', pzDone: 'Tutti risolti', pzDoneP: 'Analizza nuove partite per averne altri.',
      stats: 'Statistiche', progress: 'Progressi · {tc}', avgAcc: 'Precisione media', cmp: 'Ultime {w} partite contro le {w} prima', before: 'Prima', now: 'Ora', better: 'meglio', worse: 'peggio', same: 'uguale',
      openStats: 'Apri le Statistiche ▶', noStats: 'Ancora pochi dati', noStatsP: 'Servono almeno 6 partite analizzate.', beforeLbl: 'Prima · {a}', nowLbl: 'Ora · {a}',
    },
    en: {
      home: 'Home', morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening', three: 'Three things for today',
      game: 'Game', lastGame: 'Last game · {d}', vs: 'vs {o}', accuracy: 'accuracy {a}%', keyN: '{n} key moments', keyOne: '1 key moment', review: 'Review game ▶',
      noGame: 'No saved games', noGameP: 'Import a PGN from the Archive: my last game will show up here.', openArchive: 'Open the Archive ▶', cleanGame: 'No big mistakes', lostMove: 'move lost',
      openings: 'Openings', reviewDue: 'Review due', cards: 'cards', dueNew: '{d} due · {n} new', yourMove: 'My move · {m}?', reviewN: 'Review · {n} ▶',
      nothing: 'Nothing to review today', nothingP: 'Come back tomorrow or explore the repertoire tree.', explore: 'Explore ▶',
      puzzle: 'Puzzle', pzSide: 'From my mistakes', pzWord: 'to solve', pzSub: '{s} solved of {t}', pzFind: 'Find the best move', pzVs: 'against {o}', pzSolve: 'Solve · {n} ▶', pzOpen: 'Open ▶', pzTot: '{t} in total',
      pzNone: 'No puzzles yet', pzNoneP: 'My blunders in analyzed games will become puzzles.', pzNoUser: 'Username missing', pzNoUserP: 'Set my chess.com username (in Openings or Stats) so my moves can be recognised.', pzDone: 'All solved', pzDoneP: 'Analyze new games to get more.',
      stats: 'Stats', progress: 'Progress · {tc}', avgAcc: 'Average accuracy', cmp: 'Last {w} games compared with the {w} before', before: 'Before', now: 'Now', better: 'better', worse: 'worse', same: 'same',
      openStats: 'Open Stats ▶', noStats: 'Not enough data yet', noStatsP: 'At least 6 analyzed games are needed.', beforeLbl: 'Before · {a}', nowLbl: 'Now · {a}',
    },
  };
  const tr = (k, v = {}) => {
    let s = (D[currentLang] || D.it)[k] ?? D.it[k] ?? k;
    for (const [a, b] of Object.entries(v)) s = s.replace(new RegExp('\\{' + a + '\\}', 'g'), String(b));
    return s;
  };
  const $ = id => document.getElementById(id);
  const esc = s => escHtml(String(s ?? ''));
  const j = async (p, body) => {
    try { return await (await fetch(`${API}${p}`, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); }
    catch { return null; }
  };

  const HM = window.HM = { active: false, meta: '', token: 0 };

  HM.open = function () {
    if (window.OP && OP.active) OP.close();
    if (window.ST && ST.active) ST.close();
    if (window.AR && AR.active) AR.close();
    if (!HM.active) HM.meta = $gameMeta.innerHTML;
    HM.active = true;
    document.body.classList.add('hm-active');
    $('navHome').setAttribute('aria-current', 'true');
    $gameMeta.innerHTML = `<b>${esc(tr('home'))}</b>`;
    HM.refresh();
  };
  HM.close = function () {
    if (!HM.active) return;
    HM.active = false;
    document.body.classList.remove('hm-active');
    $('navHome').removeAttribute('aria-current');
    $gameMeta.innerHTML = HM.meta;
    if (typeof fitBoard === 'function') { fitBoard(); renderArrows(); renderMoveBadge(); }
  };

  // ── mini scacchiera ───────────────────────────────────────────────
  function boardHTML(fen, flip, last, badge) {
    const rows = fen.split(' ')[0].split('/');
    const grid = [];
    rows.forEach(r => { const row = []; for (const ch of r) { if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) row.push(null); else row.push(ch); } grid.push(row); });
    let cells = '';
    for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
      const r = flip ? 7 - rr : rr, c = flip ? 7 - cc : cc;
      const p = grid[r][c], name = 'abcdefgh'[c] + (8 - r);
      const light = (r + c) % 2 === 0;
      const cls = (light ? 'l' : 'd') + (last && last.to === name ? ' to' : last && last.from === name ? ' fr' : '');
      cells += `<i class="${cls}">${p ? `<img src="/static/pieces/${PIECE_MAP[(p === p.toUpperCase() ? 'w' : 'b') + p.toLowerCase()]}.svg" alt="">` : ''}</i>`;
    }
    let b = '';
    if (badge && last) {
      const f = 'abcdefgh'.indexOf(last.to[0]), rk = +last.to[1] - 1;
      const col = flip ? 7 - f : f, row = flip ? rk : 7 - rk;
      b = `<div class="hm-mb" style="left:${col * 12.5}%;top:${row * 12.5}%"><span class="cb ${badge}">${MOVE_META[badge].symbol}</span></div>`;
    }
    return `<div class="hm-bd"><div class="g">${cells}</div>${b}</div>`;
  }

  // ── blocco 01: ultima partita, mossa peggiore ──
  async function gameBlock(g) {
    if (!g) return { html: `<div class="hm-empty"><b>${esc(tr('noGame'))}</b><p>${esc(tr('noGameP'))}</p></div>`, foot: `<button class="gc-btn pri" data-a="archive">${esc(tr('openArchive'))}</button>` };
    const mine = g.mine || 'w';
    const opp = mine === 'w' ? g.black : g.white;
    let worst = null;
    const pgnRes = await j(`/api/games/${g.id}/pgn`);
    if (pgnRes && pgnRes.pgn) {
      const chk = await j('/api/check_game', { pgn_text: pgnRes.pgn, white: g.white, black: g.black, event: g.event, date: g.date, result: g.result });
      const tmp = new Chess();
      if (chk && chk.results && tmp.load_pgn(normalizePgn(pgnRes.pgn), { sloppy: true })) {
        const hist = tmp.history({ verbose: true }), c = new Chess(), fens = [c.fen()];
        for (const mv of hist) { c.move({ from: mv.from, to: mv.to, promotion: mv.promotion }); fens.push(c.fen()); }
        for (let p = 1; p < fens.length; p++) {
          if (fens[p - 1].split(' ')[1] !== mine) continue;
          const b = winPctFor(mine, chk.results[p - 1] && chk.results[p - 1].evaluation, fens[p - 1]);
          const a = winPctFor(mine, chk.results[p] && chk.results[p].evaluation, fens[p]);
          if (b === null || a === null) continue;
          const drop = b - a;
          if (!worst || drop > worst.drop) worst = { p, drop, fen: fens[p], mv: hist[p - 1] };
        }
      }
    }
    let boardH = '', line = '';
    if (worst) {
      const cls = worst.drop >= WIN_THRESHOLDS.blunder ? 'blunder' : worst.drop >= WIN_THRESHOLDS.mistake ? 'mistake' : worst.drop >= WIN_THRESHOLDS.inaccuracy ? 'inaccuracy' : null;
      boardH = boardHTML(worst.fen, mine === 'b', { from: worst.mv.from, to: worst.mv.to }, cls);
      const num = Math.ceil(worst.p / 2) + (worst.p % 2 ? '.' : '…') + worst.mv.san;
      line = cls ? `<span class="cb md ${cls}">${MOVE_META[cls].symbol}</span><span><b>${esc(num)}</b> · ${esc(t('cls_' + cls))}</span>` : `<span>${esc(tr('cleanGame'))}</span>`;
    }
    const res = String(g.result || '').replace(/-/g, '–').replace('1/2–1/2', '½–½');
    const sub = [g.opening, g.accuracy != null ? tr('accuracy', { a: g.accuracy.toFixed(1) }) : ''].filter(Boolean).join(' · ');
    return {
      date: fmtShort(g.date),
      html: `<div class="hm-t"><span class="hm-h">${esc(tr('vs', { o: opp }))} <em>· ${esc(res)}</em></span><span class="hm-s">${esc(sub)}</span></div>` +
        `<div class="hm-bw">${boardH}<div class="hm-line">${line}</div></div>`,
      foot: `<span class="hm-f">${esc(g.moments === 1 ? tr('keyOne') : g.moments != null ? tr('keyN', { n: g.moments }) : '')}</span><button class="gc-btn pri" data-a="review" data-id="${g.id}">${esc(tr('review'))}</button>`,
    };
  }

  function fmtShort(d) {
    const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(d || '');
    if (!m) return '';
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString(currentLang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short' });
  }

  // ── blocco 02: carte da ripassare ──
  async function openingsBlock() {
    const d = await j('/api/rep/chapters');
    const chs = (d && d.chapters || []).filter(c => c.built);
    const per = (d && d.new_per_day) || 10;
    const due = chs.reduce((a, c) => a + (c.due || 0), 0);
    const nw = Math.min(chs.reduce((a, c) => a + (c.new || 0), 0), per);
    const total = due + nw;
    HM.cards = total;
    if (typeof setOpBadge === 'function') setOpBadge(due);
    if (!total) {
      return { html: `<div class="hm-empty"><b>${esc(tr('nothing'))}</b><p>${esc(tr('nothingP'))}</p></div>`, foot: `<button class="gc-btn" data-a="explore">${esc(tr('explore'))}</button>` };
    }
    // prima carta in scadenza: mini scacchiera orientata sul colore del capitolo
    let boardH = '', cardLine = '';
    const first = chs.find(c => c.due) || chs.find(c => c.new);
    if (first) {
      const t = await j(`/api/rep/tree/${encodeURIComponent(first.id)}`);
      if (t && t.nodes) {
        const today = t.today || new Date().toISOString().slice(0, 10);
        const hasKids = new Set(t.nodes.map(n => n.parent_id));
        const cand = t.nodes.filter(n => n.user_to_move && hasKids.has(n.id) && (n.srs_state === 'new' || !n.srs_due || n.srs_due <= today))
          .sort((a, b) => (a.srs_state === 'new') - (b.srs_state === 'new') || String(a.srs_due || '').localeCompare(String(b.srs_due || '')) || a.ply - b.ply)[0];
        if (cand) {
          const last = cand.move_uci ? { from: cand.move_uci.slice(0, 2), to: cand.move_uci.slice(2, 4) } : null;
          boardH = boardHTML(cand.fen, first.color === 'black', last, null);
          const mv = cand.ply % 2 === 0 ? (cand.ply / 2 + 1) + '.' : Math.ceil(cand.ply / 2) + '…';
          cardLine = `<i class="sw ${first.color === 'black' ? 'sw-black' : 'sw-white'}"></i><span><b>${esc(tr('yourMove', { m: mv }))}</b> · ${esc(first.name)}</span>`;
        }
      }
    }
    const rows = chs.map(c => ({ name: c.name, n: (c.due || 0) + (c.new || 0) })).filter(r => r.n).sort((a, b) => b.n - a.n).slice(0, 3);
    return {
      html: `<div class="hm-t"><span class="hm-h hm-n"><b>${total}</b> ${esc(tr('cards'))}</span><span class="hm-s">${esc(tr('dueNew', { d: due, n: nw }))}</span></div>` +
        `<div class="hm-bw">${boardH}<div class="hm-line">${cardLine}</div></div>` +
        `<div class="hm-list">${rows.map(r => `<div><span>${esc(r.name)}</span><b>${r.n}</b></div>`).join('')}</div>`,
      foot: `<span></span><button class="gc-btn pri" data-a="drill">${esc(tr('reviewN', { n: total }))}</button>`,
    };
  }

  // ── blocco 02: puzzle dai miei errori (al posto delle carte; le Aperture restano nella barra) ──
  async function openingsBadge() {
    const d = await j('/api/rep/chapters');
    const chs = (d && d.chapters || []).filter(c => c.built);
    const due = chs.reduce((a, c) => a + (c.due || 0), 0);
    if (typeof setOpBadge === 'function') setOpBadge(due);
  }

  async function puzzleBlock() {
    const s = await j('/api/puzzles/summary');
    if (window.PZ && PZ.refreshBadge) PZ.refreshBadge();
    if (!s || !s.total) {
      const noUser = s && s.has_username === false;
      return { html: `<div class="hm-empty"><b>${esc(tr(noUser ? 'pzNoUser' : 'pzNone'))}</b><p>${esc(tr(noUser ? 'pzNoUserP' : 'pzNoneP'))}</p></div>`, foot: `<span></span><button class="gc-btn" data-a="archive">${esc(tr('openArchive'))}</button>` };
    }
    const rows = (s.recent || []).map(r => `<div><span>${esc(r.opponent || '?')}${fmtShort(r.game_date) ? ' · ' + esc(fmtShort(r.game_date)) : ''}</span><b>${r.solved || 0}/${r.n}</b></div>`).join('');
    const tot = `<span class="hm-f">${esc(tr('pzTot', { t: s.total }))}</span>`;
    if (!s.pending) {
      return {
        html: `<div class="hm-t"><span class="hm-h">${esc(tr('pzDone'))}</span><span class="hm-s">${esc(tr('pzSub', { s: s.solved, t: s.total }))}</span></div>` +
          `<div class="hm-bw"><div class="hm-line"><span>${esc(tr('pzDoneP'))}</span></div></div><div class="hm-list">${rows}</div>`,
        foot: `${tot}<button class="gc-btn" data-a="puzzle">${esc(tr('pzOpen'))}</button>`,
      };
    }
    const nx = s.next;
    let boardH = '', line = '';
    if (nx && nx.fen) {
      const last = nx.prev_uci ? { from: nx.prev_uci.slice(0, 2), to: nx.prev_uci.slice(2, 4) } : null;
      boardH = boardHTML(nx.fen, nx.color === 'black', last, null);
      line = `<i class="sw ${nx.color === 'black' ? 'sw-black' : 'sw-white'}"></i><span><b>${esc(tr('pzFind'))}</b> · ${esc(tr('pzVs', { o: nx.opponent || '?' }))}</span>`;
    }
    return {
      html: `<div class="hm-t"><span class="hm-h hm-n"><b>${s.pending}</b> ${esc(tr('pzWord'))}</span><span class="hm-s">${esc(tr('pzSub', { s: s.solved, t: s.total }))}</span></div>` +
        `<div class="hm-bw">${boardH}<div class="hm-line">${line}</div></div><div class="hm-list">${rows}</div>`,
      foot: `${tot}<button class="gc-btn pri" data-a="puzzle">${esc(tr('pzSolve', { n: s.pending }))}</button>`,
    };
  }

  // ── blocco 03: precisione prima/ora ──
  async function statsBlock() {
    const d = await j('/api/insights/data');
    let games = (d && d.games) || [];
    const c = {};
    games.forEach(g => { c[g.time_class] = (c[g.time_class] || 0) + 1; });
    const tc = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    games = games.filter(g => g.time_class === tc && g.accuracy != null);
    if (games.length < 6) return { html: `<div class="hm-empty"><b>${esc(tr('noStats'))}</b><p>${esc(tr('noStatsP'))}</p></div>`, foot: `<span></span><button class="gc-btn" data-a="stats">${esc(tr('openStats'))}</button>` };
    const W = Math.min(30, Math.floor(games.length / 2));
    const now = games.slice(-W), prev = games.slice(-2 * W, -W);
    const mean = gs => gs.reduce((a, g) => a + g.accuracy, 0) / gs.length;
    const a1 = mean(prev), a2 = mean(now), diff = a2 - a1;
    const word = Math.abs(diff) < 0.05 ? tr('same') : diff > 0 ? tr('better') : tr('worse');
    const months = gs => {
      const f = x => new Date(String(x.date).replace(/\./g, '-')).toLocaleDateString(currentLang === 'it' ? 'it-IT' : 'en-GB', { month: 'short' });
      const a = f(gs[0]), b = f(gs[gs.length - 1]);
      return a === b ? a : `${a} – ${b}`;
    };
    const shown = prev.concat(now);
    const bars = shown.map((g, i) => `<span class="${i >= prev.length ? 'now' : ''}" style="height:${Math.max(4, (g.accuracy - 50) * 2).toFixed(1)}%"></span>`).join('');
    const f1 = x => x.toFixed(1).replace('.', currentLang === 'it' ? ',' : '.');
    return {
      sub: tr('progress', { tc: tc[0].toUpperCase() + tc.slice(1) }),
      html: `<div class="hm-t"><span class="hm-h">${esc(tr('avgAcc'))}</span><span class="hm-s">${esc(tr('cmp', { w: W }))}</span></div>` +
        `<div class="hm-ba"><div><span class="k">${esc(tr('before'))}</span><span class="v o">${f1(a1)}<small>%</small></span></div><div class="now"><span class="k n">${esc(tr('now'))}</span><span class="v">${f1(a2)}<small>%</small></span></div></div>` +
        `<div class="hm-dl"><b>${diff >= 0 ? '▲ +' : '▼ −'}${f1(Math.abs(diff))}</b><span>${esc(word)}</span></div>` +
        `<div class="hm-chart"><div class="hm-bars">${bars}</div><div class="hm-cl"><span>${esc(tr('beforeLbl', { a: months(prev) }))}</span><span class="n">${esc(tr('nowLbl', { a: months(now) }))}</span></div></div>`,
      foot: `<span></span><button class="gc-btn" data-a="stats">${esc(tr('openStats'))}</button>`,
    };
  }

  const sec = (n, name, side, b) => `<section class="hm-sec"><div class="hm-sh"><b>${n}</b><span>${esc(name)}</span><span style="flex:1"></span><small>${esc(side || '')}</small></div>${b.html}<div style="flex:1"></div><div class="hm-ft">${b.foot}</div></section>`;

  HM.refresh = async function () {
    const my = ++HM.token;
    const cfg = await j('/api/rep/settings');
    const names = String((cfg && (cfg.chesscom_username || cfg.suggested_username)) || '').split(/[,;\s]+/).filter(Boolean);
    const h = new Date().getHours();
    const greet = tr(h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening');
    const dt = new Date();
    const loc = currentLang === 'it' ? 'it-IT' : 'en-GB';
    const dateTxt = dt.toLocaleDateString(loc, { weekday: 'long' }) + ' · ' + dt.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
    $('hmDate').textContent = dateTxt;
    $('hmHi').textContent = greet + (names[0] ? ', ' + names[0] : '') + '.';
    $('hmThree').textContent = tr('three');
    const page = $('homeBody');
    // titolo e data si ridisegnano
    const gamesList = await j('/api/games');
    const [g1, g2, g3] = await Promise.all([gameBlock(Array.isArray(gamesList) ? gamesList[0] : null), puzzleBlock(), statsBlock()]);
    openingsBadge();
    if (my !== HM.token) return;
    page.innerHTML = sec('01', tr('game'), g1.date ? tr('lastGame', { d: g1.date }) : '', g1) + sec('02', tr('puzzle'), tr('pzSide'), g2) + sec('03', tr('stats'), g3.sub || '', g3);
  };

  $('homeBody').addEventListener('click', async ev => {
    const el = ev.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a;
    if (a === 'review') { HM.close(); await loadSavedGame(+el.dataset.id); }
    else if (a === 'archive') { AR.open('archive'); }
    else if (a === 'puzzle') { if (window.PZ) PZ.open(); }
    else if (a === 'drill') { await OP.open(); OP.startDrill(); }
    else if (a === 'explore') OP.open();
    else if (a === 'stats') ST.open();
  });

  HM.translate = () => { if (HM.active) HM.refresh(); };

  function wire() {
    $('navHome').disabled = false;
    $('navHome').title = '';
    $('navHome').onclick = () => HM.open();
    [$('navGame'), $('learnBtn'), $('statsBtn'), $('gamesBtn'), $('settingsBtn')].forEach(b => b && b.addEventListener('click', () => HM.close(), true));
    HM.open();   // la Home è la schermata iniziale
  }
  wire();
})();
