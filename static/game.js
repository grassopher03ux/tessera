'use strict';
/* ════════════════════════════════════════════════════════════════
   GAME — colonna narrativa (tavola 2a): panoramica, momenti chiave,
   analisi in corso, variante, motore offline, elenco mosse.
   Usa lo stato di app.js (mainHistory, gameEvals, ...); non cambia le meccaniche.
   ════════════════════════════════════════════════════════════════ */
(function () {
  const D = {
    it: {
      stepMoment: 'Momento {i} di {n}', stepBetween: 'Tra i momenti · visti {i} di {n}', nextMoment: 'Momento succ. ▶',
      ovKicker: 'Revisione · pronta', ovNone: 'Nessun momento chiave. Partita pulita.',
      ovOne: '1 momento chiave. La partita è girata alla mossa {m}.', ovMany: '{n} momenti chiave. La partita è girata alla mossa {m}.',
      meAcc: 'Io · precisione', myAcc: 'La mia precisione', opp: 'Avversario',
      startReview: 'Inizia la revisione ▶', orN: 'oppure premi N',
      better: 'Mossa migliore', showBoard: 'Mostra sulla scacchiera',
      nextKey: 'Prossimo momento chiave', inMoves: 'tra {n} mosse', go: 'Vai ▶',
      win: 'probabilità di vittoria {a}% → {b}%', stillTheory: 'Ancora in teoria.', noKey: 'Nessun momento chiave qui.', turning: 'Svolta',
      explain: 'Spiega la mossa', explaining: 'Sto spiegando…',
      lines: 'Linee del motore', engOff: 'Motore offline', engOffTxt: "L'analisi salvata resta disponibile. Le linee in diretta richiedono Stockfish.", openSettings: 'Apri impostazioni',
      notK: 'Non ancora analizzata', notH: 'Analizza la partita per trovare i miei momenti chiave.',
      notP: 'Stockfish controlla ogni posizione, classifica ogni mossa e segna i momenti in cui la partita è cambiata. Posso già scorrere le mosse sulla scacchiera.',
      analyze: 'Analizza la partita', live: 'Live',
      anK: 'Analisi in corso', anPos: 'Posizione {i} di {n}', anP: 'I miei momenti chiave compaiono qui a fine analisi. Intanto posso continuare a muovermi nella partita.',
      varBadge: 'VARIANTE', varFrom: 'dalla mossa {n}', varTry: 'Provo {a} al posto di {b}', varTry1: 'Provo {a}',
      varNote: 'Le mosse che gioco qui non vengono salvate nella partita. Anche ↑ torna alla linea principale.', backMain: '↩ Linea principale',
      emptyK: 'Nessuna partita', emptyH: "Importa una partita o aprine una dall'Archivio.", importPgn: 'Importa PGN', archive: 'Archivio',
      allMoves: 'Tutte le mosse', allMovesN: 'Tutte le mosse · {n}', noGraph: 'Analizza la partita per vedere il grafico della valutazione',
    },
    en: {
      stepMoment: 'Moment {i} of {n}', stepBetween: 'Between moments · {i} of {n} seen', nextMoment: 'Next moment ▶',
      ovKicker: 'Analysis · ready', ovNone: 'No key moments. A clean game.',
      ovOne: '1 key moment. The game turned on move {m}.', ovMany: '{n} key moments. The game turned on move {m}.',
      meAcc: 'Me · accuracy', myAcc: 'My accuracy', opp: 'Opponent',
      startReview: 'Start review ▶', orN: 'or press N',
      better: 'Better move', showBoard: 'Show on board',
      nextKey: 'Next key moment', inMoves: 'in {n} moves', go: 'Go ▶',
      win: 'win chance {a}% → {b}%', stillTheory: 'Still in theory.', noKey: 'No key moment here.', turning: 'Turning point',
      explain: 'Explain this move', explaining: 'Explaining…',
      lines: 'Engine lines', engOff: 'Engine offline', engOffTxt: 'Saved analysis is still available. Live lines need Stockfish.', openSettings: 'Open settings',
      notK: 'Not analyzed yet', notH: 'Analyze the game to find my key moments.',
      notP: 'Stockfish checks every position, classifies each move and marks the moments where the game changed. I can already step through the moves on the board.',
      analyze: 'Analyze game', live: 'Live',
      anK: 'Analyzing', anPos: 'Position {i} of {n}', anP: 'My key moments appear here when the analysis is done. I can keep moving through the game in the meantime.',
      varBadge: 'VARIATION', varFrom: 'from move {n}', varTry: "I'm trying {a} instead of {b}", varTry1: "I'm trying {a}",
      varNote: 'Moves I play here are not saved to the game. ↑ also returns to the main line.', backMain: '↩ Back to main line',
      emptyK: 'No game loaded', emptyH: 'Import a game or open one from the Archive.', importPgn: 'Import PGN', archive: 'Archive',
      allMoves: 'All moves', allMovesN: 'All moves · {n}', noGraph: 'Analyze the game to see the evaluation graph',
    },
  };
  const tr = (k, v = {}) => {
    let s = (D[currentLang] || D.it)[k] ?? D.it[k] ?? k;
    for (const [a, b] of Object.entries(v)) s = s.replace(new RegExp('\\{' + a + '\\}', 'g'), String(b));
    return s;
  };

  const GM = window.GM = { tr, myNames: [], drawerOpen: false, linesOpen: true };
  try { GM.linesOpen = localStorage.getItem('cr_lines_open') === '1'; } catch {}

  const e = s => escHtml(String(s));
  const inGameView = () => !document.body.classList.contains('op-active') && !document.body.classList.contains('st-active') && !document.body.classList.contains('ar-active') && !document.body.classList.contains('hm-active');
  const badge = (cls, size) => `<span class="cb ${cls} ${size}">${MOVE_META[cls].symbol}</span>`;
  const num = p => Math.ceil(p / 2) + (p % 2 ? '.' : '…');
  const sgn = d => (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1);

  // ── i miei account (chess.com) → da che parte gioco ──
  fetch('/api/rep/settings').then(r => r.json()).then(d => {
    GM.myNames = String(d.chesscom_username || d.suggested_username || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
    GM.render();
  }).catch(() => {});

  /** 'w' | 'b': il mio colore (se nessun account corrisponde: Bianco). */
  GM.mySide = () => {
    const w = String(currentGameMeta.white || '').toLowerCase(), b = String(currentGameMeta.black || '').toLowerCase();
    return GM.myNames.includes(b) && !GM.myNames.includes(w) ? 'b' : 'w';
  };

  const NOTE = ['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder'];

  /** Momenti chiave: solo le mie mosse; classe notevole oppure svolta della partita. */
  GM.moments = () => {
    if (!gameAnalyzed) return [];
    const me = GM.mySide(), out = [];
    for (let p = 1; p < mainHistory.length; p++) {
      if (mainHistory[p - 1].fen.split(' ')[1] !== me) continue;
      const before = winPctFor(me, gameEvals[p - 1], mainHistory[p - 1].fen);
      const after = winPctFor(me, gameEvals[p], mainHistory[p].fen);
      const cls = gameClassifications[p];
      const swing = before !== null && after !== null && (before - 50) * (after - 50) < 0;
      if (NOTE.includes(cls) || swing) out.push({ p, cls, before, after, delta: before === null || after === null ? 0 : after - before, notable: NOTE.includes(cls) });
    }
    return out;
  };

  const best = p => {   // mossa migliore (SAN) prima della mossa p, se diversa da quella giocata
    const uci = (gameBestMoves[p - 1] || '').toLowerCase(), mv = mainHistory[p]?.move;
    if (!uci || !mv) return null;
    if (uci === (mv.from + mv.to + (mv.promotion || '')).toLowerCase()) return null;
    return uciToSan(mainHistory[p - 1].fen, uci);
  };

  const mode = () => {
    if (mainHistory.length <= 1) return 'empty';
    if (inVariation()) return 'variation';
    if (analysisProgress) return 'analyzing';
    if (!gameAnalyzed) return 'none';
    return mainIdx === 0 ? 'overview' : 'moment';
  };

  // ── pezzi di HTML ──
  const stepper = moms => {
    const p = mainIdx, at = moms.findIndex(m => m.p === p), seen = moms.filter(m => m.p < p).length;
    const label = at >= 0 ? tr('stepMoment', { i: at + 1, n: moms.length }) : tr('stepBetween', { i: seen, n: moms.length });
    return `<button class="gc-ib" data-a="prevM" title="P">◀</button><div class="gc-stp"><span class="gc-lab">${e(label)}</span><div class="gc-segs">` +
      moms.map(m => `<button class="gc-seg${m.p <= p ? ' on' : ''}" data-a="go" data-p="${m.p}"></button>`).join('') +
      `</div></div><button class="gc-next" data-a="nextM" title="N">${e(tr('nextMoment'))}</button>`;
  };

  const liveLine = () => {
    const v = lastEngineView && lastEngineView.fen === currentFen() ? lastEngineView.moves : null;
    if (!v || !v.length) return '';
    const m = v[0];
    return `<div class="gc-ln live"><b>${e(formatScore(m.Centipawn, m.Mate))}</b><span><em>${e(tr('live'))}</em><strong>${e(uciToSan(currentFen(), m.Move))}</strong>${e(m.PV_SAN || '')}</span></div>`;
  };

  const engineBlock = () => {
    if (!engineOnline)
      return `<div class="gc-eng"><div class="gc-off"><div><small>${e(tr('engOff'))}</small><span>${e(tr('engOffTxt'))}</span></div><button class="gc-btn sm" data-a="settings">${e(tr('openSettings'))}</button></div></div>`;
    const v = lastEngineView && lastEngineView.fen === currentFen() ? lastEngineView.moves : [];
    let h = `<div class="gc-eng"><button class="gc-eng-h" data-a="lines"><span>${GM.linesOpen ? '▾' : '▸'} ${e(tr('lines'))}</span><span>D${appConfig.depth || ''}</span></button>`;
    if (GM.linesOpen) h += v.map((m, i) => `<div class="gc-ln" data-a="arrow" data-i="${i}"><b>${e(formatScore(m.Centipawn, m.Mate))}</b><span><strong>${e(uciToSan(currentFen(), m.Move))}</strong>${e(m.PV_SAN || '')}</span></div>`).join('');
    return h + '</div>';
  };

  const overview = moms => {
    const me = GM.mySide(), acc = gameAccuracy(), mine = me === 'w' ? acc.w : acc.b, theirs = me === 'w' ? acc.b : acc.w;
    const oppName = (me === 'w' ? currentGameMeta.black : currentGameMeta.white) || tr('opp');
    let turn = null;
    for (const m of moms) if (!turn || Math.abs(m.delta) > Math.abs(turn.delta)) turn = m;
    const head = !moms.length ? tr('ovNone') : tr(moms.length === 1 ? 'ovOne' : 'ovMany', { n: moms.length, m: Math.ceil(turn.p / 2) });
    const counts = NOTE.map(k => [k, moms.filter(m => m.cls === k).length]).filter(c => c[1] > 0);
    return `<div class="gc-body"><div><div class="gc-k">${e(tr('ovKicker'))}</div><div class="gc-h1" style="margin-top:10px">${e(head)}</div></div>` +
      `<div class="gc-acc2"><div><div class="gc-bn">${mine ?? '—'}<small>%</small></div><div class="gc-cap">${e(tr('meAcc'))}</div></div>` +
      `<div><div class="gc-bn" style="color:var(--ink-2)">${theirs ?? '—'}<small>%</small></div><div class="gc-cap">${e(oppName)}</div></div></div>` +
      (counts.length ? `<div class="gc-counts">${counts.map(([k, n]) => `<span>${badge(k, 'md')}${e(t('cls_' + k))} <b>${n}</b></span>`).join('')}</div>` : '') +
      (moms.length ? `<div class="gc-moms">${moms.map((m, i) => `<button class="gc-mom" data-a="go" data-p="${m.p}"><i>${String(i + 1).padStart(2, '0')}</i><b>${e(num(m.p) + mainHistory[m.p].move.san)}</b><span>${e(m.notable ? t('cls_' + m.cls) : tr('turning'))}</span>${m.cls ? badge(m.cls, 'md') : ''}</button>`).join('')}</div>` : '') +
      (moms.length ? `<div class="gc-row"><button class="gc-btn pri" data-a="nextM">${e(tr('startReview'))}</button><span class="gc-hint">${e(tr('orN'))}</span></div>` : '') +
      '</div>';
  };

  const moment = moms => {
    const p = mainIdx, mv = mainHistory[p].move, cls = gameClassifications[p];
    const mover = mainHistory[p - 1].fen.split(' ')[1];
    const before = winPctFor(mover, gameEvals[p - 1], mainHistory[p - 1].fen), after = winPctFor(mover, gameEvals[p], mainHistory[p].fen);
    const isMom = moms.some(m => m.p === p), err = cls === 'mistake' || cls === 'blunder';
    const headline = isMom ? (NOTE.includes(cls) ? t('cls_' + cls) : tr('turning')) : (cls === 'book' ? tr('stillTheory') : tr('noKey'));
    let h = `<div class="gc-body"><div class="gc-mv"><span class="gc-big"><em>${e(num(p))}</em>${e(mv.san)}</span>${NOTE.includes(cls) ? badge(cls, 'xl') : ''}</div>` +
      `<div><div class="gc-title">${e(headline)}</div><div class="gc-stats">` +
      (cls ? `<span class="cl${err ? ' bad' : ''}">${e(t('cls_' + cls))}</span>` : '') +
      (before !== null && after !== null ? `<span>${e(tr('win', { a: before.toFixed(0), b: after.toFixed(0) }))}</span><b class="${err ? 'bad' : ''}">${sgn(after - before)}</b>` : '') +
      '</div></div>';
    const txt = $explText.textContent;
    if (txt) h += `<div class="gc-comment">${e(txt)}</div>`;
    else if (aiKeyOn) h += `<div><button class="gc-btn sm" data-a="explain"${$btnExplain && $btnExplain.disabled ? ' disabled' : ''}>${e($btnExplain && $btnExplain.textContent === t('explainLoading') ? tr('explaining') : tr('explain'))}</button></div>`;
    const bm = (cls === 'inaccuracy' || cls === 'mistake' || cls === 'blunder') ? best(p) : null;
    if (bm) h += `<div class="gc-better"><div><small>${e(tr('better'))}</small><b>${e(num(p) + bm)}</b></div><button class="gc-btn pri sm" data-a="show">${e(tr('showBoard'))}</button></div>`;
    const nx = moms.find(m => m.p > p);
    if (!isMom && nx) h += `<button class="gc-nk" data-a="go" data-p="${nx.p}"><span style="display:block"><small>${e(tr('nextKey'))}</small><b>${e(Math.ceil(nx.p / 2) + '.' + mainHistory[nx.p].move.san + ' · ' + tr('inMoves', { n: Math.ceil((nx.p - p) / 2) }))}</b></span><span>${e(tr('go'))}</span></button>`;
    return h + engineBlock() + '</div>';
  };

  const none = () =>
    `<div class="gc-body tall"><div class="gc-k">${e(tr('notK'))}</div><div class="gc-h1">${e(tr('notH'))}</div><div class="gc-p">${e(tr('notP'))}</div>` +
    `<div><button class="gc-btn pri" data-a="analyze"${engineOnline ? '' : ' disabled'}>${e(tr('analyze'))}</button></div>` +
    (engineOnline ? liveLine() : engineBlock()) + '</div>';

  const analyzing = () => {
    const a = analysisProgress, pct = Math.round(a.done / a.total * 100);
    return `<div class="gc-body tall"><div class="gc-k">${e(tr('anK'))}</div><div class="gc-pct">${pct}<small>%</small></div>` +
      `<div class="gc-bar"><i style="width:${pct}%"></i></div><div class="gc-mono18">${e(tr('anPos', { i: a.done, n: a.total }))}</div><div class="gc-p">${e(tr('anP'))}</div></div>`;
  };

  const variation = () => {
    const first = varHistory[1] && varHistory[1].move, alt = mainHistory[branchIdx + 1] && mainHistory[branchIdx + 1].move;
    const lab = ply => num(ply);
    const title = !first ? '' : alt ? tr('varTry', { a: lab(branchIdx + 1) + first.san, b: lab(branchIdx + 1) + alt.san }) : tr('varTry1', { a: lab(branchIdx + 1) + first.san });
    let moves = '';
    for (let i = 1; i < varHistory.length; i++) {
      const mv = varHistory[i].move; if (!mv) continue;
      const ply = branchIdx + i;
      if (ply % 2 === 1 || i === 1) moves += `<span>${e(lab(ply))}</span>`;
      moves += `<button class="${i === varIdx ? 'on' : ''}" data-a="var" data-i="${i}">${e(mv.san)}</button>`;
    }
    return `<div class="gc-body tall"><div class="gc-row"><span class="gc-vb">${e(tr('varBadge'))}</span><span class="gc-k">${e(tr('varFrom', { n: Math.ceil((branchIdx + 1) / 2) }))}</span></div>` +
      `<div class="gc-h1">${e(title)}</div><div class="gc-vmoves">${moves}</div>${liveLine()}` +
      `<div class="gc-p" style="font-size:20px">${e(tr('varNote'))}</div><div><button class="gc-btn pri" data-a="backMain">${e(tr('backMain'))}</button></div></div>`;
  };

  const empty = () =>
    `<div class="gc-body tall"><div class="gc-k">${e(tr('emptyK'))}</div><div class="gc-h1">${e(tr('emptyH'))}</div>` +
    `<div class="gc-row"><button class="gc-btn pri" data-a="import">${e(tr('importPgn'))}</button><button class="gc-btn" data-a="archive">${e(tr('archive'))}</button></div></div>`;

  const foot = () => {
    const me = GM.mySide(), acc = gameAnalyzed ? gameAccuracy() : { w: null, b: null };
    const mine = me === 'w' ? acc.w : acc.b, theirs = me === 'w' ? acc.b : acc.w;
    const sub = document.getElementById('openingSub');
    return `<div><div class="n">${mine !== null ? mine + '%' : '—'}</div><div class="l">${e(tr('myAcc'))}</div></div>` +
      `<div><div class="n o">${theirs !== null ? theirs + '%' : '—'}</div><div class="l">${e(tr('opp'))}</div></div>` +
      `<div><div class="t">${e($openName.textContent || '—')}</div><div class="l">${e(sub ? sub.textContent : '')}</div></div>`;
  };

  const drawer = () => {
    let h = `<div class="gc-dh"><span class="gc-k">${e(tr('allMovesN', { n: mainHistory.length - 1 }))}</span><button data-a="drawer" aria-label="close">×</button></div><div class="gc-dl">`;
    const cell = p => {
      if (p >= mainHistory.length) return '<span></span>';
      const cls = gameClassifications[p], act = !inVariation() && p === mainIdx;
      return `<button class="${act ? 'act ' : ''}${gameBookMoves[p] ? 'book' : ''}" data-a="go" data-p="${p}"><span>${e(mainHistory[p].move.san)}</span>${NOTE.includes(cls) ? badge(cls, 'sm') : ''}</button>`;
    };
    for (let n = 1; n * 2 - 1 < mainHistory.length; n++) h += `<div class="gc-pr"><i>${n}.</i>${cell(n * 2 - 1)}${cell(n * 2)}</div>`;
    return h + '</div>';
  };

  // ── render ──
  let queued = false;
  GM.render = () => { if (queued) return; queued = true; Promise.resolve().then(() => { queued = false; doRender(); }); };

  function doRender() {
    const n = Math.max(0, mainHistory.length - 1), idx = inVariation() ? branchIdx : mainIdx;
    const cnt = document.getElementById('tlCount');
    if (cnt) cnt.innerHTML = `${idx}<i> / ${n}</i>`;
    const all = document.getElementById('tlAll'); if (all) all.textContent = tr('allMoves');
    if (!inGameView()) return;

    const m = mode(), moms = GM.moments();
    document.getElementById('gcStep').innerHTML = (m === 'overview' || m === 'moment') ? stepper(moms) : '';
    document.getElementById('gcBody').outerHTML;   // (riferimento valido: stesso nodo)
    const body = document.getElementById('gcBody');
    const html = { empty, variation, analyzing, none }[m] ? { empty, variation, analyzing, none }[m]() : m === 'overview' ? overview(moms) : moment(moms);
    const keep = body.scrollTop;
    body.outerHTML = html.replace('<div class="gc-body', '<div id="gcBody" class="gc-body');
    document.getElementById('gcBody').scrollTop = keep;
    document.getElementById('gcFoot').innerHTML = foot();
    const dr = document.getElementById('gcDrawer');
    dr.hidden = !GM.drawerOpen || mainHistory.length <= 1;
    if (!dr.hidden) dr.innerHTML = drawer();
  }

  // ── scala: la colonna è disegnata a 820px e si riduce con la finestra ──
  function fitCol() {
    const colW = Math.max(480, Math.min(820, window.innerWidth * 0.32));
    const k = colW / 820;
    document.documentElement.style.setProperty('--col', colW + 'px');
    document.documentElement.style.setProperty('--scol', (520 * k) + 'px');
    document.documentElement.style.setProperty('--k', k);
    [['gcZ', 'gameCol'], ['opZ', 'opColWrap'], ['stZ', 'stColWrap'], ['pzZ', 'pzColWrap']].forEach(([zid, pid]) => {
      const z = document.getElementById(zid), pe = document.getElementById(pid);
      if (!z || !pe) return;
      z.style.zoom = k;
      z.style.height = (pe.clientHeight / k) + 'px';
    });
    if (window.fitBoard) { try { fitBoard(); renderArrows(); renderMoveBadge(); } catch {} }
  }
  window.addEventListener('resize', fitCol);

  // ── azioni ──
  const goMoment = dir => {
    const moms = GM.moments(); if (!moms.length) return;
    const t0 = inVariation() ? branchIdx : mainIdx;
    const m = dir > 0 ? moms.find(x => x.p > t0) : [...moms].reverse().find(x => x.p < t0);
    if (m) goToIndex(m.p, { sound: true });
  };
  GM.nextMoment = () => goMoment(1);
  GM.prevMoment = () => goMoment(-1);

  document.getElementById('gameCol').addEventListener('click', ev => {
    const el = ev.target.closest('[data-a]'); if (!el) return;
    const a = el.dataset.a;
    if (a === 'prevM') GM.prevMoment();
    else if (a === 'nextM') GM.nextMoment();
    else if (a === 'go') { goToIndex(+el.dataset.p, { sound: true }); }
    else if (a === 'show') goToIndex(mainIdx - 1, { sound: true });
    else if (a === 'analyze') analyzeGame();
    else if (a === 'explain') fetchExplanation();
    else if (a === 'lines') { GM.linesOpen = !GM.linesOpen; try { localStorage.setItem('cr_lines_open', GM.linesOpen ? '1' : '0'); } catch {} GM.render(); }
    else if (a === 'arrow') {
      const m = lastEngineView && lastEngineView.moves[+el.dataset.i];
      if (m) { engineArrowData = [{ from: m.Move.slice(0, 2), to: m.Move.slice(2, 4), color: ARROW_COLORS.blue, width: Math.max(6, Math.round(getSq() * 0.14)) }]; renderArrows(); }
    }
    else if (a === 'var') goVarIndex(+el.dataset.i);
    else if (a === 'backMain') returnToMainLine();
    else if (a === 'settings') document.getElementById('settingsBtn').click();
    else if (a === 'import') document.getElementById('importBtn').click();
    else if (a === 'archive') document.getElementById('gamesBtn').click();
    else if (a === 'drawer') { GM.drawerOpen = false; GM.render(); }
    if (a === 'go' && GM.drawerOpen) { GM.drawerOpen = false; GM.render(); }
  });

  document.getElementById('tlAll').onclick = () => { GM.drawerOpen = !GM.drawerOpen; GM.render(); };
  document.getElementById('tlPrev').onclick = navigatePrev;
  document.getElementById('tlNext').onclick = navigateNext;

  // N / P = momento chiave successivo / precedente
  document.addEventListener('keydown', ev => {
    if (!inGameView() || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((ev.target.tagName || ''))) return;
    if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); GM.nextMoment(); }
    else if (ev.key === 'p' || ev.key === 'P') { ev.preventDefault(); GM.prevMoment(); }
    else if (ev.key === 'Escape' && GM.drawerOpen) { GM.drawerOpen = false; GM.render(); }
  });

  // tornando alla vista Game (da Aperture / Statistiche) ridisegna
  new MutationObserver(() => { GM.render(); setTimeout(fitCol, 0); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  fitCol();
  GM.render();
})();
