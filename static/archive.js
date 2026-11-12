'use strict';
/* ════════════════════════════════════════════════════════════════
   ARCHIVE + SETTINGS — due pagine (rail 04 e ⚙), dialoghi Import PGN e Delete.
   Nessuna meccanica nuova: stesse API (/api/games, /api/set_stockfish, /api/status).
   ════════════════════════════════════════════════════════════════ */
(function () {
  const D = {
    it: {
      archive: 'Archivio', settings: 'Impostazioni', importPgn: 'Importa PGN',
      sub: '{n} partite · {m} analizzate · le più recenti prima', sub0: '0 partite',
      hDate: 'Data', hGame: 'Partita', hRes: 'Risultato', hAcc: 'La mia precisione', hKm: 'Momenti chiave', hAn: 'Analisi',
      anOk: 'Analizzata', anOld: 'Analisi vecchia · da rifare', anNone: 'Non analizzata', review: 'Rivedi', analyze: 'Analizza', del: 'Elimina',
      emK: 'Nessuna partita salvata', emH: 'Le partite che importo e analizzo vengono salvate qui.',
      emP: 'Incolla un PGN o apri un file .pgn. Le partite chess.com si importano da Aperture e Statistiche.',
      impTitle: 'Importa PGN', impOpen: 'Apri file .pgn', impCancel: 'Annulla', impLoad: 'Carica e analizza',
      impErr: 'PGN non valido o non riconosciuto. Controlla che le mosse siano in notazione standard.',
      impHint: 'Accetta intestazioni FEN e PGN approssimativi. La partita viene salvata nell\'Archivio dopo l\'analisi.',
      delTitle: 'Eliminare questa partita?', delText: '{who} · {date}. La partita e la sua analisi vengono rimosse. Non si può annullare.', delKeep: 'Tienila', delDo: 'Elimina',
      setSub: 'Salvate su questo computer',
      eng: 'Motore', engDesc: 'Stockfish gira su questo computer. Tutto tranne i commenti AI lo richiede.',
      engOn: 'Stockfish attivo', engOff: 'Stockfish non trovato', engOffSub: 'Analisi e costruzione delle aperture sono disattivate', engPath: 'Percorso di Stockfish', engSet: 'Imposta',
      engErr: 'File non trovato. Controlla il percorso e che punti a stockfish-windows-x86-64-avx2.exe.',
      tLive: 'Analisi live', tFull: 'Partita intera', tStats: 'Statistiche', depthN: 'profondità {n}', linesN: '{n} linee', cfgNote: 'Profondità e linee si impostano in config.json.',
      ai: 'Commenti AI', aiDesc: 'Facoltativo. Usato da "Spiega la mossa" e "Spiega con AI".', aiOn: 'Chiave OpenAI trovata', aiOff: 'Chiave OpenAI non trovata',
      aiHow: 'Per cambiarla, modifica il file <code>.env</code> accanto all\'app e riavvia: <code>OPENAI_API_KEY=sk-…</code>. La chiave non si digita né si mostra qui.',
      prefs: 'Preferenze', pLang: 'Lingua', pLangH: 'Testo dell\'interfaccia', pTheme: 'Tema', pThemeH: 'Anche nella barra in alto', pSound: 'Suoni delle mosse', pSoundH: 'Scorciatoia M',
      pBoard: 'Dimensione scacchiera', pBoardH: 'Lato massimo della casa',
      small: 'Piccola', medium: 'Media', large: 'Grande', on: 'Sì', off: 'No',
    },
    en: {
      archive: 'Archive', settings: 'Settings', importPgn: 'Import PGN',
      sub: '{n} games · {m} analyzed · newest first', sub0: '0 games',
      hDate: 'Date', hGame: 'Game', hRes: 'Result', hAcc: 'My accuracy', hKm: 'Key moments', hAn: 'Analysis',
      anOk: 'Analyzed', anOld: 'Old analysis · redo', anNone: 'Not analyzed', review: 'Review', analyze: 'Analyze', del: 'Delete',
      emK: 'No saved games', emH: 'Games I import and analyze are saved here.',
      emP: 'Paste a PGN or open a .pgn file. chess.com games are imported from Openings and Stats.',
      impTitle: 'Import PGN', impOpen: 'Open .pgn file', impCancel: 'Cancel', impLoad: 'Load and analyze',
      impErr: 'PGN not valid or not recognised. Check that the moves are in standard notation.',
      impHint: 'Accepts FEN headers and loose PGN. The game is saved in the Archive after analysis.',
      delTitle: 'Delete this game?', delText: '{who} · {date}. The game and its analysis are removed. This cannot be undone.', delKeep: 'Keep it', delDo: 'Delete',
      setSub: 'Saved on this computer',
      eng: 'Engine', engDesc: 'Stockfish runs on this computer. Everything except AI comments needs it.',
      engOn: 'Stockfish running', engOff: 'Stockfish not found', engOffSub: 'Analysis and Openings build are off', engPath: 'Stockfish path', engSet: 'Set',
      engErr: 'File not found. Check the path and that it points to stockfish-windows-x86-64-avx2.exe.',
      tLive: 'Live analysis', tFull: 'Full game', tStats: 'Stats', depthN: 'depth {n}', linesN: '{n} lines', cfgNote: 'Depth and lines are set in config.json.',
      ai: 'AI comments', aiDesc: 'Optional. Used by "Explain the move" and "Explain with AI".', aiOn: 'OpenAI key found', aiOff: 'OpenAI key not found',
      aiHow: 'To change it, edit the <code>.env</code> file next to the app and restart: <code>OPENAI_API_KEY=sk-…</code>. The key is never typed or shown here.',
      prefs: 'Preferences', pLang: 'Language', pLangH: 'Interface text', pTheme: 'Theme', pThemeH: 'Also in the top bar', pSound: 'Move sounds', pSoundH: 'Shortcut M',
      pBoard: 'Board size', pBoardH: 'Largest square size',
      small: 'Small', medium: 'Medium', large: 'Large', on: 'On', off: 'Off',
    },
  };
  const tr = (k, v = {}) => {
    let s = (D[currentLang] || D.it)[k] ?? D.it[k] ?? k;
    for (const [a, b] of Object.entries(v)) s = s.replace(new RegExp('\\{' + a + '\\}', 'g'), String(b));
    return s;
  };
  const $ = id => document.getElementById(id);
  const esc = s => escHtml(String(s ?? ''));

  const AR = window.AR = { active: false, view: null, games: [], status: null, meta: '' };

  // ── apertura / chiusura ─────────────────────────────────────────
  AR.open = function (view) {
    if (window.HM) HM.close();
    if (window.OP && OP.active) OP.close();
    if (window.ST && ST.active) ST.close();
    if (!AR.active) AR.meta = $gameMeta.innerHTML;
    AR.active = true; AR.view = view;
    const b = document.body.classList;
    b.add('ar-active'); b.toggle('ar-archive', view === 'archive'); b.toggle('ar-settings', view === 'settings');
    $('gamesBtn')?.toggleAttribute('aria-current', view === 'archive');
    $('settingsBtn')?.toggleAttribute('aria-current', view === 'settings');
    if ($('gamesBtn') && view === 'archive') $('gamesBtn').setAttribute('aria-current', 'true');
    if ($('settingsBtn') && view === 'settings') $('settingsBtn').setAttribute('aria-current', 'true');
    $gameMeta.innerHTML = `<b>${esc(tr(view))}</b>`;
    if (view === 'archive') loadGames(); else renderSettings();
  };
  AR.close = function () {
    if (!AR.active) return;
    AR.active = false; AR.view = null;
    document.body.classList.remove('ar-active', 'ar-archive', 'ar-settings');
    $('gamesBtn')?.removeAttribute('aria-current');
    $('settingsBtn')?.removeAttribute('aria-current');
    $gameMeta.innerHTML = AR.meta;
    if (typeof fitBoard === 'function') { fitBoard(); renderArrows(); renderMoveBadge(); }
  };

  // ── Archive ──────────────────────────────────────────────────────
  const fmtDate = d => {
    const m = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(d || '');
    if (!m) return d && d !== '???.??.??' ? d : '—';
    const dt = new Date(+m[1], +m[2] - 1, +m[3]);
    const o = { day: 'numeric', month: 'short' };
    if (dt.getFullYear() !== new Date().getFullYear()) o.year = 'numeric';
    return dt.toLocaleDateString(currentLang === 'it' ? 'it-IT' : 'en-GB', o);
  };
  const fmtRes = r => ({ '1-0': '1–0', '0-1': '0–1', '1/2-1/2': '½–½' }[r] || '·');

  async function loadGames() {
    $('archiveBody').innerHTML = '<div class="pg-note">…</div>';
    try { AR.games = await (await fetch(`${API}/api/games`)).json(); } catch { AR.games = []; }
    renderArchive();
  }

  function renderArchive() {
    const g = AR.games, box = $('archiveBody');
    const analyzed = g.filter(x => x.analysis === 'ok').length;
    let h = `<div class="pg-head"><div><span class="pg-h1">${esc(tr('archive'))}</span><span class="pg-sub">${esc(g.length ? tr('sub', { n: g.length, m: analyzed }) : tr('sub0'))}</span></div>` +
      `<button class="gc-btn pri" data-a="import">${esc(tr('importPgn'))}</button></div>`;
    if (!g.length) {
      h += `<div class="pg-empty"><span class="gc-k">${esc(tr('emK'))}</span><div class="pg-big">${esc(tr('emH'))}</div><p>${esc(tr('emP'))}</p>` +
        `<div><button class="gc-btn pri" data-a="import">${esc(tr('importPgn'))}</button></div></div>`;
    } else {
      h += `<div class="ag ag-h"><span>${esc(tr('hDate'))}</span><span></span><span>${esc(tr('hGame'))}</span><span>${esc(tr('hRes'))}</span><span class="r">${esc(tr('hAcc'))}</span><span class="r">${esc(tr('hKm'))}</span><span>${esc(tr('hAn'))}</span><span></span></div>`;
      h += g.map(x => {
        const bad = x.analysis !== 'ok';
        const an = x.analysis === 'ok' ? tr('anOk') : x.analysis === 'old' ? tr('anOld') : tr('anNone');
        const meta = [x.event && x.event !== '?' ? x.event : '', x.time_control, x.opening].filter(Boolean).join(' · ');
        return `<div class="ag"><span class="mono">${esc(fmtDate(x.date))}</span><i class="sw ${x.mine === 'b' ? 'sw-black' : 'sw-white'}"></i>` +
          `<span class="ag-t"><b>${esc(x.white)} vs ${esc(x.black)}</b><small>${esc(meta)}</small></span><span class="ag-res">${esc(fmtRes(x.result))}</span>` +
          `<span class="r n">${x.accuracy != null ? esc(x.accuracy.toFixed(1)) + '%' : '—'}</span><span class="r n">${x.moments != null ? x.moments : '—'}</span>` +
          `<span class="mono"${bad ? ' style="color:var(--err)"' : ''}>${esc(an)}</span>` +
          `<span class="ag-a"><button class="gc-btn sm" data-a="${bad ? 'analyze' : 'review'}" data-id="${x.id}">${esc(bad ? tr('analyze') : tr('review'))}</button>` +
          `<button class="gc-btn sm ter" data-a="del" data-id="${x.id}">${esc(tr('del'))}</button></span></div>`;
      }).join('');
    }
    box.innerHTML = h;
  }

  $('archiveBody').addEventListener('click', async ev => {
    const el = ev.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a, id = +el.dataset.id;
    if (a === 'import') openImport();
    else if (a === 'review') { AR.close(); await loadSavedGame(id); }
    else if (a === 'analyze') { AR.close(); await loadSavedGame(id); analyzeGame(); }
    else if (a === 'del') openDelete(id);
  });

  // ── dialoghi ─────────────────────────────────────────────────────
  function openImport() {
    $('pgnError').textContent = '';
    $('pgnInput').classList.remove('bad');
    $('importModal').classList.add('open');
  }
  $('loadPgnBtn').onclick = () => {
    const pgn = $('pgnInput').value.trim();
    const fail = () => { $('pgnError').textContent = tr('impErr'); $('pgnInput').classList.add('bad'); };
    if (!pgn) return fail();
    try {
      loadPgn(pgn);
    } catch { return fail(); }
    $('importModal').classList.remove('open');
    AR.close();
    analyzeGame();
  };
  $('pgnInput').addEventListener('input', () => { $('pgnInput').classList.remove('bad'); $('pgnError').textContent = ''; });
  $('importClose').onclick = $('importCancel').onclick = () => $('importModal').classList.remove('open');

  let delId = null;
  function openDelete(id) {
    const g = AR.games.find(x => x.id === id);
    if (!g) return;
    delId = id;
    $('delText').textContent = tr('delText', { who: `${g.white} vs ${g.black}`, date: fmtDate(g.date) });
    $('delModal').classList.add('open');
  }
  $('delKeep').onclick = () => { $('delModal').classList.remove('open'); delId = null; };
  $('delDo').onclick = async () => {
    if (delId == null) return;
    await fetch(`${API}/api/games/${delId}`, { method: 'DELETE' });
    $('delModal').classList.remove('open'); delId = null;
    loadGames();
  };

  // ── Settings ─────────────────────────────────────────────────────
  const prefDefs = () => [
    { k: 'pLang', h: 'pLangH', opts: [['IT', 'it'], ['EN', 'en']], cur: currentLang, set: v => setLanguage(v) },
    { k: 'pTheme', h: 'pThemeH', opts: [['Lattice', 'lattice'], ['Night', 'night']], cur: document.documentElement.dataset.theme === 'night' ? 'night' : 'lattice',
      set: v => { if ((document.documentElement.dataset.theme === 'night') !== (v === 'night')) $('skinBtn').click(); } },
    { k: 'pSound', h: 'pSoundH', opts: [[tr('on'), true], [tr('off'), false]], cur: SFX.enabled, set: v => { if (SFX.enabled !== v) SFX.toggle(); } },
    { k: 'pBoard', h: 'pBoardH', opts: [[tr('small'), '90'], [tr('medium'), '110'], [tr('large'), '0']], cur: boardCap(),
      set: v => { try { localStorage.setItem('cr_board_cap', v); } catch {} } },
  ];
  function boardCap() { try { return localStorage.getItem('cr_board_cap') || '0'; } catch { return '0'; } }

  function renderSettings() {
    document.querySelectorAll('[data-ar]').forEach(el => { el.innerHTML = tr(el.dataset.ar); });
    const defs = prefDefs();
    $('setPrefs').innerHTML = defs.map((p, i) => `<div class="pf"><span><b>${esc(tr(p.k))}</b><small>${esc(tr(p.h))}</small></span><span class="pf-o">` +
      p.opts.map(([l, v]) => `<button class="chip" data-i="${i}" data-v="${esc(v)}" aria-pressed="${String(p.cur) === String(v)}">${esc(l)}</button>`).join('') + '</span></div>').join('');
    $('setPrefs').querySelectorAll('.chip').forEach(b => b.onclick = () => {
      const p = defs[+b.dataset.i], raw = b.dataset.v;
      p.set(raw === 'true' ? true : raw === 'false' ? false : raw);
      renderSettings();
      if (typeof fitBoard === 'function') { fitBoard(); }
    });
    AR.updateStatus();
  }
  AR.translate = () => { if (AR.active) { if (AR.view === 'archive') renderArchive(); else renderSettings(); } };

  // chiamato da pollStatus
  AR.setStatus = d => { AR.status = d; AR.updateStatus(); };
  AR.updateStatus = function () {
    const d = AR.status;
    if (!d || !$('setEngTitle')) return;
    const on = !!d.engine;
    $('setEngBox').classList.toggle('bad', !on);
    $('setEngDot').className = 'status-dot ' + (on ? 'online' : 'offline');
    $('setEngTitle').textContent = on ? tr('engOn') : tr('engOff');
    $('setEngSub').textContent = on ? String(d.stockfish_path || '').split(/[\\/]/).pop() : tr('engOffSub');
    $('sfPath').classList.toggle('bad', !on && !!d.stockfish_path);
    if (!on && d.stockfish_path && !$('settingsMsg').textContent) { $('settingsMsg').textContent = tr('engErr'); $('settingsMsg').className = 'settings-msg err'; }
    if (on && $('settingsMsg').classList.contains('err') && $('settingsMsg').textContent === tr('engErr')) $('settingsMsg').textContent = '';
    $('setTiles').innerHTML = `<div><small>${esc(tr('tLive'))}</small><b>${esc(tr('depthN', { n: d.depth || '—' }))}</b></div>` +
      `<div><small>${esc(tr('tFull'))}</small><b>${esc(tr('linesN', { n: d.review_multipv || 2 }))}</b></div>` +
      `<div><small>${esc(tr('tStats'))}</small><b>${esc(tr('depthN', { n: d.insights_depth || 12 }))}</b></div>`;
    $('setAiDot').className = 'status-dot ' + (d.openai_key ? 'online' : 'offline');
    $('setAiTitle').textContent = d.openai_key ? tr('aiOn') : tr('aiOff');
    $('setAiSub').textContent = d.openai_key ? (d.openai_model || '') : '';
  };

  function wire() {
    $('gamesBtn').onclick = () => AR.open('archive');
    $('settingsBtn').onclick = () => AR.open('settings');
    $('navGame').addEventListener('click', () => AR.close(), true);
    $('learnBtn').addEventListener('click', () => AR.close(), true);
    $('statsBtn').addEventListener('click', () => AR.close(), true);
  }
  wire();
})();
