'use strict';
/* ════════════════════════════════════════════════════════════════════
   STATISTICHE — errori ricorrenti, tattiche, aperture, fasi nel tempo.
   Il server fornisce aggregati per partita (in ordine cronologico); qui si
   costruiscono le finestre "prima" / "ora" e si decide se un tema è
   risolto, in miglioramento, persistente o peggiorato.
   ════════════════════════════════════════════════════════════════════ */
(function () {

  const I18N = {
    it: {
      stats: 'Statistiche', back: '← Torna alla partita', filters: 'Filtri', tc: 'Cadenza', color: 'Colore',
      window: 'Finestra', all: 'Tutte', allC: 'Tutti', white: 'Bianco', black: 'Nero', games: 'partite',
      analysis: 'Analisi', analyzed: '{n} analizzate · {p} da analizzare', analyze: 'Analizza partite', stop: 'Ferma',
      analyzing: 'Analisi {d}/{t}…', importCc: 'Importa da chess.com', months: 'mesi', importing: 'Importo…',
      imported: '{a} nuove partite', sections: 'Sezioni', accounts: 'Account chess.com', save: 'Salva', saved: 'Salvato', period: 'Periodo da analizzare', allTime: 'Tutto', mShort: '{n} mesi', tcsScope: 'Cadenze da analizzare', scopeHint: 'Vale per l\'analisi e per la pagina. Nessuna cadenza selezionata = tutte.',
      sSummary: 'Sintesi', sTrend: 'Andamento', sErrors: 'Errori ricorrenti', sTactics: 'Tattiche',
      sOpenings: 'Aperture', sPhases: 'Fasi e orologio',
      noUser: 'Imposta lo username chess.com (Aperture → Partite chess.com) o salva qualche partita.',
      noData: 'Nessuna partita analizzata. Importa le partite e premi "Analizza partite".',
      fewGames: 'Solo {n} partite: le tendenze diventano affidabili da circa 60 partite in su.',
      prevNow: 'Prima: partite {a}–{b} ({d1} → {d2}) · Ora: partite {c}–{e} ({d3} → {d4})',
      tGames: 'Partite analizzate', tAcc: 'Precisione', tBl: 'Errori gravi / 100 mosse', tTac: 'Tattiche trovate',
      tThr: 'Minacce ignorate', tElo: 'Elo avversari', vsPrev: 'prima {v}',
      better: 'meglio', worse: 'peggio', same: 'uguale',
      colTheme: 'Tema', colExp: 'Occasioni', colPrev: 'Prima', colNow: 'Ora', colTrend: 'Andamento', colStatus: 'Stato',
      examples: 'esempi', noExamples: 'Nessun esempio in questo filtro.',
      st_solved: 'Risolto', st_improving: 'In miglioramento', st_trend_better: 'Tende a migliorare',
      st_stable: 'Persistente', st_ok: 'Stabile', st_worse: 'Peggiorato', st_trend_worse: 'Tende a peggiorare',
      st_few: 'Pochi dati', st_none: 'Mai osservato', st_less: 'Meno occasioni ora',
      e_hung: 'Pezzo lasciato in presa', e_missed_threat: 'Minaccia ignorata', e_thrown_win: 'Vantaggio buttato',
      e_time: 'Errori in zeitnot', e_blunder: 'Errori gravi', e_mistake: 'Errori',
      e_allowed: 'Tattica concessa: {m}',
      u_moves: 'ogni 100 mosse', u_threat: 'su minacce presenti', u_win: 'su posizioni vinte', u_err: 'degli errori',
      m_mate: 'matto', m_fork: 'forchetta', m_pin: 'inchiodatura', m_skewer: 'infilata', m_discovered: 'scoperta',
      m_material: 'materiale in presa', m_promotion: 'promozione', m_other: 'mossa unica (posizionale)',
      tacFound: 'trovate', tacIntro: 'Occasioni = posizioni in cui c\'era una sola mossa vincente (+15% di probabilità di vittoria rispetto alla seconda scelta).',
      opName: 'Apertura', opGames: 'Partite prima / ora', opScore: 'Punti', opAcc: 'Precisione prime 15', opFaith: 'Fedeltà repertorio',
      opExit: 'Uscita media', opMatrix: 'Tattiche mancate per apertura', move: 'mossa',
      phOpen: 'Apertura', phMiddle: 'Mediogioco', phEnd: 'Finale', phAcc: 'Precisione per fase',
      ttGames: 'Partite con zeitnot', ttErr: 'Errori fatti in zeitnot',
      sumBetter: 'Migliorato', sumWorse: 'Da lavorare', sumOpen: 'Aperture',
      sumLine: '{what}: da {a} a {b} {u}', sumNothing: 'Niente di significativo, per ora.',
      open: 'Apri', played: 'hai giocato {p}, meglio {b}', missedAt: 'mancata: {b}',
      trendAcc: 'precisione per partita · media mobile', trendElo: 'Elo avversari',
      stripHint: 'Ogni barra è una partita: altezza = precisione. Clic per aprirla.',
      prevLbl: 'PRIMA', nowLbl: 'ORA',
      onPage: "In questa pagina", filtersTitle: "Filtri e analisi", whichGames: "Quali partite", qImproving: "Sto migliorando?", qWork: "Su cosa devo lavorare?", qTactics: "Quali tattiche mi sfuggono?", qOpenings: "Come vanno le mie aperture?", qPhases: "Dove perdo punti nella partita?", uWork: "ogni 100 delle mie mosse", uTactics: "quota trovata, quando vinceva una sola mossa", uOpenings: "ultime {n} partite", uPhases: "precisione per fase · orologio", scopeLine: "{tc} · {col} · {acc} · {n} partite analizzate", tcAll: "Tutte le cadenze", bothCol: "entrambi i colori", asWhite2: "con il Bianco", asBlack2: "con il Nero", change: "Cambia", vYes: "Sì, sto migliorando.", vMixed: "Segnali contrastanti, per ora.", vNo: "Non ancora: le mie ultime partite sono più deboli.", vFewGood: "Presto per dirlo, ma sembra buono.", vFew: "Presto per dirlo.", subYes: "Le mie ultime {w} partite sono più precise delle {w} prima: {a1}% → {a2}%{ex}.", subMixed: "Le mie ultime {w} partite contro le {w} prima: {a1}% → {a2}% di precisione. I segnali sono contrastanti.", subNo: "Le mie ultime {w} partite contro le {w} prima: {a1}% → {a2}% di precisione. Sono meno precise.", subFew: "{n} partite finora. Le mie ultime {w} sono {cmp} delle {w} prima ({a1}% → {a2}%). Le tendenze diventano affidabili da circa 60 partite.", cmpMore: "più precise", cmpLess: "meno precise", cmpSame: "precise come", exBl: "meno errori gravi", exTac: "più tattiche trovate", joinAnd: " e ", withWord: ", con ", kAcc: "Precisione", kBl: "Errori gravi", kTac: "Tattiche trovate", kAccW: "Quanto le mie mosse erano vicine alla migliore del motore.", kBlW: "Errori grandi ogni 100 mosse che gioco.", kTacW: "Quando vinceva una sola mossa, quante volte l'ho trovata.", v_better: "Meglio", v_same: "Uguale", v_worse: "Peggio", v_few: "Pochi casi", chAcc: "Precisione, partita per partita", chBar: "una barra = una partita", chAvg: "media delle ultime 5", chElo: "Elo avversari", chHover: "Passa il mouse su una barra per vedere la partita", chPrev: "{w} partite precedenti", chNow: "Ultime {w} partite", chOld: "← partite più vecchie", chNew: "partite più recenti →", gNeeds: "Da lavorare", gBetter: "In miglioramento", seeN: "Vedi {n} posizioni", seeMissed: "Vedi le mancate", w_blunder: "Mosse che fanno scendere le mie probabilità di vittoria di 15 punti o più.", w_hung: "Ho mosso e lasciato un pezzo che si poteva prendere gratis.", w_missed_threat: "L'avversario minacciava qualcosa e non ho reagito.", w_time: "Quota dei miei errori fatti con meno del 10% del tempo.", w_allowed: "La mia mossa ha permesso all'avversario: {m}.", tacWhat: "{k2} su {n2} trovate ora · {k1} su {n1} prima", noRep: "Nessun repertorio", buildIt: "Costruiscilo", reviewBtn: "Ripassa", thGames: "Partite", thPts: "Punti vinti", thAcc: "Precisione apertura", thKept: "Fedeltà al repertorio", opNote: "Punti vinti: vittorie 1, patte ½, in % del massimo. Precisione apertura: le mie prime 15 mosse.", wMid: "Precisione quando l'apertura è finita e ci sono ancora pezzi.", wOpen: "Precisione fino alla mossa 12 circa.", wEnd: "Precisione con pochi pezzi.", wTT: "Partite in cui sono sceso sotto il 10% del tempo.", wTW: "Ero all'85% o più e sono sceso sotto il 70%.", twGames: "Partite vinte buttate", gamesU: "partite", emK: "Nessuna partita analizzata", emH: "Importa le mie partite chess.com, poi analizzale.", emP: "Ogni partita viene analizzata una volta, in background. Dopo circa 60 partite questa pagina sa dirmi se sto migliorando, quali errori tornano e quali tattiche mi sfuggono.", emBtn: "Importa da chess.com", exTitle: "Esempi", played2: "Ho giocato {p}", better2: "Meglio: {b}", openGame: "Apri partita", analyzedShort: "{n} analizzate", blocksOf: "blocchi da {n}",
    },
    en: {
      stats: 'Statistics', back: '← Back to game', filters: 'Filters', tc: 'Time control', color: 'Color',
      window: 'Window', all: 'All', allC: 'All', white: 'White', black: 'Black', games: 'games',
      analysis: 'Analysis', analyzed: '{n} analyzed · {p} to analyze', analyze: 'Analyze games', stop: 'Stop',
      analyzing: 'Analyzing {d}/{t}…', importCc: 'Import from chess.com', months: 'months', importing: 'Importing…',
      imported: '{a} new games', sections: 'Sections', accounts: 'chess.com accounts', save: 'Save', saved: 'Saved', period: 'Period to analyze', allTime: 'All', mShort: '{n} months', tcsScope: 'Time controls to analyze', scopeHint: 'Applies to the analysis and to this page. None selected = all.',
      sSummary: 'Summary', sTrend: 'Trend', sErrors: 'Recurring mistakes', sTactics: 'Tactics',
      sOpenings: 'Openings', sPhases: 'Phases and clock',
      noUser: 'Set your chess.com username (Openings → chess.com games) or save some games.',
      noData: 'No analyzed games. Import your games and press "Analyze games".',
      fewGames: 'Only {n} games: trends become reliable from about 60 games.',
      prevNow: 'Before: games {a}–{b} ({d1} → {d2}) · Now: games {c}–{e} ({d3} → {d4})',
      tGames: 'Games analyzed', tAcc: 'Accuracy', tBl: 'Blunders / 100 moves', tTac: 'Tactics found',
      tThr: 'Threats ignored', tElo: 'Opponent Elo', vsPrev: 'before {v}',
      better: 'better', worse: 'worse', same: 'same',
      colTheme: 'Theme', colExp: 'Chances', colPrev: 'Before', colNow: 'Now', colTrend: 'Trend', colStatus: 'Status',
      examples: 'examples', noExamples: 'No examples for this filter.',
      st_solved: 'Solved', st_improving: 'Improving', st_trend_better: 'Trending better',
      st_stable: 'Persistent', st_ok: 'Stable', st_worse: 'Worse', st_trend_worse: 'Trending worse',
      st_few: 'Not enough data', st_none: 'Never seen', st_less: 'Fewer chances now',
      e_hung: 'Piece left hanging', e_missed_threat: 'Threat ignored', e_thrown_win: 'Win thrown away',
      e_time: 'Mistakes in time trouble', e_blunder: 'Blunders', e_mistake: 'Mistakes',
      e_allowed: 'Tactic allowed: {m}',
      u_moves: 'per 100 moves', u_threat: 'of threats present', u_win: 'of winning positions', u_err: 'of mistakes',
      m_mate: 'mate', m_fork: 'fork', m_pin: 'pin', m_skewer: 'skewer', m_discovered: 'discovery',
      m_material: 'hanging material', m_promotion: 'promotion', m_other: 'only move (positional)',
      tacFound: 'found', tacIntro: 'Chances = positions with a single winning move (+15% win chance over the second choice).',
      opName: 'Opening', opGames: 'Games before / now', opScore: 'Score', opAcc: 'Accuracy first 15', opFaith: 'Repertoire fidelity',
      opExit: 'Average exit', opMatrix: 'Missed tactics by opening', move: 'move',
      phOpen: 'Opening', phMiddle: 'Middlegame', phEnd: 'Endgame', phAcc: 'Accuracy by phase',
      ttGames: 'Games with time trouble', ttErr: 'Mistakes made in time trouble',
      sumBetter: 'Improved', sumWorse: 'To work on', sumOpen: 'Openings',
      sumLine: '{what}: from {a} to {b} {u}', sumNothing: 'Nothing significant yet.',
      open: 'Open', played: 'you played {p}, better {b}', missedAt: 'missed: {b}',
      trendAcc: 'accuracy per game · moving average', trendElo: 'Opponent Elo',
      stripHint: 'Each bar is a game: height = accuracy. Click to open it.',
      prevLbl: 'BEFORE', nowLbl: 'NOW',
      onPage: "On this page", filtersTitle: "Filters & analysis", whichGames: "Which games", qImproving: "Am I improving?", qWork: "What should I work on?", qTactics: "Which tactics do I miss?", qOpenings: "How do my openings go?", qPhases: "Where in the game do I lose points?", uWork: "per 100 of my moves", uTactics: "share found, when only one move won", uOpenings: "last {n} games", uPhases: "accuracy by phase · clock", scopeLine: "{tc} · {col} · {acc} · {n} games analyzed", tcAll: "All time controls", bothCol: "both colours", asWhite2: "as White", asBlack2: "as Black", change: "Change", vYes: "Yes, I am improving.", vMixed: "Mixed signals so far.", vNo: "Not yet: my recent games are weaker.", vFewGood: "Too early to tell, but it looks good.", vFew: "Too early to tell.", subYes: "My last {w} games are more accurate than the {w} before them: {a1}% → {a2}%{ex}.", subMixed: "My last {w} games against the {w} before them: {a1}% → {a2}% accuracy. The signals are mixed.", subNo: "My last {w} games against the {w} before them: {a1}% → {a2}% accuracy. They are less accurate.", subFew: "{n} games so far. My last {w} are {cmp} the {w} before ({a1}% → {a2}%). Trends become reliable from about 60 games.", cmpMore: "more accurate than", cmpLess: "less accurate than", cmpSame: "as accurate as", exBl: "fewer blunders", exTac: "more tactics found", joinAnd: " and ", withWord: ", with ", kAcc: "Accuracy", kBl: "Blunders", kTac: "Tactics found", kAccW: "How close my moves were to the engine's best.", kBlW: "Big mistakes every 100 moves I play.", kTacW: "When only one move won, how often I found it.", v_better: "Better", v_same: "Same", v_worse: "Worse", v_few: "Too few cases", chAcc: "Accuracy, game by game", chBar: "one bar = one game", chAvg: "average of the last 5", chElo: "opponents' rating", chHover: "Hover a bar to see the game", chPrev: "Previous {w} games", chNow: "Last {w} games", chOld: "← older games", chNew: "newer games →", gNeeds: "Needs work", gBetter: "Getting better", seeN: "See {n} positions", seeMissed: "See missed", w_blunder: "Moves that drop my winning chances by 15 points or more.", w_hung: "I moved and left a piece that could be taken for free.", w_missed_threat: "My opponent threatened something and I did not react.", w_time: "Share of my errors made with under 10% of my time left.", w_allowed: "My move allowed the opponent a {m}.", tacWhat: "{k2} of {n2} found now · {k1} of {n1} before", noRep: "No repertoire", buildIt: "Build it", reviewBtn: "Review", thGames: "Games", thPts: "Points won", thAcc: "Opening accuracy", thKept: "Kept to repertoire", opNote: "Points won: wins count 1, draws ½, as a share of the maximum. Opening accuracy: my first 15 moves.", wMid: "Accuracy once the opening is over and pieces are still on.", wOpen: "Accuracy until about move 12.", wEnd: "Accuracy with few pieces left.", wTT: "Games where I dropped under 10% of my clock.", wTW: "I was at 85% or more and fell below 70%.", twGames: "Won games thrown away", gamesU: "games", emK: "No games analyzed yet", emH: "Import my chess.com games, then analyze them.", emP: "Each game is analyzed once, in the background. After about 60 games this page can tell me whether I am improving, which mistakes keep coming back and which tactics I miss.", emBtn: "Import from chess.com", exTitle: "Examples", played2: "I played {p}", better2: "Better: {b}", openGame: "Open game", analyzedShort: "{n} analyzed", blocksOf: "blocks of {n}",
    },
  };
  const tr = (k, vars = {}) => {
    const map = I18N[currentLang] || I18N.it;
    let s = map[k] ?? I18N.it[k] ?? k;
    for (const [a, b] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${a}\\}`, 'g'), String(b));
    return s;
  };
  const $ = id => document.getElementById(id);
  const esc = s => escHtml(String(s ?? ''));
  const fmt = (x, d = 1) => x == null || !isFinite(x) ? '—' : x.toFixed(d).replace('.', currentLang === 'it' ? ',' : '.');
  const pct = x => x == null || !isFinite(x) ? '—' : Math.round(x * 100) + '%';

  async function api(path, body) {
    const opt = body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const r = await fetch(`${API}${path}`, opt);
    return r.json().catch(() => ({}));
  }

  const ST = window.ST = {
    active: false, data: null, games: [], tc: null, color: 'all', win: 30, snapshot: null, elo: false, sec: 0, toolsOpen: false,
  };

  // ── Apertura / chiusura ─────────────────────────────────────────────
  ST.open = async function () {
    if (window.OP && OP.active) OP.close();
    if (window.HM) HM.close();
    if (window.AR) AR.close();
    if (!ST.active) ST.savedMeta = $gameMeta.innerHTML;
    ST.active = true;
    ST.level = 1; ST.topic = null; ST.row = null; ST.ex = null; ST.pageKey = null;
    document.body.classList.add('st-active');
    $('statsBtn')?.setAttribute('aria-current', 'true');
    await refresh();
  };
  ST.close = function () {
    if (ST.active && ST.savedMeta != null) $gameMeta.innerHTML = ST.savedMeta;
    ST.active = false;
    setTools(false);
    ST.level = 1; ST.row = null; ST.gv = null; ST.focusRow = null; ST.pageKey = null;
    renderPop();
    document.body.classList.remove('st-active', 'st-l3', 'st-pop');
    $('statsBtn')?.removeAttribute('aria-current');
    clearTimeout(pollTimer);
    if (typeof fitBoard === 'function') { fitBoard(); renderArrows(); }
  };

  async function refresh() {
    const [status, data] = await Promise.all([api('/api/insights/status'), api('/api/insights/data')]);
    ST.status = status;
    ST.data = data;
    if (ST.tc && ST.tc !== 'all' && !(data.games || []).some(g => g.time_class === ST.tc)) ST.tc = null;
    if (ST.tc === null) {
      // cadenza predefinita = la più giocata
      const c = {};
      (data.games || []).forEach(g => { c[g.time_class] = (c[g.time_class] || 0) + 1; });
      ST.tc = Object.keys(c).sort((a, b) => c[b] - c[a])[0] || 'all';
    }
    renderRail();
    renderPage();
    if (status.running) poll();
  }

  let pollTimer = null;
  function poll() {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      const s = await api('/api/insights/status');
      ST.status = s;
      renderAnalysisBox();
      if (s.running) poll();
      else if (ST.active) refresh();
    }, 1500);
  }

  // ── Filtri ──────────────────────────────────────────────────────────
  function filtered() {
    const all = (ST.data && ST.data.games) || [];
    return all.filter(g => (ST.tc === 'all' || g.time_class === ST.tc) && (ST.color === 'all' || g.color === ST.color));
  }

  function chips(id, options, current, onPick) {
    const box = $(id);
    box.innerHTML = options.map(o => `<button class="chip" data-v="${esc(o.v)}" aria-pressed="${o.v === current}">${esc(o.label)}${o.n != null ? ` <small>${o.n}</small>` : ''}</button>`).join('');
    box.querySelectorAll('.chip').forEach(b => b.onclick = () => onPick(b.dataset.v));
  }

  function renderRail() {
    const all = (ST.data && ST.data.games) || [];
    $('stUser').textContent = ST.data?.username || '';
    const tcs = {};
    all.forEach(g => { tcs[g.time_class] = (tcs[g.time_class] || 0) + 1; });
    chips('stTc', [{ v: 'all', label: tr('all'), n: all.length },
      ...['bullet', 'blitz', 'rapid', 'daily'].filter(k => tcs[k]).map(k => ({ v: k, label: k, n: tcs[k] }))],
      ST.tc, v => { ST.tc = v; renderRail(); renderPage(); });
    chips('stColor', [{ v: 'all', label: tr('allC') }, { v: 'white', label: tr('white') }, { v: 'black', label: tr('black') }],
      ST.color, v => { ST.color = v; renderRail(); renderPage(); });
    chips('stWin', [20, 30, 50].map(n => ({ v: String(n), label: String(n) })), String(ST.win),
      v => { ST.win = +v; renderRail(); renderPage(); });
    renderAnalysisBox();
    renderNav(ST.sec || 0);
    updateToolsSummary();
    document.querySelectorAll('[data-st]').forEach(el => { el.textContent = tr(el.dataset.st); });
  }

  function renderAnalysisBox() {
    const s = ST.status || {};
    const box = $('stAnalysis');
    const running = s.running;
    updateToolsSummary();
    box.innerHTML = `
      <div class="op-k">${esc(tr('accounts'))}</div>
      <div class="st-import"><input type="text" id="stAccounts" spellcheck="false" autocomplete="off"
        value="${esc(ST.data?.username || '')}" placeholder="username1, username2">
        <button class="btn" id="stAccSave">${esc(tr('save'))}</button></div>
      <div class="op-k">${esc(tr('period'))}</div>
      <div class="chips" id="stScopeMonths">${[3, 6, 12, 0].map(m => `<button class="chip" data-m="${m}" aria-pressed="${(s.scope?.months || 0) === m}">${esc(m ? tr('mShort', { n: m }) : tr('allTime'))}</button>`).join('')}</div>
      <div class="op-k">${esc(tr('tcsScope'))}</div>
      <div class="chips" id="stScopeTcs">${['bullet', 'blitz', 'rapid', 'daily'].map(t => `<button class="chip" data-t="${t}" aria-pressed="${(s.scope?.time_classes || []).includes(t)}">${t}</button>`).join('')}</div>
      <div class="op-note">${esc(tr('scopeHint'))}</div>
      <div class="op-note st-an-t">${esc(running ? tr('analyzing', { d: s.done, t: s.total }) : tr('analyzed', { n: s.analyzed || 0, p: s.pending || 0 }))}</div>
      ${running ? `<div class="progress-bar"><div class="progress-fill" style="width:${s.total ? Math.round(100 * s.done / s.total) : 3}%"></div></div>` : ''}
      <button class="btn btn-wide ${running ? '' : 'btn-primary'}" id="stAnalyzeBtn" ${!running && !s.pending ? 'disabled' : ''}>${esc(running ? tr('stop') : tr('analyze'))}</button>
      <div class="st-import"><select id="stMonths">${[1, 2, 3, 6, 12].map(m => `<option value="${m}" ${m === 6 ? 'selected' : ''}>${m} ${esc(tr('months'))}</option>`).join('')}</select>
      <button class="btn" id="stImportBtn">${esc(tr('importCc'))}</button></div>
      <div class="op-note" id="stImportMsg">${s.error ? esc(s.error) : ''}</div>`;
    const saveScope = async body => {
      await api('/api/insights/scope', body);
      await refresh();
    };
    box.querySelectorAll('#stScopeMonths .chip').forEach(b => b.onclick = () => saveScope({ months: +b.dataset.m }));
    box.querySelectorAll('#stScopeTcs .chip').forEach(b => b.onclick = () => {
      const cur = new Set(s.scope?.time_classes || []);
      cur.has(b.dataset.t) ? cur.delete(b.dataset.t) : cur.add(b.dataset.t);
      saveScope({ time_classes: [...cur] });
    });
    $('stAccSave').onclick = async () => {
      await api('/api/rep/settings', { chesscom_username: $('stAccounts').value });
      $('stImportMsg').textContent = tr('saved');
      await refresh();
    };
    $('stAnalyzeBtn').onclick = async () => {
      await api('/api/insights/analyze', running ? { stop: true } : {});
      ST.status = await api('/api/insights/status');
      renderAnalysisBox();
      poll();
    };
    $('stImportBtn').onclick = async () => {
      $('stImportMsg').textContent = tr('importing');
      const r = await api('/api/rep/games/sync', { months: +$('stMonths').value });
      $('stImportMsg').textContent = r.ok ? tr('imported', { a: r.added }) : (r.error || 'Errore');
      ST.status = await api('/api/insights/status');
      renderAnalysisBox();
    };
  }

  // ── Statistica: stato di un tema tra "prima" e "ora" ────────────────
  const MIN_N = { rate: 150, opp: 5 };
  function judge(k1, n1, k2, n2, lowerIsBetter = true, minN = 5) {
    if (!n1 && !n2) return 'few';
    if (k1 + k2 === 0) return 'none';
    if (n1 >= minN && n2 < minN) return 'less';
    if (n1 < minN || n2 < minN) return 'few';
    const p1 = k1 / n1, p2 = k2 / n2, p = (k1 + k2) / (n1 + n2);
    const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2)) || 1e-9;
    const z = (p2 - p1) / se;
    const better = lowerIsBetter ? z < 0 : z > 0;
    const rel = Math.abs(p2 - p1) / Math.max(p1, 1e-9);
    if (Math.abs(z) >= 1.64) {
      if (!better) return 'worse';
      return lowerIsBetter && p2 <= p1 * 0.35 ? 'solved' : 'improving';
    }
    if (rel >= 0.25) return better ? 'trend_better' : 'trend_worse';
    return lowerIsBetter ? 'stable' : 'ok';
  }
  const GOOD = new Set(['solved', 'improving', 'trend_better']);
  const BAD = new Set(['worse', 'trend_worse', 'stable']);
  const badge = st => `<span class="st-badge st-${st}">${esc(tr('st_' + st))}</span>`;

  function sparkline(series) {
    const pts = series.filter(v => v != null && isFinite(v));
    if (pts.length < 2) return '<span class="op-dim">—</span>';
    const max = Math.max(...pts, 1e-9), min = Math.min(...pts, 0);
    const w = 96, h = 22;
    const xs = series.map((v, i) => [i / (series.length - 1) * w, v]);
    const d = xs.filter(p => p[1] != null && isFinite(p[1]))
      .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${(h - 2 - (p[1] - min) / (max - min || 1) * (h - 4)).toFixed(1)}`).join('');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${d}"/></svg>`;
  }

  /** k/n per partita → serie mobile su `win` partite. */
  function rolling(games, getK, getN, scale = 1) {
    const out = [];
    const W = ST.win;
    for (let i = 0; i < games.length; i++) {
      if (i < Math.min(W, games.length) - 1) { out.push(null); continue; }
      let k = 0, n = 0;
      for (let j = Math.max(0, i - W + 1); j <= i; j++) { k += getK(games[j]); n += getN(games[j]); }
      out.push(n ? scale * k / n : null);
    }
    return out;
  }

  function split(games) {
    const W = ST.win;
    let prev, now;
    if (games.length >= 2 * W) { now = games.slice(-W); prev = games.slice(-2 * W, -W); }
    else { const h = Math.floor(games.length / 2); prev = games.slice(0, h); now = games.slice(h); }
    return { prev, now };
  }
  const sum = (gs, f) => gs.reduce((a, g) => a + (f(g) || 0), 0);
  const mean = (gs, f) => { const v = gs.map(f).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const userMoves = g => Math.max(0, (g.agg.moves || 0) - (g.agg.book_moves || 0));

  // ── Pagina ─────────────────────────────────────────────────────────
  const verd = st => ({ solved: 'better', improving: 'better', trend_better: 'better', stable: 'same', persistent: 'same', ok: 'same',
                        worse: 'worse', trend_worse: 'worse' }[st] || 'few');
  const vbadge = v => `<span class="vb vb-${v}">${esc(tr('v_' + v))}</span>`;
  const SECS = [];
  // ── metriche (stessa logica di prima) ──
  function errorRows(prev, now, games) {
    const rows = [];
    const tagRate = (key, labelKey, unitKey, expo) => rows.push({
      key, label: tr(labelKey), what: tr('w_' + key), unit: tr(unitKey),
      k1: sum(prev, g => g.agg.tags?.[key]), n1: sum(prev, expo),
      k2: sum(now, g => g.agg.tags?.[key]), n2: sum(now, expo),
      scale: unitKey === 'u_moves' ? 100 : 1, isPct: unitKey !== 'u_moves',
      kind: 'tag:' + key,
    });
    rows.push({ key: 'blunder', label: tr('e_blunder'), what: tr('w_blunder'), unit: '',
      k1: sum(prev, g => g.agg.blunder), n1: sum(prev, userMoves), k2: sum(now, g => g.agg.blunder), n2: sum(now, userMoves), scale: 100 });
    tagRate('hung', 'e_hung', 'u_moves', userMoves);
    tagRate('missed_threat', 'e_missed_threat', 'u_threat', g => g.agg.threat_positions || 0);
    tagRate('time', 'e_time', 'u_err', g => g.agg.errors || 0);
    for (const m of ['mate', 'fork', 'pin', 'skewer', 'discovered', 'material']) {
      const key = 'allowed_' + m;
      rows.push({ key, label: tr('e_allowed', { m: tr('m_' + m) }), what: tr('w_allowed', { m: tr('m_' + m) }), unit: '',
        k1: sum(prev, g => g.agg.tags?.[key]), n1: sum(prev, userMoves),
        k2: sum(now, g => g.agg.tags?.[key]), n2: sum(now, userMoves), scale: 100, kind: 'tag:' + key });
    }
    rows.forEach(r => {
      r.minN = r.scale === 100 ? MIN_N.rate : MIN_N.opp;
      r.st = judge(r.k1, r.n1, r.k2, r.n2, true, r.minN);
      r.v1 = r.n1 ? r.k1 / r.n1 * (r.scale || 1) : null;
      r.v2 = r.n2 ? r.k2 / r.n2 * (r.scale || 1) : null;
    });
    return rows;
  }

  function tacticRows(prev, now) {
    return ['mate', 'fork', 'pin', 'skewer', 'discovered', 'material', 'promotion', 'other'].map(m => {
      const o = g => g.agg.opp?.[m]?.[0] || 0, f = g => g.agg.opp?.[m]?.[1] || 0;
      const n1 = sum(prev, o), k1 = sum(prev, f), n2 = sum(now, o), k2 = sum(now, f);
      return { m, n1, k1, n2, k2, st: judge(k1, n1, k2, n2, false, MIN_N.opp) };
    }).filter(r => r.n1 + r.n2 > 0);
  }

  const family = g => (g.opening || '—').split(':')[0].trim() || '—';
  function openingRows(prev, now) {
    const byFam = new Map();
    const add = (g, when) => {
      const f = family(g);
      if (!byFam.has(f)) byFam.set(f, { name: f, prev: [], now: [], all: [] });
      byFam.get(f)[when].push(g);
      byFam.get(f).all.push(g);
    };
    prev.forEach(g => add(g, 'prev'));
    now.forEach(g => add(g, 'now'));
    return [...byFam.values()].map(o => {
      const withRep = o.all.filter(g => g.rep && g.rep.chapter_id);
      const followed = withRep.filter(g => g.rep.status !== 'you');
      const w = o.now.filter(g => g.color === 'white').length;
      return { name: o.name, gNow: o.now.length, scoreNow: mean(o.now, g => g.score), accNow: mean(o.now, g => g.acc15),
               faith: withRep.length ? followed.length / withRep.length : null, repN: withRep.length,
               color: w * 2 >= o.now.length ? 'white' : 'black', chapter: (withRep[0] || {}).rep?.chapter_id || null };
    }).filter(o => o.gNow > 0).sort((a, b) => b.gNow - a.gNow);
  }

  function chartHTML(games, prev, now) {
    const shown = prev.concat(now), N = shown.length, W = now.length;
    const accs = shown.map(g => g.accuracy);
    const bars = shown.map((g, i) => {
      const a = g.accuracy == null ? 50 : g.accuracy, isNow = i >= prev.length;
      const meta = `${g.date || ''} · vs ${g.opponent || '?'} · ${g.accuracy != null ? fmt(g.accuracy) + '%' : '—'}`;
      return `<span class="cb2${isNow ? ' now' : ''}" data-meta="${esc(meta)}" data-k="${esc(g.game_key)}" style="height:${Math.max(2, (a - 50) * 2).toFixed(1)}%"></span>`;
    }).join('');
    const pts = accs.map((_, i) => { const w = accs.slice(Math.max(0, i - 4), i + 1).filter(v => v != null); const m = w.length ? w.reduce((x, y) => x + y, 0) / w.length : 50; return [(i + 0.5) / N * 600, 260 - (m - 50) * 2 / 100 * 260]; });
    const avgPath = 'M' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L');
    const elos = shown.map(g => g.opp_elo || null), ev = elos.filter(Boolean);
    const lo = Math.min(...ev, 1e9), hi = Math.max(...ev, 0), span = (hi - lo) || 1;
    const eloPath = ev.length > 1 ? 'M' + elos.map((e, i) => e ? [((i + 0.5) / N * 600).toFixed(1), (260 - (e - lo) / span * 240 - 10).toFixed(1)].join(' ') : null).filter(Boolean).join(' L') : '';
    return `<div class="sp-chart"><div class="sp-cl"><span class="gc-k">${esc(tr('chAcc'))}</span><span><i class="lb"></i>${esc(tr('chBar'))}</span><span><i class="ll"></i>${esc(tr('chAvg'))}</span>` +
      `<button data-a="elo" style="opacity:${ST.elo ? 1 : .55}"><i class="ld"></i>${esc(tr('chElo'))} ${ST.elo ? '· on' : '· off'}</button><span style="flex:1"></span><span class="sp-hover" id="spHover">${esc(tr('chHover'))}</span></div>` +
      `<div class="sp-cg"><div class="sp-ax"><span style="top:32px">100%</span><span style="top:calc(40px + 50% - 30px)">75%</span><span style="bottom:-8px">50%</span></div>` +
      `<div class="sp-cbox"><div class="sp-prev" style="width:${(prev.length / N * 100).toFixed(2)}%"></div><span class="sp-tp">${esc(tr('chPrev', { w: prev.length }))}</span>` +
      `<span class="sp-tn" style="left:calc(${(prev.length / N * 100).toFixed(2)}% + 16px)">${esc(tr('chNow', { w: W }))}</span><i class="sp-g1"></i><i class="sp-g2"></i>` +
      `<div class="sp-bars">${bars}</div><svg viewBox="0 0 600 260" preserveAspectRatio="none"><path d="${avgPath}" class="avg"/>${eloPath ? `<path d="${eloPath}" class="elo" style="opacity:${ST.elo ? 1 : 0}"/>` : ''}</svg></div>` +
      `<span></span><span class="sp-ends"><span>${esc(tr('chOld'))}</span><span>${esc(tr('chNew'))}</span></span></div></div>`;
  }

  // ── interazioni della pagina ──
  function bindPage() {
    const page = $('statsBody');
    const hov = $('spHover');
    page.querySelectorAll('.cb2').forEach(b => {
      b.onmouseenter = () => { if (hov) hov.textContent = b.dataset.meta; };
      b.onclick = () => openGame(b.dataset.k, 1);
    });
  }


  // ══════════════════════════════════════════════════════════════════════
  //  STATISTICHE v3 — tre livelli: panoramica · tema · esempi / partite
  // ══════════════════════════════════════════════════════════════════════
  Object.assign(I18N.it, {
    s3Title: 'Come sto andando', s3Sub: 'Ultime {w} partite contro le {p} precedenti · {n} partite {tc} analizzate',
    s3Filters: 'Filtri e analisi', s3Both: 'Entrambi', s3AllTc: 'Tutte',
    vb_better: 'Meglio', vb_work: 'Da lavorare', vb_same: 'Stabile', vb_few: 'Pochi dati',
    g_work: 'Da lavorare', g_better: 'Migliorato', g_same: 'Stabile', g_few: 'Pochi dati',
    q_improving: 'Sto migliorando?', q_work: 'Su cosa devo lavorare?', q_tactics: 'Quali tattiche mi sfuggono?',
    q_openings: 'Come vanno le mie aperture?', q_phases: 'Dove perdo punti?', q_opponents: 'Contro chi gioco?',
    k_improving: 'Precisione e punti · prima → ora', k_work: 'Ogni 100 delle mie mosse · prima → ora',
    k_tactics: 'Quota trovata quando vinceva una sola mossa', k_openings: 'Punti fatti per apertura · prima → ora',
    k_phases: 'Precisione per fase della partita', k_opponents: 'Avversari e risultati · prima → ora',
    lg_up: 'più a destra = meglio', lg_down: 'più a sinistra = meno errori', lg_mix: 'scale diverse per riga',
    lgPrev: 'prima', lgNow: 'ora',
    c_acc: 'Precisione media, partita per partita', c_bl: 'Errori gravi ogni 100 mosse', c_tac: 'Tattiche trovate quando vinceva una sola mossa',
    c_op: 'Punti con la {o}, la più giocata', c_mid: 'Precisione nel mediogioco', c_elo: 'Elo medio degli avversari',
    f_games: 'Ultime {n} partite', f_first: 'Primo tema: {t}', f_none: 'Nessun tema in peggioramento',
    f_tac: '{n} occasioni ora', f_tacFew: 'Solo {n} occasioni: pochi dati', f_op: 'Peggiore: {o} ({v})', f_ph: 'Apertura {a} · Finale {b}',
    f_opp: 'Punti contro i più forti: {v}',
    r_acc: 'Precisione', r_accD: 'Quanto le mie mosse si avvicinano a quelle del motore',
    r_pts: 'Punti fatti', r_ptsD: 'Vittoria = 1, patta = ½ · {a} → {b} partite',
    r_accW: 'Precisione con il Bianco', r_accB: 'Precisione con il Nero', r_ptsW: 'Punti con il Bianco', r_ptsB: 'Punti con il Nero',
    r_nGames: '{a} → {b} partite', r_occ: 'Occasioni: {a} → {b}',
    r_tt: 'Partite in zeitnot', r_ttD: 'Partite in cui sono sceso sotto il 10% del tempo',
    r_tw: 'Partite con vantaggio buttato', r_twD: 'Da posizione vinta a pari o persa',
    r_ph_open: 'Le prime mosse, fino allo sviluppo', r_ph_middle: 'Dalla fine dell’apertura alla semplificazione', r_ph_end: 'Pochi pezzi sulla scacchiera',
    r_elo: 'Elo medio degli avversari', r_eloD: 'Più a destra = avversari più forti',
    r_weak: 'Punti contro avversari più deboli', r_sim: 'Punti contro avversari simili', r_strong: 'Punti contro avversari più forti',
    r_band: 'Elo {r} · {a} → {b} partite',
    s_imp_up: 'Sì: la precisione sale da {a} a {b}.', s_imp_down: 'No: la precisione scende da {a} a {b}.', s_imp_same: 'Stabile: precisione da {a} a {b}.',
    s_work: '{w} temi da lavorare, {b} migliorati.', s_tac: '{n} occasioni nelle ultime partite.', s_op: '{n} aperture giocate nelle ultime partite.',
    s_ph: 'Il mediogioco va da {a} a {b}.', s_opp: 'Elo medio degli avversari da {a} a {b}.',
    cta_ex: 'Esempi →', cta_games: 'Partite →', cta_op: 'Apertura →',
    ex_of: '{t} · esempio {i} di {n}', ex_played: 'Ho giocato', ex_best: 'Migliore', ex_win: 'Probabilità di vittoria · {ph}',
    ex_open: 'Apri la partita', ex_prev: 'Esempio precedente', ex_next: 'Esempio successivo', ex_vs: 'Contro {o} · {d}',
    cls_blunder: 'Errore grave', cls_mistake: 'Errore', cls_inaccuracy: 'Imprecisione', cls_missed: 'Occasione mancata',
    ph_open: 'apertura', ph_middle: 'mediogioco', ph_end: 'finale',
    gl_title: '{n} partite', gl_open: 'Apri →', gl_none: 'Nessuna partita in questo filtro.',
    res_w: 'Vinta', res_d: 'Patta', res_l: 'Persa', loading: 'Carico…', pp_close: 'Chiudi', gv_k: 'Partita', gv_vs: 'Contro {o}', gv_backEx: 'Esempi', gv_backList: 'Partite', gv_an: 'Analizza partita', gv_err: 'Non trovo questa partita.', gv_mine: 'Mia mossa', gv_opp: 'Mossa dell’avversario', gv_start: 'Posizione iniziale', gv_first: 'Inizio', gv_prev: 'Mossa precedente', gv_next: 'Mossa successiva', gv_last: 'Fine',
  });
  Object.assign(I18N.en, {
    s3Title: 'How am I doing', s3Sub: 'Last {w} games against the {p} before · {n} {tc} games analyzed',
    s3Filters: 'Filters & analysis', s3Both: 'Both', s3AllTc: 'All',
    vb_better: 'Better', vb_work: 'To work on', vb_same: 'Stable', vb_few: 'Few data',
    g_work: 'To work on', g_better: 'Improved', g_same: 'Stable', g_few: 'Few data',
    q_improving: 'Am I improving?', q_work: 'What should I work on?', q_tactics: 'Which tactics do I miss?',
    q_openings: 'How do my openings go?', q_phases: 'Where do I lose points?', q_opponents: 'Who do I play against?',
    k_improving: 'Accuracy and score · before → now', k_work: 'Per 100 of my moves · before → now',
    k_tactics: 'Share found when only one move won', k_openings: 'Score by opening · before → now',
    k_phases: 'Accuracy by phase of the game', k_opponents: 'Opponents and results · before → now',
    lg_up: 'further right = better', lg_down: 'further left = fewer mistakes', lg_mix: 'each row has its own scale',
    lgPrev: 'before', lgNow: 'now',
    c_acc: 'Average accuracy, game by game', c_bl: 'Blunders per 100 moves', c_tac: 'Tactics found when only one move won',
    c_op: 'Score with the {o}, my most played', c_mid: 'Middlegame accuracy', c_elo: 'Average opponent Elo',
    f_games: 'Last {n} games', f_first: 'First theme: {t}', f_none: 'No theme getting worse',
    f_tac: '{n} chances now', f_tacFew: 'Only {n} chances: few data', f_op: 'Worst: {o} ({v})', f_ph: 'Opening {a} · Endgame {b}',
    f_opp: 'Score against stronger players: {v}',
    r_acc: 'Accuracy', r_accD: 'How close my moves are to the engine',
    r_pts: 'Score', r_ptsD: 'Win = 1, draw = ½ · {a} → {b} games',
    r_accW: 'Accuracy as White', r_accB: 'Accuracy as Black', r_ptsW: 'Score as White', r_ptsB: 'Score as Black',
    r_nGames: '{a} → {b} games', r_occ: 'Chances: {a} → {b}',
    r_tt: 'Games in time trouble', r_ttD: 'Games where I dropped below 10% of my time',
    r_tw: 'Games with a win thrown away', r_twD: 'From winning to equal or lost',
    r_ph_open: 'The first moves, up to development', r_ph_middle: 'From the end of the opening to simplification', r_ph_end: 'Few pieces left on the board',
    r_elo: 'Average opponent Elo', r_eloD: 'Further right = stronger opponents',
    r_weak: 'Score against weaker opponents', r_sim: 'Score against similar opponents', r_strong: 'Score against stronger opponents',
    r_band: 'Elo {r} · {a} → {b} games',
    s_imp_up: 'Yes: accuracy rises from {a} to {b}.', s_imp_down: 'No: accuracy drops from {a} to {b}.', s_imp_same: 'Stable: accuracy from {a} to {b}.',
    s_work: '{w} themes to work on, {b} improved.', s_tac: '{n} chances in the latest games.', s_op: '{n} openings played in the latest games.',
    s_ph: 'Middlegame goes from {a} to {b}.', s_opp: 'Average opponent Elo from {a} to {b}.',
    cta_ex: 'Examples →', cta_games: 'Games →', cta_op: 'Opening →',
    ex_of: '{t} · example {i} of {n}', ex_played: 'I played', ex_best: 'Best', ex_win: 'Winning chances · {ph}',
    ex_open: 'Open the game', ex_prev: 'Previous example', ex_next: 'Next example', ex_vs: 'Against {o} · {d}',
    cls_blunder: 'Blunder', cls_mistake: 'Mistake', cls_inaccuracy: 'Inaccuracy', cls_missed: 'Missed chance',
    ph_open: 'opening', ph_middle: 'middlegame', ph_end: 'endgame',
    gl_title: '{n} games', gl_open: 'Open →', gl_none: 'No games for this filter.',
    res_w: 'Won', res_d: 'Draw', res_l: 'Lost', loading: 'Loading…', pp_close: 'Close', gv_k: 'Game', gv_vs: 'Against {o}', gv_backEx: 'Examples', gv_backList: 'Games', gv_an: 'Analyze game', gv_err: 'Game not found.', gv_mine: 'My move', gv_opp: 'Opponent’s move', gv_start: 'Starting position', gv_first: 'Start', gv_prev: 'Previous move', gv_next: 'Next move', gv_last: 'End',
  });

  const TOPICS = ['improving', 'work', 'tactics', 'openings', 'phases', 'opponents'];
  const GROUPS = ['work', 'better', 'same', 'few'];
  const ICON = { blunder: 'icon_blunder_move.svg', mistake: 'icon_mistake_move.svg', inaccuracy: 'icon_inaccuracy_move.svg', best: 'icon_best_move.svg' };
  ST.level = 1; ST.topic = null; ST.row = null; ST.ex = null; ST.exI = 0; ST.lastRow = null;

  const fdate = d => { if (!d) return ''; const t = new Date(d + 'T12:00:00'); return isNaN(t) ? d : t.toLocaleDateString(currentLang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short', year: t.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }); };
  const pctTxt = v => v == null ? '—' : Math.round(v) + '%';
  const numTxt = (v, d = 1) => v == null ? '—' : fmt(v, d);
  const byDiff = (a, b, step, n1, n2, minN = 5, lowerBetter = false) => {
    if (a == null || b == null || n1 < minN || n2 < minN) return 'few';
    const d = lowerBetter ? a - b : b - a;
    return d >= step ? 'better' : d <= -step ? 'work' : 'same';
  };
  const fromJudge = (st, k2) => GOOD.has(st) ? 'better'
    : (['worse', 'trend_worse'].includes(st) || (['stable', 'persistent'].includes(st) && k2 > 0)) ? 'work'
    : ['few', 'less', 'none'].includes(st) ? 'few' : 'same';
  const score100 = gs => gs.length ? 100 * sum(gs, g => g.score) / gs.length : null;
  const niceMax = v => { const s = [1, 2, 2.5, 5, 10]; let m = Math.pow(10, Math.floor(Math.log10(Math.max(v, 0.1)))); for (const k of s) if (k * m >= v) return k * m; return 10 * m; };

  function row(o) {
    return Object.assign({ lo: 0, hi: 100, fb: o.fmt ? o.fmt(o.b) : pctTxt(o.b), fn: o.fmt ? o.fmt(o.n) : pctTxt(o.n) }, o);
  }

  // ── modello: tutti i temi dalle partite filtrate ──
  function model() {
    const games = filtered();
    const { prev, now } = split(games);
    const T = {};
    // 01 sto migliorando
    {
      const rows = [];
      const accRow = (id, name, P, N) => row({ id, name, desc: id === 'acc' ? tr('r_accD') : tr('r_nGames', { a: P.length, b: N.length }),
        b: mean(P, g => g.accuracy), n: mean(N, g => g.accuracy), lo: 40, hi: 100, go: { type: 'games', filter: g => P.includes(g) || N.includes(g) } });
      const ptsRow = (id, name, P, N) => row({ id, name, desc: id === 'pts' ? tr('r_ptsD', { a: P.length, b: N.length }) : tr('r_nGames', { a: P.length, b: N.length }),
        b: score100(P), n: score100(N), go: { type: 'games', filter: g => P.includes(g) || N.includes(g) } });
      const a = accRow('acc', tr('r_acc'), prev, now); a.st = byDiff(a.b, a.n, 1, prev.length, now.length); rows.push(a);
      const p = ptsRow('pts', tr('r_pts'), prev, now); p.st = byDiff(p.b, p.n, 5, prev.length, now.length); rows.push(p);
      if (ST.color === 'all') {
        for (const c of ['white', 'black']) {
          const P = prev.filter(g => g.color === c), N = now.filter(g => g.color === c);
          const ra = accRow('acc_' + c, tr(c === 'white' ? 'r_accW' : 'r_accB'), P, N); ra.st = byDiff(ra.b, ra.n, 1, P.length, N.length); rows.push(ra);
          const rp = ptsRow('pts_' + c, tr(c === 'white' ? 'r_ptsW' : 'r_ptsB'), P, N); rp.st = byDiff(rp.b, rp.n, 5, P.length, N.length); rows.push(rp);
        }
      }
      const s = a.st === 'better' ? 's_imp_up' : a.st === 'work' ? 's_imp_down' : 's_imp_same';
      T.improving = { rows, legend: tr('lg_up'), chart: true, summary: tr(s, { a: pctTxt(a.b), b: pctTxt(a.n) }),
        card: { b: a.fb, n: a.fn, what: tr('c_acc'), v: a.st, foot: tr('f_games', { n: now.length }) } };
    }
    // 02 su cosa lavorare
    {
      const er = errorRows(prev, now, games).filter(r => r.k1 + r.k2 > 0 || r.key === 'blunder');
      const hiMoves = niceMax(Math.max(1, ...er.filter(r => !r.isPct).map(r => Math.max(r.v1 || 0, r.v2 || 0))) * 1.1);
      const rows = er.map(r => row({ id: r.key, name: r.label, desc: r.what, b: r.isPct ? (r.v1 == null ? null : r.v1 * 100) : r.v1, n: r.isPct ? (r.v2 == null ? null : r.v2 * 100) : r.v2,
        lo: 0, hi: r.isPct ? 100 : hiMoves, fmt: r.isPct ? pctTxt : v => numTxt(v, 1), st: fromJudge(r.st, r.k2), lowerBetter: true,
        icon: r.key === 'blunder' ? ICON.blunder : null, go: { type: 'ex', kind: r.kind || 'cls:blunder' } }));
      const bl = rows[0], first = rows.find(r => r.st === 'work' && r.id !== 'blunder');
      T.work = { rows, legend: tr('lg_down'), summary: tr('s_work', { w: rows.filter(r => r.st === 'work').length, b: rows.filter(r => r.st === 'better').length }),
        card: { b: bl.fb, n: bl.fn, what: tr('c_bl'), v: bl.st, foot: first ? tr('f_first', { t: first.name }) : tr('f_none') } };
    }
    // 03 tattiche
    {
      const tr0 = tacticRows(prev, now);
      const rows = tr0.map(r => row({ id: r.m, name: tr('m_' + r.m), desc: tr('r_occ', { a: r.n1, b: r.n2 }),
        b: r.n1 ? 100 * r.k1 / r.n1 : null, n: r.n2 ? 100 * r.k2 / r.n2 : null, st: fromJudge(r.st, 0), go: { type: 'ex', kind: 'missed:' + r.m } }));
      let n1 = 0, k1 = 0, n2 = 0, k2 = 0; tr0.forEach(r => { n1 += r.n1; k1 += r.k1; n2 += r.n2; k2 += r.k2; });
      const st = fromJudge(judge(k1, n1, k2, n2, false, MIN_N.opp), 0);
      T.tactics = { rows, legend: tr('lg_up'), summary: tr('s_tac', { n: n2 }),
        card: { b: pctTxt(n1 ? 100 * k1 / n1 : null), n: pctTxt(n2 ? 100 * k2 / n2 : null), what: tr('c_tac'), v: st, foot: n2 < 10 ? tr('f_tacFew', { n: n2 }) : tr('f_tac', { n: n2 }) } };
    }
    // 04 aperture
    {
      const fam = new Map();
      const add = (g, w) => { const f = family(g); if (!fam.has(f)) fam.set(f, { name: f, prev: [], now: [], chapter: null });
        const o = fam.get(f); o[w].push(g); if (!o.chapter && g.rep && g.rep.chapter_id) o.chapter = g.rep.chapter_id; };
      prev.forEach(g => add(g, 'prev')); now.forEach(g => add(g, 'now'));
      const list = [...fam.values()].filter(o => o.prev.length + o.now.length >= 2).sort((a, b) => (b.prev.length + b.now.length) - (a.prev.length + a.now.length)).slice(0, 10);
      const rows = list.map(o => row({ id: 'op:' + o.name, name: o.name, desc: tr('r_nGames', { a: o.prev.length, b: o.now.length }),
        b: score100(o.prev), n: score100(o.now), st: byDiff(score100(o.prev), score100(o.now), 10, o.prev.length, o.now.length, 3),
        go: o.chapter ? { type: 'op', chapter: o.chapter, name: o.name } : { type: 'games', filter: g => family(g) === o.name } }));
      const top = rows[0], worst = rows.filter(r => r.st !== 'few' && r.n != null).sort((a, b) => a.n - b.n)[0];
      T.openings = { rows, legend: tr('lg_up'), summary: tr('s_op', { n: rows.length }),
        card: top ? { b: top.fb, n: top.fn, what: tr('c_op', { o: top.name }), v: top.st, foot: worst ? tr('f_op', { o: worst.name, v: worst.fn }) : '' }
                  : { b: '—', n: '—', what: '', v: 'few', foot: '' } };
    }
    // 05 fasi
    {
      const ph = (k, key, phase) => { const P = prev.filter(g => g[k] != null), N = now.filter(g => g[k] != null);
        return row({ id: key, name: tr(key), desc: tr('r_ph_' + phase) + ' · ' + tr('r_nGames', { a: P.length, b: N.length }),
          b: mean(P, g => g[k]), n: mean(N, g => g[k]), lo: 50, hi: 100, st: byDiff(mean(P, g => g[k]), mean(N, g => g[k]), 2, P.length, N.length),
          go: { type: 'ex', kind: 'phase:' + phase } }); };
      const mid = ph('acc_middle', 'phMiddle', 'middle'), op = ph('acc_opening', 'phOpen', 'open'), en = ph('acc_end', 'phEnd', 'end');
      const share = (gs, f) => gs.length ? 100 * gs.filter(f).length / gs.length : null;
      const ttf = g => g.time_trouble, twf = g => (g.agg.tags?.thrown_win || 0) > 0;
      const tt = row({ id: 'tt', name: tr('r_tt'), desc: tr('r_ttD'), b: share(prev, ttf), n: share(now, ttf), lowerBetter: true,
        st: fromJudge(judge(prev.filter(ttf).length, prev.length, now.filter(ttf).length, now.length, true, 5), now.filter(ttf).length), go: { type: 'ex', kind: 'tag:time' } });
      const tw = row({ id: 'tw', name: tr('r_tw'), desc: tr('r_twD'), b: share(prev, twf), n: share(now, twf), lowerBetter: true,
        st: fromJudge(judge(prev.filter(twf).length, prev.length, now.filter(twf).length, now.length, true, 5), now.filter(twf).length), go: { type: 'ex', kind: 'tag:thrown_win' } });
      T.phases = { rows: [mid, op, en, tt, tw], legend: tr('lg_mix'), summary: tr('s_ph', { a: mid.fb, b: mid.fn }),
        card: { b: mid.fb, n: mid.fn, what: tr('c_mid'), v: mid.st, foot: tr('f_ph', { a: op.fn, b: en.fn }) } };
    }
    // 06 avversari
    {
      const all = prev.concat(now).filter(g => g.opp_elo);
      const m = mean(all, g => g.opp_elo) || 0;
      const e1 = mean(prev, g => g.opp_elo), e2 = mean(now, g => g.opp_elo);
      const lo = Math.floor((Math.min(e1 || m, e2 || m) - 150) / 50) * 50;
      const elo = row({ id: 'elo', name: tr('r_elo'), desc: tr('r_eloD'), b: e1, n: e2, lo, hi: lo + 300, fmt: v => v == null ? '—' : String(Math.round(v)),
        st: e1 == null || e2 == null ? 'few' : (e2 - e1 >= 30 ? 'better' : 'same'), go: { type: 'games', filter: () => true } });
      const band = (id, f, r) => { const P = prev.filter(f), N = now.filter(f);
        return row({ id, name: tr(id), desc: tr('r_band', { r, a: P.length, b: N.length }), b: score100(P), n: score100(N),
          st: byDiff(score100(P), score100(N), 10, P.length, N.length, 3), go: { type: 'games', filter: f } }); };
      const mm = Math.round(m);
      const weak = band('r_weak', g => g.opp_elo && g.opp_elo < m - 50, '< ' + (mm - 50));
      const sim = band('r_sim', g => g.opp_elo && Math.abs(g.opp_elo - m) <= 50, (mm - 50) + '–' + (mm + 50));
      const strong = band('r_strong', g => g.opp_elo && g.opp_elo > m + 50, '> ' + (mm + 50));
      T.opponents = { rows: [elo, weak, sim, strong], legend: tr('lg_mix'), summary: tr('s_opp', { a: elo.fb, b: elo.fn }),
        card: { b: elo.fb, n: elo.fn, what: tr('c_elo'), v: elo.st, foot: tr('f_opp', { v: strong.fn }) } };
    }
    return { games, prev, now, T };
  }

  // ── rendering ──
  const vpill = v => `<span class="s3-pill ${v}">${esc(tr('vb_' + v))}</span>`;
  function crumbs() {
    const l = (lv, txt) => `<button type="button" class="cr-l" data-stlv="${lv}">${esc(txt)}</button>`, sep = ' <span class="cr-s">/</span> ';
    if (ST.level === 1) return `<b>${esc(tr('stats'))}</b>`;
    return l(1, tr('stats')) + sep + `<b>${esc(tr('q_' + ST.topic))}</b>`;
  }

  function l1HTML(M) {
    const tcs = {};
    ((ST.data && ST.data.games) || []).forEach(g => { tcs[g.time_class] = (tcs[g.time_class] || 0) + 1; });
    const seg = (name, opts, cur) => `<div class="s3-seg" role="group" aria-label="${esc(name)}">` +
      opts.map(o => `<button type="button" data-${name}="${esc(o.v)}" aria-pressed="${o.v === cur}">${esc(o.l)}</button>`).join('') + '</div>';
    const tcLabel = ST.tc === 'all' ? tr('s3AllTc').toLowerCase() : ST.tc;
    const head = `<header class="s3-head"><div class="s3-ttl"><h1>${esc(tr('s3Title'))}</h1>` +
      `<span class="s3-sub">${esc(tr('s3Sub', { w: M.now.length, p: M.prev.length, n: M.games.length, tc: tcLabel }))}</span></div>` +
      `<div class="s3-tools">${seg('tc', [{ v: 'all', l: tr('s3AllTc') }, ...['bullet', 'blitz', 'rapid', 'daily'].filter(k => tcs[k]).map(k => ({ v: k, l: k }))], ST.tc)}` +
      `${seg('col', [{ v: 'all', l: tr('s3Both') }, { v: 'white', l: tr('white') }, { v: 'black', l: tr('black') }], ST.color)}` +
      `<button type="button" class="s3-fbtn" data-a="tools" aria-expanded="${!!ST.toolsOpen}">${esc(tr('s3Filters'))} ${ST.toolsOpen ? '▴' : '▾'}</button></div></header>`;
    const cards = TOPICS.map((k, i) => { const c = M.T[k].card;
      return `<button type="button" class="s3-card" data-topic="${k}"><span class="s3-ct"><span class="s3-cn">${String(i + 1).padStart(2, '0')}</span>${vpill(c.v)}</span>` +
        `<b class="s3-cq">${esc(tr('q_' + k))}</b><span class="s3-cv"><i>${esc(c.b)}</i><i>→</i><b>${esc(c.n)}</b></span>` +
        `<span class="s3-cw">${esc(c.what)}</span><span class="s3-cf"><span>${esc(c.foot)}</span><em aria-hidden="true">→</em></span></button>`; }).join('');
    return `<div class="s3">${head}<div class="s3-grid">${cards}</div></div>`;
  }

  function trackHTML(r) {
    const P = v => Math.max(0, Math.min(100, 100 * (v - r.lo) / (r.hi - r.lo)));
    const hasB = r.b != null, hasN = r.n != null;
    let s = `<span class="s3-track" aria-hidden="true"><i class="s3-line"></i>`;
    if (hasB && hasN) { const a = P(Math.min(r.b, r.n)), z = P(Math.max(r.b, r.n)); s += `<i class="s3-seg-c" style="left:${a.toFixed(1)}%;width:${(z - a).toFixed(1)}%"></i>`; }
    if (hasB) s += `<i class="s3-dot-b" style="left:${P(r.b).toFixed(1)}%"></i>`;
    if (hasN) s += `<i class="s3-dot-n" style="left:${P(r.n).toFixed(1)}%"></i>`;
    return s + '</span>';
  }

  function l2HTML(M) {
    const t = M.T[ST.topic];
    const cta = r => tr(r.go.type === 'ex' ? 'cta_ex' : r.go.type === 'op' ? 'cta_op' : 'cta_games');
    const groups = GROUPS.map(g => { const rs = t.rows.filter(r => r.st === g); if (!rs.length) return '';
      return `<section class="s3-grp ${g}"><div class="s3-gh"><span class="s3-gl"><i></i><h2>${esc(tr('g_' + g))}</h2></span><span>${rs.length}</span></div>` +
        rs.map(r => `<button type="button" class="s3-row" data-row="${esc(r.id)}"><span class="s3-rn"><span class="s3-rt">` +
          (r.icon ? `<img alt="" src="/static/${r.icon}">` : '') + `<b>${esc(r.name)}</b></span><small>${esc(r.desc)}</small></span>${trackHTML(r)}` +
          `<span class="s3-rv"><span><i>${esc(r.fb)}</i><i>→</i><b>${esc(r.fn)}</b></span><small>${esc(cta(r))}</small></span></button>`).join('') + '</section>'; }).join('');
    const legend = `<div class="s3-leg"><span><i class="b"></i>${esc(tr('lgPrev'))}</span><span><i class="n"></i>${esc(tr('lgNow'))}</span><span>${esc(t.legend)}</span></div>`;
    return `<div class="s3 s3-l2"><header class="s3-head"><div class="s3-ttl"><span class="s3-k">${esc(String(TOPICS.indexOf(ST.topic) + 1).padStart(2, '0') + ' · ' + tr('k_' + ST.topic))}</span>` +
      `<h1>${esc(tr('q_' + ST.topic))}</h1><span class="s3-sub">${esc(t.summary)}</span></div>${legend}</header>` +
      (t.chart ? chartHTML(M.games, M.prev, M.now) : '') + `<div class="s3-groups">${groups}</div></div>`;
  }

  function boardHTML(e) {
    const flip = e.color === 'black';
    let pm = null, bm = null;
    try { const c = new Chess(e.fen); pm = e.san ? c.move(e.san, { sloppy: true }) : null; } catch {}
    try { const c = new Chess(e.fen); bm = e.best_san && e.best_san !== e.san ? c.move(e.best_san, { sloppy: true }) : null; } catch {}
    const cls = e.cls || (String(ST.ex.kind).startsWith('missed:') ? 'mistake' : null);
    const marks = {};
    if (pm) { marks[pm.from] = { hl: 1 }; marks[pm.to] = { hl: 1, icon: cls && ICON[cls] }; }
    if (bm) { marks[bm.to] = Object.assign(marks[bm.to] || {}, { icon: ICON.best }); }
    return drawBoard(e.fen, flip, marks);
  }
  function drawBoard(fen, flip, marks) {
    const rows = fen.split(' ')[0].split('/'), grid = [];
    rows.forEach(r => { const row = []; for (const ch of r) { if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) row.push(null); else row.push(ch); } grid.push(row); });
    let h = '<div class="s3-board" aria-hidden="true">';
    for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
      const r = flip ? 7 - rr : rr, c = flip ? 7 - cc : cc, p = grid[r][c], sq = 'abcdefgh'[c] + (8 - r), mk = marks[sq] || {};
      h += `<i class="${(r + c) % 2 ? 'd' : 'l'}${mk.hl ? ' hl' : ''}">` +
        (p ? `<img src="/static/pieces/${PIECE_MAP[(p === p.toUpperCase() ? 'w' : 'b') + p.toLowerCase()]}.svg" alt="">` : '') +
        (mk.icon ? `<img class="s3-ic" src="/static/${mk.icon}" alt="">` : '') + '</i>';
    }
    return h + '</div>';
  }

  // ── vista partita dentro il pop-up ──
  async function openGv(key, ply) {
    const meta = ((ST.data && ST.data.games) || []).find(g => g.game_key === key) || {};
    ST.gv = { key, ply: ply || 0, meta, loading: true, back: ST.row && ST.row.go.type === 'ex' ? 'ex' : 'list' };
    renderPop();
    const [p, a] = await Promise.all([api(`/api/rep/games/${encodeURIComponent(key)}/pgn`), api(`/api/insights/game?key=${encodeURIComponent(key)}`)]);
    if (!ST.gv || ST.gv.key !== key) return;
    const c = new Chess();
    if (!p || !p.pgn || !c.load_pgn(p.pgn, { sloppy: true })) { ST.gv.loading = false; ST.gv.err = true; renderPop(); return; }
    const start = (c.header() || {}).FEN;
    const hist = c.history({ verbose: true });
    const r = start ? new Chess(start) : new Chess();
    const fens = [r.fen()];
    hist.forEach(m => { r.move(m.san, { sloppy: true }); fens.push(r.fen()); });
    const info = {};
    ((a && a.moves) || []).forEach(m => { info[m.ply] = m; });
    Object.assign(ST.gv, { loading: false, moves: hist, fens, info, ply: Math.max(0, Math.min(ply || 0, hist.length)) });
    renderPop();
    const on = document.querySelector('.s3-mv .on'); if (on) on.scrollIntoView({ block: 'center' });
  }
  function gvGo(n) {
    const g = ST.gv; if (!g || g.loading || g.err) return;
    const k = Math.max(0, Math.min(n, g.moves.length));
    if (k === g.ply) return;
    g.ply = k; renderPop();
    const on = document.querySelector('.s3-mv .on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function gvHTML() {
    const g = ST.gv, m = g.meta;
    const res = m.score === 1 ? 'res_w' : m.score === 0 ? 'res_l' : m.score != null ? 'res_d' : null;
    const head = `<header class="s3-dh"><div><span class="s3-k">${esc(tr('gv_k') + (m.date ? ' · ' + fdate(m.date) : ''))}${statePill()}</span>` +
      `<h2>${esc(tr('gv_vs', { o: m.opponent || '?' }))}${res ? ` <em class="s3-res ${res}">· ${esc(tr(res))}</em>` : ''}</h2></div>` +
      `<div class="s3-dha"><button type="button" class="s3-back" data-a="gvback">← ${esc(tr(g.back === 'ex' ? 'gv_backEx' : 'gv_backList'))}</button>` +
      `<button type="button" class="s3-obtn pri" data-a="analyze">${esc(tr('gv_an'))} ▶</button>${xBtn()}</div></header>`;
    if (g.loading || g.err) return head + `<p class="s3-sub s3-dmsg">${esc(tr(g.err ? 'gv_err' : 'loading'))}</p>`;
    const N = g.moves.length, p = g.ply, flip = m.color === 'black';
    // elenco mosse
    let mv = '';
    for (let i = 0; i < N; i += 2) {
      const cell = j => { if (j >= N) return '<span></span>'; const ply = j + 1, inf = g.info[ply], ic = inf && inf.cls && ICON[inf.cls];
        return `<button type="button" data-gp="${ply}" class="${ply === p ? 'on' : ''}${inf ? ' me' : ''}">${esc(g.moves[j].san)}${ic ? `<img alt="${esc(tr('cls_' + inf.cls))}" src="/static/${ic}">` : ''}</button>`; };
      mv += `<span class="n">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}`;
    }
    // mossa corrente
    const cur = p > 0 ? g.moves[p - 1] : null, inf = p > 0 ? g.info[p] : null;
    const marks = {};
    let best = null;
    if (cur) { marks[cur.from] = { hl: 1 }; marks[cur.to] = { hl: 1, icon: inf && inf.cls && ICON[inf.cls] }; }
    if (inf && inf.cls && inf.best_san && inf.best_san !== inf.san) {
      try { best = new Chess(g.fens[p - 1]).move(inf.best_san, { sloppy: true }); } catch {}
      if (best) marks[best.to] = Object.assign(marks[best.to] || {}, { icon: ICON.best });
    }
    const num = cur ? `${Math.ceil(p / 2)}${p % 2 ? '.' : '…'}` : '';
    let now = `<div class="s3-gvc"><span class="s3-k">${esc(cur ? tr(inf ? 'gv_mine' : 'gv_opp') : tr('gv_start'))}</span>` +
      (cur ? `<span class="s3-gvm"><i>${esc(num)}</i><b>${esc(cur.san)}</b>${inf && inf.cls ? `<img alt="" src="/static/${ICON[inf.cls]}"><small>${esc(tr('cls_' + inf.cls))}</small>` : ''}</span>` : '') + '</div>';
    if (inf && inf.cls && best) now += `<div class="s3-best"><img alt="" src="/static/${ICON.best}"><span class="s3-k">${esc(tr('ex_best'))}</span><b>${esc(num + ' ' + inf.best_san)}</b></div>`;
    if (inf && inf.win_before != null && inf.win_after != null) now += `<div class="s3-win"><span><i>${Math.round(inf.win_before)}%</i><i>→</i><b>${Math.round(inf.win_after)}%</b></span><small>${esc(tr('ex_win', { ph: tr('ph_' + (inf.phase || 'middle')) }))}</small></div>`;
    const nb = (n, t, l, dis) => `<button type="button" class="s3-arr" data-gp="${n}" aria-label="${esc(tr(l))}"${dis ? ' disabled' : ''}>${t}</button>`;
    return head + `<div class="s3-db"><section class="s3-ex s3-gv"><div class="s3-gvt">${now}</div>` +
      `<div class="s3-mv" role="list">${mv}</div>` +
      `<div class="s3-exf">${nb(0, '⏮', 'gv_first', p === 0)}${nb(p - 1, '◀', 'gv_prev', p === 0)}<span>${p} / ${N}</span>${nb(p + 1, '▶', 'gv_next', p >= N)}${nb(N, '⏭', 'gv_last', p >= N)}</div></section>` +
      `<section class="s3-bd">${drawBoard(g.fens[p], flip, marks)}</section></div>`;
  }
  const statePill = () => ST.row && ST.row.st ? ` <span class="s3-pill ${ST.row.st}">${esc(tr('vb_' + ST.row.st))}</span>` : '';

  const xBtn = () => `<button type="button" class="s3-x" data-a="close" aria-label="${esc(tr('pp_close'))}">×</button>`;
  function l3ExHTML() {
    const X = ST.ex, list = X.list || [];
    const head = (k, h) => `<header class="s3-dh"><div><span class="s3-k">${esc(k)}${statePill()}</span><h2>${esc(h)}</h2></div>${xBtn()}</header>`;
    if (X.loading || !list.length) return head(ST.row.name, '') + `<p class="s3-sub s3-dmsg">${esc(tr(X.loading ? 'loading' : 'noExamples'))}</p>`;
    const i = Math.min(ST.exI, list.length - 1), e = list[i];
    const n = Math.ceil(e.ply / 2), num = e.ply % 2 === 1 ? `${n}.` : `${n}…`;
    const cls = e.cls || (String(X.kind).startsWith('missed:') ? 'missed' : null);
    const icon = cls && (ICON[cls] || (cls === 'missed' ? ICON.mistake : null));
    const wb = e.win_before, wa = e.win_after;
    return head(tr('ex_of', { t: ST.row.name, i: i + 1, n: list.length }), tr('ex_vs', { o: e.opponent || '?', d: fdate(e.date) })) +
      `<div class="s3-db"><section class="s3-ex">` +
      `<div class="s3-exb"><div class="s3-exm"><span class="s3-k">${esc(tr('ex_played'))}</span><span class="s3-big"><i>${esc(num)}</i><b>${esc(e.san || '—')}</b>` +
      (icon ? `<img alt="" src="/static/${icon}">` : '') + `</span>${cls ? `<small>${esc(tr('cls_' + cls))}</small>` : ''}</div>` +
      (e.best_san && e.best_san !== e.san ? `<div class="s3-best"><img alt="" src="/static/${ICON.best}"><span class="s3-k">${esc(tr('ex_best'))}</span><b>${esc(num + ' ' + e.best_san)}</b></div>` : '') +
      (wb != null && wa != null ? `<div class="s3-win"><span><i>${Math.round(wb)}%</i><i>→</i><b>${Math.round(wa)}%</b></span><small>${esc(tr('ex_win', { ph: tr('ph_' + (e.phase || 'middle')) }))}</small></div>` : '') +
      `<div><button type="button" class="s3-obtn" data-open="${esc(e.game_key)}" data-ply="${e.ply}">${esc(tr('ex_open'))}</button></div></div>` +
      `<div class="s3-exf"><button type="button" class="s3-arr" data-exi="${i - 1}" aria-label="${esc(tr('ex_prev'))}"${i > 0 ? '' : ' disabled'}>◀</button>` +
      `<span>${i + 1} / ${list.length}</span><button type="button" class="s3-arr" data-exi="${i + 1}" aria-label="${esc(tr('ex_next'))}"${i < list.length - 1 ? '' : ' disabled'}>▶</button></div></section>` +
      `<section class="s3-bd">${boardHTML(e)}</section></div>`;
  }

  function l3GamesHTML(M) {
    const gs = M.prev.concat(M.now).filter(ST.row.go.filter).slice().reverse();
    const res = s => s === 1 ? 'res_w' : s === 0 ? 'res_l' : 'res_d';
    const items = gs.map(g => `<button type="button" class="s3-game" data-open="${esc(g.game_key)}" data-ply="1"><i class="sw ${g.color === 'white' ? 'sw-white' : 'sw-black'}"></i>` +
      `<span class="s3-gd">${esc(fdate(g.date))}</span><b>${esc(g.opponent || '?')}</b><span>${g.opp_elo || '—'}</span><span>${esc(family(g))}</span>` +
      `<span class="s3-res ${res(g.score)}">${esc(tr(res(g.score)))}</span><span>${g.accuracy != null ? fmt(g.accuracy, 0) + '%' : '—'}</span><em>${esc(tr('gl_open'))}</em></button>`).join('');
    return `<header class="s3-dh"><div><span class="s3-k">${esc(tr('q_' + ST.topic) + ' · ' + tr('gl_title', { n: gs.length }))}${statePill()}</span><h2>${esc(ST.row.name)}</h2></div>${xBtn()}</header>` +
      `<div class="s3-dl">` + (gs.length ? `<div class="s3-games">${items}</div>` : `<p class="s3-sub">${esc(tr('gl_none'))}</p>`) + '</div>';
  }

  // ── pop-up del livello 3: sopra la pagina del tema, si chiude con ×, clic fuori o Esc ──
  function renderPop(M) {
    let pop = $('stPop');
    const on = ST.active && ST.level === 3 && !!ST.row;
    if (!on) {
      if (pop && !pop.hidden) {
        pop.hidden = true; pop.innerHTML = '';
        document.body.classList.remove('st-pop');
        const back = ST.focusRow && $('statsBody').querySelector(`[data-row="${CSS.escape(ST.focusRow)}"]`);
        if (back) back.focus({ preventScroll: true });
        ST.focusRow = null;
      }
      return;
    }
    if (!pop) {
      pop = document.createElement('div');
      pop.id = 'stPop'; pop.className = 's3-pop'; pop.hidden = true;
      document.body.appendChild(pop);
      pop.addEventListener('mousedown', ev => { if (ev.target === pop) goLevel(2); });
      pop.addEventListener('click', onClick);
    }
    const wasHidden = pop.hidden, ae = document.activeElement;
    const refocus = wasHidden || !ae || ae === document.body || pop.contains(ae);
    const fKey = ae && pop.contains(ae) ? (ae.classList.contains('s3-arr') ? '.s3-arr[aria-label="' + ae.getAttribute('aria-label') + '"]'
      : ae.closest('.s3-mv') && ST.gv ? `.s3-mv [data-gp="${ST.gv.ply}"]` : ae.dataset.a ? `[data-a="${ae.dataset.a}"]` : null) : null;
    pop.hidden = false;
    document.body.classList.add('st-pop');
    const isEx = ST.row.go.type === 'ex', gv = !!ST.gv;
    // la finestra si crea (e si anima) solo all'apertura; dopo cambia solo il contenuto
    let dlg = pop.querySelector('.s3-dlg');
    if (wasHidden || !dlg) {
      pop.innerHTML = '<section class="s3-dlg" role="dialog" aria-modal="true"></section>';
      dlg = pop.firstChild;
    }
    dlg.className = `s3-dlg ${ST.row.st || 'few'}${isEx || gv ? '' : ' list'}`;
    dlg.setAttribute('aria-label', ST.row.name);
    dlg.innerHTML = gv ? gvHTML() : isEx ? l3ExHTML() : l3GamesHTML(M || model());
    if (refocus) { const f = (fKey && pop.querySelector(fKey + ':not(:disabled)')) || pop.querySelector('.s3-x'); if (f) f.focus({ preventScroll: true }); }
  }

  function renderPage() {
    const page = $('statsBody');
    if (!ST.data) return;
    if (!ST.data.username || !filtered().length) {
      ST.split = null;
      $gameMeta.innerHTML = `<b>${esc(tr('stats'))}</b>`;
      page.innerHTML = `<div class="s3"><div class="sp-empty"><span class="gc-k">${esc(tr('emK'))}</span><div class="sp-h1">${esc(tr('emH'))}</div><p>${esc(tr('emP'))}</p>` +
        `<div><button class="gc-btn pri" data-a="import">${esc(tr('emBtn'))}</button></div></div></div>`;
      return;
    }
    const M = model();
    ST.split = { prev: M.prev, now: M.now, games: M.games };
    if (ST.level >= 2 && !M.T[ST.topic]) ST.level = 1;
    if (ST.level === 3 && ST.row) { const fresh = M.T[ST.topic].rows.find(r => r.id === ST.row.id); if (fresh) ST.row = fresh; else ST.level = 2; }
    const key = ST.level === 1 ? 'l1' : 'l2:' + ST.topic;
    // il pop-up (livello 3) lascia la pagina del tema com'è: niente ridisegno, scroll intatto
    if (!(ST.level === 3 && ST.pageKey === key) && !(ST.level === 2 && ST.fromPop && ST.pageKey === key)) {
      const keep = $('statsPage').scrollTop;
      page.innerHTML = ST.level === 1 ? l1HTML(M) : l2HTML(M);
      ST.pageKey = key;
      if (ST.keepScroll) $('statsPage').scrollTop = keep; else $('statsPage').scrollTop = 0;
      if (ST.level === 2 && ST.lastRow) { const el = page.querySelector(`[data-row="${CSS.escape(ST.lastRow)}"]`); if (el) el.scrollIntoView({ block: 'center' }); }
      bindPage();
    }
    ST.keepScroll = false; ST.fromPop = false; ST.lastRow = null;
    $gameMeta.innerHTML = crumbs();
    renderPop(M);
  }

  function goLevel(n) {
    if (n < 3 && ST.row) { ST.lastRow = ST.row.id; ST.focusRow = ST.row.id; if (n === 2 && ST.level === 3) ST.fromPop = true; }
    ST.level = n;
    if (n < 3) { ST.row = null; ST.ex = null; ST.gv = null; }
    if (n < 2) ST.topic = null;
    renderPage();
  }

  async function openRow(r) {
    if (r.go.type === 'op') { ST.close(); if (window.OP) OP.open(r.go.chapter || (OP.chapters.find(c => c.name === r.go.name) || {}).id); return; }
    ST.row = r; ST.level = 3; ST.exI = 0; ST.gv = null;
    if (r.go.type === 'ex') {
      ST.ex = { kind: r.go.kind, loading: true, list: [] };
      renderPage();
      const keys = (ST.split?.games || []).map(g => g.game_key).join(',');
      const d = await api(`/api/insights/examples?kind=${encodeURIComponent(r.go.kind)}&games=${encodeURIComponent(keys)}`);
      if (!ST.ex || ST.ex.kind !== r.go.kind) return;
      ST.ex = { kind: r.go.kind, loading: false, list: d.examples || [] };
    }
    renderPage();
  }

  function onClick(ev) {
    const el = ev.target.closest('[data-a],[data-topic],[data-row],[data-open],[data-exi],[data-tc],[data-col],[data-gp]');
    if (!el || el.disabled) return;
    if (el.dataset.topic) { ST.topic = el.dataset.topic; ST.level = 2; renderPage(); return; }
    if (el.dataset.row) { const M = model(); const r = M.T[ST.topic].rows.find(x => x.id === el.dataset.row); if (r) openRow(r); return; }
    if (el.dataset.open) { openGv(el.dataset.open, +el.dataset.ply || 0); return; }
    if (el.dataset.gp !== undefined) { gvGo(+el.dataset.gp); return; }
    if (el.dataset.exi !== undefined) { ST.exI = +el.dataset.exi; renderPage(); return; }
    if (el.dataset.tc) { ST.tc = el.dataset.tc; renderRail(); renderPage(); return; }
    if (el.dataset.col) { ST.color = el.dataset.col; renderRail(); renderPage(); return; }
    const a = el.dataset.a;
    if (a === 'elo') { ST.elo = !ST.elo; ST.keepScroll = true; renderPage(); }
    else if (a === 'tools') setTools(!ST.toolsOpen);
    else if (a === 'import') { setTools(true); setTimeout(() => $('stImportBtn') && $('stImportBtn').click(), 50); }
    else if (a === 'close') goLevel(2);
    else if (a === 'gvback') { ST.gv = null; renderPop(); }
    else if (a === 'analyze' && ST.gv) openGame(ST.gv.key, Math.max(1, ST.gv.ply));
  }
  $('statsBody').addEventListener('click', onClick);
  document.addEventListener('mousedown', ev => {
    if (!ST.active || !ST.toolsOpen) return;
    if (ev.target.closest('#stColWrap, .s3-fbtn')) return;
    setTools(false);
  });
  $gameMeta.addEventListener('click', ev => {
    const el = ev.target.closest('[data-stlv]');
    if (el && ST.active) goLevel(+el.dataset.stlv);
  });
  document.addEventListener('keydown', e => {
    if (!ST.active || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === 'Escape') {
      if (ST.toolsOpen) { setTools(false); return; }
      if (ST.level === 3 && ST.gv) { e.preventDefault(); ST.gv = null; renderPop(); return; }
      if (ST.level > 1) { e.preventDefault(); goLevel(ST.level - 1); }
    } else if (ST.level === 3 && ST.gv && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation();
      const g = ST.gv; gvGo(e.key === 'Home' ? 0 : e.key === 'End' ? (g.moves || []).length : g.ply + (e.key === 'ArrowRight' ? 1 : -1));
    } else if (ST.level === 3 && ST.ex && !ST.ex.loading && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const n = (ST.ex.list || []).length, i = ST.exI + (e.key === 'ArrowRight' ? 1 : -1);
      if (i >= 0 && i < n) { e.preventDefault(); e.stopPropagation(); ST.exI = i; renderPage(); }
    }
  }, true);

  // ── indice "In questa pagina": evidenzia la sezione sotto l'asse del cursore della scrollbar ──
  function renderNav(active) {
    const box = $('stNav');
    if (!box) return;
    box.innerHTML = SECS.map((k, i) => `<button class="sn${i === active ? ' on' : ''}" data-i="${i}"><b>${String(i + 1).padStart(2, '0')}</b><span>${esc(tr(k))}</span></button>`).join('');
    box.querySelectorAll('.sn').forEach(b => b.onclick = () => jump(+b.dataset.i));
  }
  function jump(i) {
    const m = $('statsPage'), s = m.querySelector(`[data-sec="${i}"]`);
    if (!s) return;
    m.scrollTo({ top: s.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 40, behavior: 'smooth' });
  }
  function spy() {
    const m = $('statsPage'), secs = [...m.querySelectorAll('[data-sec]')];
    if (!secs.length) return;
    const H = m.clientHeight, S = m.scrollHeight, thumb = H * H / S, p = S > H ? m.scrollTop / (S - H) : 0;
    const mid = m.getBoundingClientRect().top + p * (H - thumb) + thumb / 2;
    let act = 0;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top <= mid) act = i; });
    if (act !== ST.sec) { ST.sec = act; renderNav(act); }
  }
  $('statsPage').addEventListener('scroll', spy);

  // ── Filtri e analisi: tendina chiusa di default ──
  function setTools(open) {
    ST.toolsOpen = open;
    document.body.classList.toggle('st-tools', open);
    $('stTools').hidden = !open;
    const fb = document.querySelector('.s3-fbtn');
    if (fb) { fb.setAttribute('aria-expanded', String(open)); fb.textContent = tr('s3Filters') + (open ? ' ▴' : ' ▾'); }
    $('stChev').textContent = open ? '▴' : '▾';
    updateToolsSummary();
  }
  function updateToolsSummary() {
    const s = ST.status || {};
    const tc = ST.tc === 'all' ? tr('tcAll') : (ST.tc || '').replace(/^./, c => c.toUpperCase());
    const col = ST.color === 'all' ? tr('bothCol') : tr(ST.color === 'white' ? 'white' : 'black');
    const run = s.running ? ' · ' + tr('analyzing', { d: s.done, t: s.total }) : ' · ' + tr('analyzedShort', { n: s.analyzed || 0 });
    $('stToolsSum').textContent = `${tc} · ${col} · ${tr('blocksOf', { n: ST.win })}${run}`;
  }

  async function openGame(key, ply) {
    const r = await api(`/api/rep/games/${encodeURIComponent(key)}/pgn`);
    if (!r.pgn) return;
    ST.close();
    loadPgn(r.pgn);
    goToIndex(Math.max(0, (ply || 1) - 1));
  }

  ST.translate = () => { if (ST.active) { renderRail(); renderPage(); } };

  function wire() {
    $('statsBtn').onclick = () => ST.open();
    $('stToolsBtn').onclick = () => setTools(!ST.toolsOpen);
    setTools(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
