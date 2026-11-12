'use strict';
/* ════════════════════════════════════════════════════════════════════
   MODULO APERTURE
   • Esplora   — naviga l'albero del repertorio (tue mosse + risposte avversarie)
   • Ripassa   — ripetizione dilazionata: giochi tu, l'avversario risponde
   • Partite   — controllo delle partite chess.com contro il repertorio
   Usa lo stato globale di app.js (mainHistory, chess, goToIndex, ...).
   ════════════════════════════════════════════════════════════════════ */
(function () {

  // ── Testi ────────────────────────────────────────────────────────────
  const I18N = {
    it: {
      repertoire: 'Repertorio', white: 'Bianco', black: 'Nero', you: 'Tu', opponent: 'Avversario', oppShort: 'Avv.',
      review: 'Ripassa', reviewN: 'Ripassa · {n}', gamesBtn: 'Partite chess.com', back: '← Torna alla partita',
      continuations: 'Continuazioni', endOfLine: 'Fine della linea di repertorio.',
      transposes: 'Trasposizione — continua dalla posizione già studiata', goThere: 'Vai',
      yours: 'Tua', punish: 'Da punire', dueTag: '{n} da ripassare', newTag: '{n} nuove',
      notBuilt: 'Il repertorio non è ancora stato costruito.',
      buildHint: 'Costruisco l\'albero delle 6 aperture: risposte di teoria dell\'avversario e tua mossa scelta con Stockfish. Ci vuole circa un minuto.',
      buildBtn: 'Costruisci repertorio', building: 'Costruzione · {ch} · {done}/{total} · {nodes} posizioni',
      noEngine: 'Serve Stockfish attivo per costruire il repertorio.',
      tEval: 'Valutazione', tWeight: 'Linee di teoria', tNext: 'Prossimo ripasso', tReps: 'Ripetizioni',
      nNew: 'Nuova', nToday: 'Oggi', nIn: 'Tra {n} g', nDash: '—',
      yourMove: 'La tua mossa', oppMove: 'Tocca all\'avversario', change: 'Cambia',
      pickMove: 'Scegli la tua mossa qui', pick: 'Scegli', loadingCands: 'Calcolo delle alternative…',
      ideas: 'Idee', explainAi: 'Spiega con AI', edit: 'Modifica', save: 'Salva', cancel: 'Annulla',
      noComment: 'Nessuna nota. Scrivine una o chiedi all\'AI.', aiWorking: 'Commento in corso…',
      aiOff: 'OpenAI non configurata: puoi scrivere le note a mano.',
      rebuilding: 'Ricostruisco il ramo…',
      drillTitle: 'Ripasso', yourTurn: 'Tocca a te', newMove: 'Mossa nuova: giocala',
      correct: 'Giusto', wrong: 'Non è la mossa del repertorio — attesa {san}. Giocala.',
      transOk: 'Trasposizione: stessa posizione del repertorio.',
      lineDone: 'Linea completata', sessionDone: 'Ripasso finito per oggi',
      nothingDue: 'Niente da ripassare adesso. Torna domani o esplora l\'albero.',
      dDue: 'Da ripassare', dNew: 'Nuove', dOk: 'Giuste', dKo: 'Errori',
      hint: 'Suggerimento', skip: 'Salta linea', stop: 'Termina', again: 'Ancora', explore: 'Esplora',
      gTitle: 'Partite chess.com vs repertorio', gUser: 'Account chess.com (separati da virgola)', gMonths: 'Mesi',
      gSync: 'Importa', gSyncing: 'Importo da chess.com…', gAdded: '{added} nuove partite importate ({seen} lette).',
      gCount: 'Partite', gEnd: 'Repertorio rispettato', gYou: 'Uscite tue', gHoles: 'Buchi',
      gHolesTitle: 'Buchi nel repertorio', gHoleRow: 'Col {color} contro {move}: {n} partite',
      gByChapter: 'Per apertura', gChapter: 'Apertura', gScore: 'Punti',
      sYou: 'Sei uscito a {ml}{played} — repertorio: {exp}', sOpp: 'L\'avversario ha giocato {ml}{played}, non è nel tuo albero',
      sUnc: 'Nessuna tua apertura contro {ml}{played}', sEnd: 'Repertorio seguito fino in fondo', sNoTree: 'Repertorio non costruito',
      open: 'Apri', study: 'Studia', gEmpty: 'Nessuna partita. Inserisci lo username e importa.',
      gLapse: 'rimessa in ripasso', gMore: 'Mostrate le {n} più recenti su {t}.', gFromApp: 'app', gSuggest: 'suggerito: {u}',
      openings: 'Aperture', me: 'Io', asWhite: 'Con il Bianco', asBlack: 'Con il Nero', notBuiltTag: 'non costruito', newLines: '{n} linee nuove', newLines1: '1 linea nuova', mergeBtn: 'Aggiorna', mergeRun: 'Aggiorno le linee… {n} posizioni', mergeNoEngine: 'Serve Stockfish per aggiornare le linee.', cards: '{n} carte',
      treeTitle: 'Albero del repertorio', legMe: 'Io', legOpp: 'Avversario', legPath: 'Percorso', legHere: 'Qui',
      newCard: 'carta nuova', dueToday: 'da ripassare oggi', punishTag: 'punisci', startPos: 'Inizio',
      kYour: 'La mia mossa', kNew: 'Mossa nuova', kHint: 'Suggerimento', kWrong: 'Non è la mossa del repertorio', kCorrect: 'Giusto', kNowGot: 'Ora ce l\'ho',
      subAsk: 'Gioca la mossa del repertorio sulla scacchiera.', subNew: 'Questa è una carta nuova. Gioca la mossa indicata dalla freccia.',
      subWrong: 'Ho giocato {num}{played}. Attesa {num}{san}. Giocala per continuare.', subHint: 'La mossa del repertorio è {num}{san}. Giocala.',
      subOpp: 'L\'avversario risponde…', subNext: 'Carico la prossima carta.', hintBtn: 'Suggerimento', hintCount: '· conta come errore', endBtn: 'Termina',
      sessKicker: 'Sessione completata', doneTitle: 'Ripasso finito per oggi.', doneSummary: '{ok} giuste, {ko} errori. Le carte sbagliate tornano domani; le altre si allontanano.',
      exploreTree: 'Esplora l\'albero', nothingDueTitle: 'Niente da ripassare.',
      notBuiltText: 'La costruzione crea l\'albero dalla teoria lichess e da Stockfish: una mossa per me in ogni posizione, le risposte più comuni per l\'avversario, fino alla mossa 10. Ci vuole circa un minuto e serve Stockfish attivo.',
      buildingK: 'Costruzione · {done} / {total} capitoli', positions: 'posizioni', buildingNote: 'Posso continuare a usare il resto dell\'app. Le carte compaiono nel ripasso appena il capitolo è pronto.',
      gTitleShort: 'Partite chess.com', gRecent: 'Partite recenti contro il mio repertorio', backRep: '← Repertorio', gAccounts: 'Account', gLeft: 'Uscite', holeTag: 'Buco', nGames: '{n} partite', gShowing: 'Le {n} più recenti su {t}',
      search: 'Cerca apertura', todayAll: 'Ripasso di oggi · {n}', grpWhite: 'Come Bianco', grpBlack: 'Come Nero', pillToday: '{n} oggi',
      tabLine: 'Linea', tabTree: 'Albero', tabStats: 'Statistiche', onlyDue: 'Solo da ripassare', lgDue: 'Da ripassare',
      stLearned: 'Imparata', stDue: 'Da ripassare', stNew: 'Nuova', stDueToday: 'Da ripassare oggi',
      map: 'Mappa', otherReplies: 'ALTRE RISPOSTE', posAfter: 'Posizione · dopo {m}', posStart: 'Posizione · inizio',
      cards1: '1 carta', dueTodayN: '{n} da ripassare oggi', reviewCh: 'Ripassa · {n}', reviewMove: 'Ripassa questa mossa', studyHere: 'Studia da qui',
      branch1: 'Ramo · 1 carta', branchN: 'Ramo · {n} carte', outRep: 'Sei fuori repertorio: questa è una variante.',
      oppReplies: 'L\'avversario risponde {mv} nel {p}% dei casi', oppAnswers: 'Risposte più comuni: {list}',
      sCards: 'Carte', sLearnedPct: 'Imparate', sNext7: 'Prossimi 7 giorni',
    },
    en: {
      repertoire: 'Repertoire', white: 'White', black: 'Black', you: 'You', opponent: 'Opponent', oppShort: 'Opp.',
      review: 'Review', reviewN: 'Review · {n}', gamesBtn: 'chess.com games', back: '← Back to game',
      continuations: 'Continuations', endOfLine: 'End of the repertoire line.',
      transposes: 'Transposition — continue from the position you already studied', goThere: 'Go',
      yours: 'Yours', punish: 'Punish', dueTag: '{n} due', newTag: '{n} new',
      notBuilt: 'The repertoire has not been built yet.',
      buildHint: 'I build the tree of the 6 openings: opponent theory replies and your move chosen with Stockfish. It takes about a minute.',
      buildBtn: 'Build repertoire', building: 'Building · {ch} · {done}/{total} · {nodes} positions',
      noEngine: 'Stockfish must be running to build the repertoire.',
      tEval: 'Evaluation', tWeight: 'Theory lines', tNext: 'Next review', tReps: 'Repetitions',
      nNew: 'New', nToday: 'Today', nIn: 'In {n} d', nDash: '—',
      yourMove: 'Your move', oppMove: 'Opponent to move', change: 'Change',
      pickMove: 'Pick your move here', pick: 'Pick', loadingCands: 'Computing alternatives…',
      ideas: 'Ideas', explainAi: 'Explain with AI', edit: 'Edit', save: 'Save', cancel: 'Cancel',
      noComment: 'No notes yet. Write one or ask the AI.', aiWorking: 'Commenting…',
      aiOff: 'OpenAI not configured: you can write notes by hand.',
      rebuilding: 'Rebuilding the branch…',
      drillTitle: 'Review', yourTurn: 'Your move', newMove: 'New move: play it',
      correct: 'Correct', wrong: 'Not the repertoire move — expected {san}. Play it.',
      transOk: 'Transposition: same repertoire position.',
      lineDone: 'Line complete', sessionDone: 'Review done for today',
      nothingDue: 'Nothing to review right now. Come back tomorrow or explore the tree.',
      dDue: 'Due', dNew: 'New', dOk: 'Correct', dKo: 'Mistakes',
      hint: 'Hint', skip: 'Skip line', stop: 'Stop', again: 'Again', explore: 'Explore',
      gTitle: 'chess.com games vs repertoire', gUser: 'chess.com accounts (comma separated)', gMonths: 'Months',
      gSync: 'Import', gSyncing: 'Importing from chess.com…', gAdded: '{added} new games imported ({seen} read).',
      gCount: 'Games', gEnd: 'Repertoire followed', gYou: 'Your deviations', gHoles: 'Holes',
      gHolesTitle: 'Holes in the repertoire', gHoleRow: 'As {color} against {move}: {n} games',
      gByChapter: 'By opening', gChapter: 'Opening', gScore: 'Score',
      sYou: 'You left at {ml}{played} — repertoire: {exp}', sOpp: 'Opponent played {ml}{played}, not in your tree',
      sUnc: 'No opening of yours against {ml}{played}', sEnd: 'Repertoire followed to the end', sNoTree: 'Repertoire not built',
      open: 'Open', study: 'Study', gEmpty: 'No games. Enter your username and import.',
      gLapse: 'back in review', gMore: 'Showing the {n} most recent of {t}.', gFromApp: 'app', gSuggest: 'suggested: {u}',
      openings: 'Openings', me: 'Me', asWhite: 'As White', asBlack: 'As Black', notBuiltTag: 'not built', newLines: '{n} new lines', newLines1: '1 new line', mergeBtn: 'Update', mergeRun: 'Updating lines… {n} positions', mergeNoEngine: 'Stockfish is needed to update the lines.', cards: '{n} cards',
      treeTitle: 'Repertoire tree', legMe: 'Me', legOpp: 'Opponent', legPath: 'Path', legHere: 'Here',
      newCard: 'new card', dueToday: 'due today', punishTag: 'punish', startPos: 'Start',
      kYour: 'My move', kNew: 'New move', kHint: 'Hint', kWrong: 'Not the repertoire move', kCorrect: 'Correct', kNowGot: 'Now I have it',
      subAsk: 'Play the repertoire move on the board.', subNew: 'This is a new card. Play the move shown by the arrow.',
      subWrong: 'I played {num}{played}. Expected {num}{san}. Play it to continue.', subHint: 'The repertoire move is {num}{san}. Play it.',
      subOpp: 'The opponent replies…', subNext: 'Loading the next card.', hintBtn: 'Hint', hintCount: '· counts as error', endBtn: 'End',
      sessKicker: 'Session complete', doneTitle: 'Review finished for today.', doneSummary: '{ok} correct, {ko} errors. Cards with errors come back tomorrow; the others move further out.',
      exploreTree: 'Explore the tree', nothingDueTitle: 'Nothing to review.',
      notBuiltText: 'Building creates the tree from lichess theory and Stockfish: one move for me in every position, the most common replies for my opponent, up to move 10. It takes about a minute and needs Stockfish running.',
      buildingK: 'Building · {done} / {total} chapters', positions: 'positions', buildingNote: 'I can keep using the rest of the app. Cards appear in Review as soon as the chapter is ready.',
      gTitleShort: 'chess.com games', gRecent: 'Recent games against my repertoire', backRep: '← Repertoire', gAccounts: 'Accounts', gLeft: 'Left', holeTag: 'Hole', nGames: '{n} games', gShowing: '{n} most recent of {t}',
      search: 'Search opening', todayAll: 'Today\'s review · {n}', grpWhite: 'As White', grpBlack: 'As Black', pillToday: '{n} today',
      tabLine: 'Line', tabTree: 'Tree', tabStats: 'Stats', onlyDue: 'Due only', lgDue: 'Due',
      stLearned: 'Learned', stDue: 'Due', stNew: 'New', stDueToday: 'Due today',
      map: 'Map', otherReplies: 'OTHER REPLIES', posAfter: 'Position · after {m}', posStart: 'Position · start',
      cards1: '1 card', dueTodayN: '{n} due today', reviewCh: 'Review · {n}', reviewMove: 'Review this move', studyHere: 'Study from here',
      branch1: 'Branch · 1 card', branchN: 'Branch · {n} cards', outRep: 'You are off repertoire: this is a variation.',
      oppReplies: 'The opponent replies {mv} {p}% of the time', oppAnswers: 'Most common replies: {list}',
      sCards: 'Cards', sLearnedPct: 'Learned', sNext7: 'Next 7 days',
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

  async function api(path, body) {
    const opt = body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    };
    const r = await fetch(`${API}${path}`, opt);
    const d = await r.json().catch(() => ({}));
    if (!r.ok && !d.error) d.error = `HTTP ${r.status}`;
    return d;
  }

  // ── Stato ────────────────────────────────────────────────────────────
  const OP = window.OP = {
    active: false,
    mode: 'explore',          // 'explore' | 'drill'
    chapters: [],
    chapterId: null,
    trees: {},                // chapterId → albero
    path: [],                 // id dei nodi allineati a mainHistory
    snapshot: null,           // stato della partita prima di entrare
    drill: null,
    today: new Date().toISOString().slice(0, 10),
  };

  // ── Albero ──────────────────────────────────────────────────────────
  function indexTree(data) {
    const nodes = new Map(), kids = new Map(), byEpd = new Map();
    let root = null;
    for (const n of data.nodes) {
      nodes.set(n.id, n);
      if (n.parent_id == null) root = n;
      else {
        if (!kids.has(n.parent_id)) kids.set(n.parent_id, []);
        kids.get(n.parent_id).push(n);
      }
    }
    // posizione "canonica" = quella che ha continuazioni (le altre traspongono qui)
    for (const n of data.nodes) {
      const cur = byEpd.get(n.epd);
      if (!cur || (!kids.has(cur.id) && kids.has(n.id))) byEpd.set(n.epd, n);
    }
    for (const list of kids.values()) {
      list.sort((a, b) => (b.main - a.main) || (b.weight - a.weight) || (a.id - b.id));
    }
    if (data.today) OP.today = data.today;
    return { chapter: data.chapter, nodes, kids, byEpd, root, color: data.chapter.color };
  }

  async function loadTree(chapterId, force = false) {
    if (!force && OP.trees[chapterId]) return OP.trees[chapterId];
    const d = await api(`/api/rep/tree/${encodeURIComponent(chapterId)}`);
    if (d.error) throw new Error(d.error);
    OP.trees[chapterId] = indexTree(d);
    return OP.trees[chapterId];
  }

  const tree = () => OP.trees[OP.chapterId];
  const kidsOf = (t, id) => t.kids.get(id) || [];
  const isCard = (t, n) => n.user_to_move && kidsOf(t, n.id).length > 0;
  function canonical(t, n) {
    if (kidsOf(t, n.id).length) return n;
    const c = t.byEpd.get(n.epd);
    return c && c.id !== n.id && kidsOf(t, c.id).length ? c : n;
  }
  function ancestors(t, id) {
    const out = [];
    let n = t.nodes.get(id);
    while (n) { out.push(n); n = n.parent_id != null ? t.nodes.get(n.parent_id) : null; }
    return out.reverse();
  }
  function evalOf(n) {
    if (!n) return null;
    if (n.eval_mate != null) return { type: 'mate', value: n.eval_mate };
    if (n.eval_cp != null) return { type: 'cp', value: n.eval_cp };
    return null;
  }
  function plyLabel(n) {
    const num = Math.ceil(n.ply / 2);
    return n.ply % 2 === 1 ? `${num}.${n.move_san}` : `${num}…${n.move_san}`;
  }
  function dueText(n) {
    if (!n || !n.user_to_move) return tr('nDash');
    if (n.srs_state === 'new') return tr('nNew');
    if (!n.srs_due || n.srs_due <= OP.today) return tr('nToday');
    const days = Math.round((new Date(n.srs_due) - new Date(OP.today)) / 86400000);
    return tr('nIn', { n: days });
  }

  // ── Scacchiera: carica un percorso nell'app ──────────────────────────
  function loadPath(t, nodes, goTo = nodes.length - 1) {
    const c = new Chess();
    mainHistory = [{ fen: c.fen(), move: null }];
    OP.path = [nodes[0].id];
    for (const n of nodes.slice(1)) {
      const mv = c.move({ from: n.move_uci.slice(0, 2), to: n.move_uci.slice(2, 4),
                          promotion: n.move_uci[4] });
      if (!mv) break;
      mainHistory.push({ fen: c.fen(), move: mv });
      OP.path.push(n.id);
    }
    const len = mainHistory.length;
    gameEvals           = nodes.slice(0, len).map(evalOf);
    gameBestMoves       = new Array(len).fill('');
    gameTopMoves        = new Array(len).fill([]);
    gameClassifications = new Array(len).fill(null);
    gameBookMoves       = new Array(len).fill(false);
    gameOpeningNames = []; gameNamedAt = []; gameOpeningEco = [];
    firstOutOfBook = -1;
    varHistory = []; varIdx = -1; branchIdx = 0;
    currentPgn = '';
    const me = tr('me') + ' · ' + tr(t.color), opp = tr('opponent') + ' · ' + tr(t.color === 'white' ? 'black' : 'white');
    currentGameMeta = t.color === 'white'
      ? { white: me, black: opp, event: '', date: '', result: '*' }
      : { white: opp, black: me, event: '', date: '', result: '*' };
    const wantFlip = t.color === 'black';
    if (isFlipped !== wantFlip) { isFlipped = wantFlip; buildLabels(); }
    fetchBookInfo();
    goToIndex(Math.max(0, Math.min(goTo, len - 1)));
  }

  function goToNode(id) {
    const t = tree();
    if (!t || !t.nodes.has(id)) return;
    loadPath(t, ancestors(t, id));
  }
  OP.goToNode = goToNode;

  const currentNode = () => {
    const t = tree();
    return t ? t.nodes.get(OP.path[Math.min(mainIdx, OP.path.length - 1)]) : null;
  };

  // ── Apertura / chiusura del modulo ──────────────────────────────────
  OP.open = async function (chapterId) {
    if (window.ST && ST.active) ST.close();
    if (window.HM) HM.close();
    if (window.AR) AR.close();
    if (!OP.active) {
      OP.snapshot = {
        mainHistory, mainIdx, gameEvals, gameBestMoves, gameTopMoves, gameClassifications,
        gameBookMoves, gameOpeningNames, gameNamedAt, gameOpeningEco, firstOutOfBook,
        currentPgn, currentGameMeta, isFlipped, meta: $gameMeta.innerHTML,
      };
    }
    OP.active = true;
    OP.mode = 'explore';
    OP.level = chapterId ? 2 : 1; OP.lineLeaf = null;
    setView('explore');
    document.body.classList.add('op-active');
    $('learnBtn')?.setAttribute('aria-current', 'true');
    await refreshChapters();
    const built = OP.chapters.filter(c => c.built);
    const id = chapterId || OP.chapterId || (built[0] || OP.chapters[0])?.id;
    if (id) await selectChapter(id);
    else renderAll();
  };

  OP.close = function () {
    if (!OP.active) return;
    OP.active = false;
    OP.mode = 'explore';
    OP.drill = null;
    document.body.classList.remove('op-active', 'op-drill', 'op-games', 'op-hf', 'op-l1', 'op-l2', 'op-l3');
    OP.view = 'explore';
    $('learnBtn')?.removeAttribute('aria-current');
    const s = OP.snapshot;
    if (s) {
      mainHistory = s.mainHistory; gameEvals = s.gameEvals; gameBestMoves = s.gameBestMoves;
      gameTopMoves = s.gameTopMoves; gameClassifications = s.gameClassifications;
      gameBookMoves = s.gameBookMoves; gameOpeningNames = s.gameOpeningNames;
      gameNamedAt = s.gameNamedAt; gameOpeningEco = s.gameOpeningEco;
      firstOutOfBook = s.firstOutOfBook; currentPgn = s.currentPgn; currentGameMeta = s.currentGameMeta;
      $gameMeta.innerHTML = s.meta;
      if (isFlipped !== s.isFlipped) { isFlipped = s.isFlipped; buildLabels(); }
      varHistory = []; varIdx = -1; branchIdx = 0;
      if (mainHistory.length) {
        goToIndex(Math.min(s.mainIdx, mainHistory.length - 1));
      } else {
        // nessuna partita caricata prima: torna alla posizione iniziale vuota
        chess.reset(); mainIdx = 0; lastAnalysisFen = null; lastAnalysisData = null; engineArrowData = [];
        renderBoard(); renderMoveList(); updateEvalBar(null); updateOpeningBar(0);
        updateHudEngine(null);
        $engineLines.innerHTML = `<div class="engine-placeholder">${t('enginePlaceholder')}</div>`;
        $bestBox.style.display = 'none';
        updateTiles();
      }
    }
    OP.snapshot = null;
    customDrawings = [];
    renderArrows();
  };

  async function refreshChapters() {
    const [d] = await Promise.all([api('/api/rep/chapters'), loadStudied()]);
    OP.chapters = d.chapters || [];
    OP.engine = !!d.engine;
    OP.build = d.build || {};
    OP.newPerDay = d.new_per_day || 10;
    renderChapters();
    if (OP.build.running) pollBuild();
  }

  async function selectChapter(id) {
    OP.chapterId = id;
    const ch = OP.chapters.find(c => c.id === id);
    renderChapters();
    if (!ch || !ch.built) {
      if (ch) loadPath({ color: ch.color, chapter: ch }, [{ id: -1 }]);
      renderAll(); return;
    }
    const t = await loadTree(id);
    // parti dall'ultima posizione della radice del capitolo
    let n = t.root;
    for (let i = 0; i < (ch.root_san || []).length; i++) {
      const k = kidsOf(t, n.id).find(x => x.main) || kidsOf(t, n.id)[0];
      if (!k) break;
      n = k;
    }
    if (OP.level === 3 && OP.lineLeaf && t.nodes.has(OP.lineLeaf)) loadPath(t, ancestors(t, OP.lineLeaf), 0);
    else goToNode(n.id);
  }

  // ── Hook chiamati da app.js ─────────────────────────────────────────
  OP.onNavigate = function () {
    if (!OP.active) return;
    renderAll();
  };
  OP.blocksAnalysis = () => OP.active && OP.mode === 'drill';
  OP.hidesEngineArrow = () => OP.active;
  OP.onSquareClick = () => OP.active && OP.mode === 'drill' && OP.drill && OP.drill.busy;

  OP.drawArrows = function () {
    if (!OP.active) return;
    const t = tree(), sq = getSq();
    if (OP.mode === 'drill') {
      const d = OP.drill;
      if (d && d.arrow) svgArrow(d.arrow.slice(0, 2), d.arrow.slice(2, 4), cssVar('--drill-arrow', 'rgba(51,46,46,.78)'), Math.round(sq * 0.2));
      return;
    }
    if (OP.view === 'games' || !t || inVariation()) return;
    if (OP.level !== 3) return;
    {
      const nx = t.nodes.get(OP.path[mainIdx + 1]);
      if (nx) svgArrow(nx.move_uci.slice(0, 2), nx.move_uci.slice(2, 4), isMine(t, nx) ? cssVar('--rep-arrow', 'rgba(51,46,46,.72)') : cssVar('--alt-arrow', 'rgba(51,46,46,.5)'), Math.round(sq * (isMine(t, nx) ? 0.2 : 0.12)));
      return;
    }
    const n = currentNode();
    if (!n || mainIdx !== mainHistory.length - 1) return;
    const kids = kidsOf(t, n.id);
    const total = kids.reduce((a, k) => a + (k.weight || 1), 0) || 1;
    kids.forEach(k => {
      const share = (k.weight || 1) / total, from = k.move_uci.slice(0, 2), to = k.move_uci.slice(2, 4);
      if (n.user_to_move) svgArrow(from, to, cssVar('--rep-arrow', 'rgba(51,46,46,.72)'), Math.round(sq * 0.2));
      else svgArrow(from, to, k.flag === 'punish' ? cssVar('--err', '#b23a2a') : cssVar('--alt-arrow', 'rgba(51,46,46,.5)'),
                    Math.max(4, Math.round(sq * (0.05 + share * 0.16))), 0.45 + share * 0.5);
    });
  };

  OP.interceptMove = function (from, to, promotion) {
    if (!OP.active) return false;
    if (OP.mode === 'drill') { drillMove(from, to, promotion); return true; }
    if (OP.view === 'explore') {
      if (OP.level !== 3 || inVariation()) return OP.level !== 3;
      const tt = tree(), nx = tt && tt.nodes.get(OP.path[mainIdx + 1]);
      if (nx && nx.move_uci.slice(0, 4) === from + to) { goToIndex(mainIdx + 1); return true; }
      return false;                                   // altra mossa: variante libera
    }
    const t = tree();
    const n = currentNode();
    if (!t || !n || inVariation()) return false;
    const uci = from + to;
    const hit = kidsOf(t, n.id).find(k => k.move_uci.slice(0, 4) === uci);
    if (hit) { goToNode(hit.id); return true; }
    const probe = new Chess(mainHistory[mainIdx].fen);
    const mv = probe.move({ from, to, promotion: promotion || 'q' });
    if (mv) {
      const epd = probe.fen().split(' ').slice(0, 4).join(' ');
      const c = [...t.byEpd.values()].find(x => x.epd.split(' ').slice(0, 3).join(' ') === epd.split(' ').slice(0, 3).join(' '));
      if (c) { toast(tr('transOk')); goToNode(c.id); return true; }
    }
    return false;   // mossa fuori repertorio: variante normale dell'app
  };

  // freccia → a fine percorso: segui la continuazione principale
  document.addEventListener('keydown', e => {
    if (!OP.active || OP.mode !== 'explore' || OP.view === 'explore') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowRight' && !inVariation() && mainIdx === mainHistory.length - 1) {
      const t = tree(); const n = currentNode();
      if (!t || !n) return;
      const k = kidsOf(t, n.id)[0];
      if (k) goToNode(k.id);
      else { const c = canonical(t, n); if (c.id !== n.id) goToNode(c.id); }
    }
  });

  // ── Vista Aperture: sidebar · scacchiera al centro · percorso a tessere ──
  OP.view = 'explore';                    // 'explore' | 'games' (con OP.mode 'drill' vince il ripasso)
  OP.tab = 'line';                        // 'line' | 'tree' | 'stats'
  OP.onlyDue = false;                     // evidenzia solo le carte da ripassare
  OP.search = '';
  const body = () => $('opBody');
  const num = n => (n.ply % 2 === 1 ? Math.ceil(n.ply / 2) + '.' : Math.ceil(n.ply / 2) + '…');
  const curChapter = () => OP.chapters.find(c => c.id === OP.chapterId);
  const f1 = n => n.toFixed(1);
  // nodo "mio" = la mossa l'ho giocata io (il padre è una carta in cui tocca a me)
  const isMine = (t, n) => { const p = n && n.parent_id != null ? t.nodes.get(n.parent_id) : null; return !!(p && p.user_to_move); };
  const shareOf = (t, n) => {
    const sib = n.parent_id != null ? kidsOf(t, n.parent_id) : [n];
    const tot = sib.reduce((a, k) => a + (k.weight || 1), 0) || 1;
    return Math.round(100 * (n.weight || 1) / tot);
  };
  // stato della carta (nodo dove tocca a me): new · due · learned
  function cardState(p) {
    if (!p || p.srs_state === 'new') return 'new';
    return (!p.srs_due || p.srs_due <= OP.today) ? 'due' : 'learned';
  }
  const stateKey = s => ({ new: 'stNew', due: 'stDue', learned: 'stLearned' }[s]);
  // carte (posizioni uniche dove tocca a me) sotto un nodo, in ordine di profondità
  function cardsUnder(t, id) {
    const seen = new Set(), visited = new Set(), out = [], q = [id];
    while (q.length) {
      const x = q.shift();
      if (visited.has(x)) continue;
      visited.add(x);
      const n = t.nodes.get(x);
      if (!n) continue;
      if (isCard(t, n) && !seen.has(n.epd)) { seen.add(n.epd); out.push(n); }
      for (const k of kidsOf(t, x)) q.push(k.id);
    }
    return out;
  }
  // la carta "in gioco": dove tocca a me, oppure quella appena giocata
  function cardAt(t, n) {
    if (!n) return null;
    if (n.user_to_move && kidsOf(t, n.id).length) return n;
    if (isMine(t, n)) { const p = t.nodes.get(n.parent_id); return p && kidsOf(t, p.id).length ? p : null; }
    return null;
  }
  function newLeftToday() { return Math.max(0, (OP.newPerDay || 10) - newDoneToday()); }
  function chapterReviewN(c) { return (c.due || 0) + Math.min(c.new || 0, newLeftToday()); }

  // ── sidebar: capitoli ───────────────────────────────────────────────
  function sideHTML() {
    const grp = color => {
      const list = OP.chapters.filter(c => c.color === color)
        .sort((a, b) => ((b.due || 0) - (a.due || 0)) || a.name.localeCompare(b.name));
      if (!list.length) return '';
      return `<div class="os-grp"><div class="os-gh"><i class="sw ${color === 'white' ? 'sw-white' : 'sw-black'}"></i><span>${esc(tr(color === 'white' ? 'grpWhite' : 'grpBlack'))}</span></div>` +
        list.map(c => {
          const on = c.id === OP.chapterId && OP.mode !== 'drill' && OP.view === 'explore';
          const tag = !c.built ? `<small class="os-nb">${esc(tr('notBuiltTag'))}</small>`
            : (c.due ? `<b class="os-pill">${esc(tr('pillToday', { n: c.due }))}</b>` : '') + (c.new ? `<small>${esc(tr('newTag', { n: c.new }))}</small>` : '');
          return `<button class="os-row${on ? ' on' : ''}"${on ? ' aria-current="true"' : ''} data-a="chap" data-id="${esc(c.id)}" data-q="${esc(c.name.toLowerCase())}">` +
            `<span class="os-nm">${esc(c.name)}</span><span class="os-tg">${tag}</span></button>`;
        }).join('') + '</div>';
    };
    const anyBuilt = OP.chapters.some(c => c.built);
    return `<div class="os-in"><div class="os-top"><span class="or-k">${esc(tr('openings'))}</span>` +
      `<input id="opSearch" class="os-search" type="search" autocomplete="off" spellcheck="false" placeholder="${esc(tr('search'))}" aria-label="${esc(tr('search'))}" value="${esc(OP.search)}"></div>` +
      `<button class="os-all" data-a="review"${anyBuilt ? '' : ' disabled'}>${esc(tr('todayAll', { n: reviewCount() }))} ▶</button>` +
      `<div class="os-list">${grp('white')}${grp('black')}</div></div>`;
  }
  function applySearch() {
    const q = (OP.search || '').trim().toLowerCase();
    document.querySelectorAll('#opCol .os-row').forEach(r => { r.hidden = !!q && !r.dataset.q.includes(q); });
    document.querySelectorAll('#opCol .os-grp').forEach(g => { g.hidden = !g.querySelector('.os-row:not([hidden])'); });
  }

  function reviewCount() {
    const due = OP.chapters.reduce((a, c) => a + (c.due || 0), 0);
    const nw = OP.chapters.reduce((a, c) => a + (c.new || 0), 0);
    return due + Math.min(nw, OP.newPerDay || 10);
  }

  // layout ad albero ordinato: foglie a x consecutive, genitori al centro dei figli, livelli a passo fisso
  const BW = 98, BH = 56, PX = 105, PY = 86, TW = 176;
  function layoutTree(t, ch) {
    if (t.layout) return t.layout;
    let root = t.root;
    for (let i = 0; i < (ch.root_san || []).length; i++) {
      const k = kidsOf(t, root.id).find(x => x.main) || kidsOf(t, root.id)[0];
      if (!k) break;
      root = k;
    }
    let leaf = 0, maxD = 0;
    const raw = [], eds = [];
    const lay = (n, d) => {
      maxD = Math.max(maxD, d);
      const kids = kidsOf(t, n.id);
      let y;
      if (!kids.length) y = leaf++;
      else { const ys = kids.map(c => lay(c, d + 1)); y = (ys[0] + ys[ys.length - 1]) / 2; kids.forEach(c => eds.push([n, c])); }
      raw.push({ n, d, y });
      return y;
    };
    lay(root, 0);
    const pos = new Map();
    raw.forEach(r => pos.set(r.n.id, { cx: r.y * PX + PX / 2, top: r.d * PY, w: r.d === 0 ? TW : BW }));
    const cards = new Set(), ecos = [];
    for (const n of t.nodes.values()) { if (isCard(t, n)) cards.add(n.epd); if (n.eco) ecos.push(n.eco); }
    ecos.sort();
    t.layout = { root, raw, eds, pos, wn: leaf * PX, hn: maxD * PY + BH, cards: cards.size,
                 eco: ecos.length ? (ecos[0] === ecos[ecos.length - 1] ? ecos[0] : ecos[0] + '–' + ecos[ecos.length - 1]) : '' };
    return t.layout;
  }

  function treeHTML(t, ch) {
    const L = layoutTree(t, ch);
    const cur = currentNode();
    const onPath = new Set(cur ? ancestors(t, cur.id).map(n => n.id) : []);
    const rootLabel = (ch.root_san || []).map((s, i) => (i % 2 === 0 ? (i / 2 + 1) + '.' + s : s)).join(' ') || tr('startPos');
    const edges = L.eds.map(([a, b]) => {
      const p1 = L.pos.get(a.id), p2 = L.pos.get(b.id), y1 = p1.top + BH, my = y1 + (PY - BH) / 2, hot = onPath.has(b.id);
      return { w: hot ? 2.5 : 1, d: `M${p1.cx} ${y1} V${my} H${p2.cx} V${p2.top}`, hot };
    }).sort((a, b) => a.w - b.w);
    const nodes = L.raw.map(({ n, d }) => {
      const p = L.pos.get(n.id), parent = n.parent_id != null ? t.nodes.get(n.parent_id) : null;
      const mine = d === 0 || (parent && parent.user_to_move);
      let meta = '', punish = false;
      if (d > 0 && parent) {
        if (!mine) {
          const total = kidsOf(t, parent.id).reduce((a, k) => a + (k.weight || 1), 0) || 1;
          const share = Math.round(100 * (n.weight || 1) / total);
          punish = n.flag === 'punish';
          meta = punish ? `${share}% · ${tr('punishTag')}` : `${share}%`;
        } else meta = parent.srs_state === 'new' ? tr('newCard') : (!parent.srs_due || parent.srs_due <= OP.today) ? tr('dueToday') : '';
      }
      const isCur = cur && cur.id === n.id;
      const dim = OP.onlyDue && !isCur && (mine && d > 0 ? cardState(parent) !== 'due' : !onPath.has(n.id));
      const cls = ['oc-n', mine ? 'mine' : 'opp', onPath.has(n.id) ? 'path' : '', isCur ? 'cur' : '', punish ? 'punish' : '', dim ? 'dim' : ''].join(' ');
      return `<button class="${cls}" data-a="node" data-id="${n.id}" style="left:${p.cx - p.w / 2}px;top:${p.top}px;width:${p.w}px;height:${BH}px"><b>${esc(d === 0 ? rootLabel : plyLabel(n))}</b><small>${esc(meta)}</small></button>`;
    }).join('');
    return `<div class="oc-treewrap" id="opTreeWrap"><div class="oc-tree" style="width:${L.wn}px;height:${L.hn}px"><svg width="${L.wn}" height="${L.hn}">` +
      edges.map(e => `<path d="${e.d}" style="stroke:${e.hot ? 'var(--path)' : 'var(--line-2)'};stroke-width:${e.w}"/>`).join('') + `</svg>${nodes}</div></div>`;
  }

  // ── repertorio non ancora costruito (nella colonna destra) ───────────
  function unbuiltHTML(ch) {
    const b = OP.build || {};
    const head = (sub) => `<div class="oc-head"><div><div class="oc-name">${esc(ch.name)}</div><div class="oc-sub">${esc(sub)}</div></div></div>`;
    if (b.running) {
      const pct = b.total ? Math.round(100 * b.done / b.total) : 5;
      return head(tr(ch.color)) + `<div class="gc-body tall" id="opBody"><div class="gc-k">${esc(tr('buildingK', { done: b.done || 0, total: b.total || 0 }))}</div>` +
        `<div class="gc-pct">${b.nodes || 0}<small> ${esc(tr('positions'))}</small></div><div class="gc-bar"><i style="width:${pct}%"></i></div><div class="gc-p">${esc(tr('buildingNote'))}</div></div>`;
    }
    return head(`${tr(ch.color)} · ${tr('notBuiltTag')}`) + `<div class="gc-body tall" id="opBody"><div class="gc-p">${esc(OP.engine ? tr('notBuiltText') : tr('noEngine'))}</div>` +
      `<div><button class="gc-btn pri" data-a="build"${OP.engine ? '' : ' disabled'}>${esc(tr('buildBtn'))}</button></div>${b.error ? `<div class="gc-hint">${esc(b.error)}</div>` : ''}</div>`;
  }

  // ── la linea: mosse giocate + continuazione principale ───────────────
  function lineModel(t) {
    const cur = currentNode();
    const anc = ancestors(t, cur.id);
    const seq = anc.slice(1);                       // mosse dalla posizione iniziale fino a qui
    const ci = seq.length - 1;                      // indice del nodo corrente (-1 = radice)
    let tail = cur;
    for (let i = 0; i < 10; i++) {
      let k = kidsOf(t, tail.id)[0];
      if (!k) { const c = canonical(t, tail); if (c.id !== tail.id) k = kidsOf(t, c.id)[0]; }
      if (!k) break;
      seq.push(k); tail = k;
    }
    return { cur, seq, ci };
  }

  // ── percorso a tessere (stessa lingua dei puzzle): 6 nodi a zig-zag ──
  const PX_ME = 108, PX_OPP = 262, PY0 = 64, PDY = 70, PH = 472, PW = 420;
  const THW = 49.3, THH = 27.2, TTH = 11;           // mezza larghezza, mezza altezza, spessore della tessera

  function tileSVG(x, y, st, label, cur, dim, dataId, aria, o = {}) {
    const pl = a => a.map(q => f1(q[0]) + ',' + f1(q[1])).join(' ');
    const N = [x, y - THH], E = [x + THW, y], S2 = [x, y + THH], Wv = [x - THW, y];
    const dn = a => [a[0], a[1] + TTH];
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const P = (u, w) => [N[0] + u * (E[0] - N[0]) + w * (Wv[0] - N[0]), N[1] + u * (E[1] - N[1]) + w * (Wv[1] - N[1])];
    const cells = [[0, 1], [1, 0]].map(([a, b]) => `<polygon class="ce" points="${pl([P(a / 2, b / 2), P((a + 1) / 2, b / 2), P((a + 1) / 2, (b + 1) / 2), P(a / 2, (b + 1) / 2)])}"/>`).join('');
    const mL = mid(Wv, S2), mR = mid(S2, E);
    const sil = `M${pl([Wv, N, E, dn(E), dn(S2), dn(Wv)]).replace(/ /g, ' L')} Z`;
    const shadow = pl([[Wv[0] - 3, Wv[1] + TTH + 5], [S2[0], S2[1] + TTH + 10], [E[0] + 3, E[1] + TTH + 5], [N[0], N[1] + TTH + 5]]);
    let badge = '';
    if (st === 'learned') badge = `<g class="opt-b"><circle cx="${f1(x + 41.7)}" cy="${f1(y - 20.4)}" r="9.4"/><path d="M${f1(x + 37)} ${f1(y - 20)} L${f1(x + 40.4)} ${f1(y - 16.6)} L${f1(x + 46.4)} ${f1(y - 23.8)}"/></g>`;
    else if (st === 'due') badge = `<g class="opt-b"><circle cx="${f1(x + 41.7)}" cy="${f1(y - 20.4)}" r="6.4"/></g>`;
    else if (st === 'seen') badge = `<g class="opt-b seen"><path d="M${f1(x + 32.5)} ${f1(y - 20.4)} Q${f1(x + 41.7)} ${f1(y - 29)} ${f1(x + 50.9)} ${f1(y - 20.4)} Q${f1(x + 41.7)} ${f1(y - 11.8)} ${f1(x + 32.5)} ${f1(y - 20.4)} Z"/><circle cx="${f1(x + 41.7)}" cy="${f1(y - 20.4)}" r="3"/></g>`;
    if (o.badge === false) badge = '';
    const cls = `pzt opt ${st === 'learned' ? 'solved' : st === 'new' ? 'new' : st === 'seen' ? 'open seen' : 'open'}${cur ? ' cur' : ''}${dim ? ' dim' : ''}${o.cls ? ' ' + o.cls : ''}`;
    return `<g class="${cls}" data-a="${o.a || 'node'}" data-id="${dataId}" tabindex="0" role="button" aria-label="${esc(aria)}">` +
      `<title>${esc(aria)}</title><polygon class="sh" points="${shadow}"/>` +
      `<polygon class="sl" points="${pl([Wv, S2, dn(S2), dn(Wv)])}"/><polygon class="sr" points="${pl([E, S2, dn(S2), dn(E)])}"/>` +
      `<polygon class="sb" points="${pl([Wv, mL, dn(mL), dn(Wv)])}"/><polygon class="sb" points="${pl([mR, E, dn(E), dn(mR)])}"/>` +
      `<polygon class="t" points="${pl([N, E, S2, Wv])}"/>${o.plain ? '' : cells}` +
      `<path class="ol" d="${sil}"/><path class="ng" d="${sil}"/><path class="nc" d="${sil}"/>` +
      `<text class="opt-l" x="${f1(x)}" y="${f1(y + 6.5)}" text-anchor="middle">${esc(label)}</text>${o.extra || ''}${badge}</g>`;
  }

  function oppSVG(x, y, label, pct, sel, dim, dataId, aria) {
    return `<g class="opo${sel ? ' sel' : ''}${dim ? ' dim' : ''}" data-a="node" data-id="${dataId}" tabindex="0" role="button" aria-label="${esc(aria)}">` +
      `<title>${esc(aria)}</title><g transform="translate(${f1(x - 50)},${f1(y - 28)})">` +
      `<polygon points="50,4 96,28 50,52 4,28"/>` +
      `<text class="opo-l" x="50" y="32" text-anchor="middle">${esc(label)}</text>` +
      `<text class="opo-p" x="50" y="44" text-anchor="middle">${esc(pct)}</text></g></g>`;
  }

  const PAWN = `<g class="po"><circle cx="28" cy="17" r="6.5"/><path d="M20 38 L22 30 Q28 25 34 30 L36 38 Z"/><rect x="18" y="37" width="20" height="4.5" rx="2"/><path d="M20 49 L28 60 L36 49 Z"/></g>` +
    `<path class="pf" d="M20 49 L28 60 L36 49 Z"/><circle class="pf" cx="28" cy="17" r="6.5"/><path class="pf" d="M20 38 L22 30 Q28 25 34 30 L36 38 Z"/><rect class="pf" x="18" y="37" width="20" height="4.5" rx="2"/>`;

  function pathSVG(t) {
    const L = lineModel(t), seq = L.seq, cur = L.cur, ci = L.ci;
    if (!seq.length) return `<div class="op-note or-empty">${esc(tr('endOfLine'))}</div>`;
    // la tessera in gioco (dove tiene il pedone): la prima "mia" da qui in avanti
    let pi = Math.max(ci, 0);
    while (pi < seq.length && !isMine(t, seq[pi])) pi++;
    if (pi >= seq.length) pi = Math.max(0, seq.length - 1);
    const s = Math.max(0, Math.min(pi - 2, seq.length - 6));
    const win = seq.slice(s, s + 6);
    const jp = pi - s;
    // se il pedone è sul primo nodo serve spazio sopra: si parte più in basso con passo ridotto
    const y0 = jp === 0 ? 120 : PY0, dy = jp === 0 ? 60 : PDY;
    const pos = j => ({ x: isMine(t, win[j]) ? PX_ME : PX_OPP, y: y0 + j * dy });

    // bivio: ultima risposta avversaria (scelta) oppure la prossima che arriva
    let fork = null;
    if (ci >= 0 && !isMine(t, cur)) fork = cur;
    else { const k = kidsOf(t, cur.id)[0]; if (k && !isMine(t, k)) fork = k; }

    let th = '', opps = '', tiles = '', chips = '', pawn = '';
    for (let j = 0; j < win.length - 1; j++) {
      const a = pos(j), b = pos(j + 1);
      th += `<path class="pzt-th${s + j + 1 <= pi ? ' on' : ''}" d="M${f1(a.x)} ${f1(a.y)} L${f1(b.x)} ${f1(b.y)}"/>`;
    }
    const lastN = win[win.length - 1];
    if (lastN && (s + 6 < seq.length || kidsOf(t, lastN.id).length)) {
      const a = pos(win.length - 1);
      th += `<path class="pzt-th tail" d="M${f1(a.x)} ${f1(a.y)} L${f1(a.x)} ${PH}"/>`;
    }
    win.forEach((n, j) => {
      const p = pos(j);
      if (isMine(t, n)) {
        const card = t.nodes.get(n.parent_id);
        const st = cardState(card);
        const dim = OP.onlyDue && st !== 'due' && s + j !== pi;
        tiles += tileSVG(p.x, p.y, st, plyLabel(n), s + j === pi, dim, card.id, `${plyLabel(n)} · ${tr(stateKey(st))}`);
      } else {
        const sel = fork && n.id === fork.id && fork.id === cur.id;
        const dim = OP.onlyDue && !(fork && n.id === fork.id);
        opps += oppSVG(p.x, p.y, plyLabel(n), shareOf(t, n) + '%', sel, dim, n.id, `${plyLabel(n)} · ${shareOf(t, n)}%`);
      }
    });
    // altre risposte dell'avversario
    if (fork) {
      const fj = win.findIndex(n => n.id === fork.id);
      const alts = fork.parent_id != null ? kidsOf(t, fork.parent_id).filter(k => k.id !== fork.id).slice(0, 3) : [];
      if (fj >= 0 && alts.length) {
        const top = Math.min(pos(fj).y - 34, PH - 8 - (18 + alts.length * 38));
        chips += `<text class="opc-k" x="316" y="${f1(top + 9)}">${esc(tr('otherReplies'))}</text>`;
        alts.forEach((k, i) => {
          const y = top + 18 + i * 38;
          chips += `<g class="opc" data-a="node" data-id="${k.id}" tabindex="0" role="button" aria-label="${esc(plyLabel(k))}"><rect x="316" y="${f1(y)}" width="92" height="32" rx="6"/>` +
            `<text x="362" y="${f1(y + 20.5)}" text-anchor="middle">${esc(k.move_san)} · ${shareOf(t, k)}%</text></g>`;
        });
      }
    }
    if (jp >= 0 && jp < win.length) {
      const p = pos(jp);
      pawn = `<g transform="translate(${f1(p.x)},${f1(p.y - THH - 4)}) scale(1.7) translate(-28,-60)"><g class="pzt-pawn">${PAWN}</g></g>`;
    }
    return `<svg viewBox="0 0 ${PW} ${PH}" class="or-pathsvg" role="group" aria-label="${esc(tr('tabLine'))}">${th}${opps}${tiles}${chips}${pawn}</svg>`;
  }

  // ── mappa: alberello attorno alla posizione ──────────────────────────
  function mapSVG(t) {
    const cur = currentNode();
    if (!cur) return '';
    const anc = ancestors(t, cur.id);
    const onPath = new Set(anc.map(n => n.id));
    const rootN = anc[Math.max(0, anc.length - 2)];
    const MAXK = 3, MAXD = 4, W = 134, H = 104;
    let leaf = 0, maxD = 0, guard = 0;
    const raw = [], eds = [];
    const pickKids = n => {
      const all = kidsOf(t, n.id);
      if (all.length <= MAXK) return all;
      const keep = new Set(all.filter(k => onPath.has(k.id)).map(k => k.id));
      for (const k of all) { if (keep.size >= MAXK) break; keep.add(k.id); }
      return all.filter(k => keep.has(k.id));
    };
    const lay = (n, d) => {
      maxD = Math.max(maxD, d);
      const kids = d >= MAXD || ++guard > 60 ? [] : pickKids(n);
      let y;
      if (!kids.length) y = leaf++;
      else { const ys = kids.map(c => lay(c, d + 1)); y = (ys[0] + ys[ys.length - 1]) / 2; kids.forEach(c => eds.push([n, c])); }
      raw.push({ n, d, y });
      return y;
    };
    lay(rootN, 0);
    const span = Math.max(leaf - 1, 1), dY = Math.min(22, (H - 26) / Math.max(maxD, 1));
    const P = new Map();
    raw.forEach(r => P.set(r.n.id, { x: leaf === 1 ? W / 2 : 12 + (W - 24) * r.y / span, y: 13 + r.d * dY, d: r.d }));
    let links = '', nodes = '', labels = '', hits = '';
    eds.forEach(([a, b]) => {
      const p = P.get(a.id), q = P.get(b.id), on = onPath.has(a.id) && onPath.has(b.id);
      links += `<path class="${on ? 'mm-on' : 'mm-off'}" d="M${f1(p.x)} ${f1(p.y)} L${f1(q.x)} ${f1(q.y)}"/>`;
    });
    raw.forEach(({ n, d }) => {
      const p = P.get(n.id), isCur = n.id === cur.id, on = onPath.has(n.id);
      nodes += `<circle class="${isCur ? 'mm-cur' : on ? 'mm-non' : 'mm-noff'}" cx="${f1(p.x)}" cy="${f1(p.y)}" r="${isCur ? 5.4 : on ? 3.8 : 3.2}"/>`;
      if (d <= 1 || on || n.parent_id === cur.id) {
        const x = Math.max(9, Math.min(W - 9, p.x));
        labels += `<text class="${on ? 'mm-lon' : 'mm-loff'}" x="${f1(x)}" y="${f1(p.y - 7.5)}" text-anchor="middle">${esc(plyLabel(n))}</text>`;
      }
      hits += `<circle class="mm-hit" data-a="node" data-id="${n.id}" cx="${f1(p.x)}" cy="${f1(p.y)}" r="6.5"><title>${esc(plyLabel(n))}</title></circle>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="or-mapsvg" role="img" aria-label="${esc(tr('map'))}">${links}${nodes}${labels}${hits}</svg>`;
  }

  // ── statistiche del capitolo ─────────────────────────────────────────
  function statsHTML(t) {
    const cards = new Map();
    for (const n of t.nodes.values()) if (isCard(t, n) && !cards.has(n.epd)) cards.set(n.epd, n);
    let nw = 0, due = 0, learned = 0;
    const days = new Array(7).fill(0);
    for (const n of cards.values()) {
      const st = cardState(n);
      if (st === 'new') nw++;
      else if (st === 'due') due++;
      else {
        learned++;
        const d = Math.round((new Date(n.srs_due) - new Date(OP.today)) / 86400000);
        if (d >= 1 && d <= 6) days[d]++;
      }
    }
    days[0] = due;
    const total = cards.size || 1, mx = Math.max(...days, 1);
    const pct = Math.round(100 * learned / total);
    const bars = days.map((v, i) => `<div class="st-b"><div class="st-bw"><i style="height:${Math.round(100 * v / mx)}%"></i></div><b>${v}</b><span>${i === 0 ? esc(tr('nToday')) : '+' + i}</span></div>`).join('');
    return `<div class="or-scroll" id="opBody"><div class="oc-box4 st-box">` +
      `<div><b>${cards.size}</b><span>${esc(tr('sCards'))}</span></div><div><b>${learned}</b><span>${esc(tr('stLearned'))}</span></div>` +
      `<div><b>${due}</b><span>${esc(tr('stDue'))}</span></div><div><b>${nw}</b><span>${esc(tr('stNew'))}</span></div></div>` +
      `<div class="st-prog"><div class="st-ph"><span class="or-k">${esc(tr('sLearnedPct'))}</span><b>${pct}%</b></div><div class="gc-bar"><i style="width:${pct}%"></i></div></div>` +
      `<div class="st-days"><span class="or-k">${esc(tr('sNext7'))}</span><div class="st-bars">${bars}</div></div></div>`;
  }

  function tabsHTML() {
    const tabs = [['line', 'tabLine'], ['tree', 'tabTree'], ['stats', 'tabStats']];
    const lg = (cls, label) => `<span class="or-lg"><svg width="26" height="16" viewBox="0 0 26 16" aria-hidden="true"><polygon class="lgd ${cls}" points="13,1 25,8 13,15 1,8"/>` +
      `${cls === 'due' ? '<circle class="lgb" cx="22" cy="3" r="3.2"/>' : ''}</svg>${esc(label)}</span>`;
    return `<div class="or-top"><div class="or-tabs" role="tablist">` +
      tabs.map(([k, l]) => `<button role="tab" aria-selected="${OP.tab === k}" class="${OP.tab === k ? 'on' : ''}" data-a="tab" data-t="${k}">${esc(tr(l))}</button>`).join('') + `</div>` +
      `<div class="or-flt"><button class="or-chip" data-a="onlydue" aria-pressed="${OP.onlyDue}"><i></i>${esc(tr('onlyDue'))}</button>` +
      `<div class="or-legend">${lg('learned', tr('stLearned'))}${lg('due', tr('lgDue'))}${lg('new', tr('stNew'))}</div></div></div>`;
  }

  function rightExploreHTML(ch, t) {
    let content;
    if (OP.tab === 'tree') content = treeHTML(t, ch);
    else if (OP.tab === 'stats') content = statsHTML(t);
    else content = `<div class="or-path">${pathSVG(t)}</div><div class="or-map"><span class="or-k">${esc(tr('map'))}</span>${mapSVG(t)}</div>`;
    return tabsHTML() + `<div class="or-bd or-${OP.tab}">${content}</div>`;
  }

  // ── intestazione e piede della colonna centrale ──────────────────────
  function crumbsHTML(t, L) {
    const seq = L.seq, groups = [];
    seq.forEach((n, i) => {
      const k = Math.ceil(n.ply / 2);
      let g = groups[groups.length - 1];
      if (!g || g.k !== k) { g = { k, nodes: [] }; groups.push(g); }
      g.nodes.push({ n, i });
    });
    return groups.map(g => {
      const txt = g.nodes.map((x, j) => (x.n.ply % 2 === 1 ? g.k + '.' : (j === 0 ? g.k + '…' : '')) + x.n.move_san).join(' ');
      const on = g.nodes.some(x => x.i === L.ci);
      return `<button class="oh-cr${on ? ' on' : ''}" data-a="node" data-id="${g.nodes[g.nodes.length - 1].n.id}">${esc(txt)}</button>`;
    }).join('');
  }

  function headHTML(ch, t) {
    const L = layoutTree(t, ch), M = lineModel(t);
    const sub = [tr(ch.color), L.eco, tr(L.cards === 1 ? 'cards1' : 'cards', { n: L.cards }), tr('dueTodayN', { n: ch.due || 0 }), tr('newTag', { n: ch.new || 0 })].filter(Boolean).join(' · ');
    const pos = M.ci < 0 ? tr('posStart') : tr('posAfter', { m: plyLabel(M.cur) });
    return `<div class="oh-in"><div class="oh-top"><div class="oh-ttl"><h1>${esc(ch.name)}</h1><span class="oh-meta">${esc(sub)}</span></div>` +
      `<div class="oh-btns"><button class="opb pri" data-a="review-ch">${esc(tr('reviewCh', { n: chapterReviewN(ch) }))} <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="M1 1 L11 7 L1 13 Z"/></svg></button>` +
      `<button class="opb" data-a="games">${esc(tr('gamesBtn'))}</button></div></div>` +
      `<div class="oh-crumbs" id="opCrumbs">${crumbsHTML(t, M)}</div><div class="oh-pos">${esc(pos)}</div></div>`;
  }

  function footHTML(ch, t) {
    const cur = currentNode();
    if (!cur) return '';
    if (inVariation()) return `<div class="of-in"><span class="of-txt">${esc(tr('outRep'))}</span></div>`;
    const kids = kidsOf(t, cur.id);
    const card = cardAt(t, cur);
    const branch = cardsUnder(t, cur.id).length;
    let big = '—', chip = '', txt = '', extra = '';
    if (cur.user_to_move && kids.length) {
      const st = cardState(cur);
      big = kids.map(plyLabel).join(' / ');
      chip = `<span class="of-chip ${st}">${esc(tr(st === 'due' ? 'stDueToday' : stateKey(st)))}${st === 'learned' ? ' · ' + esc(dueText(cur)) : ''}</span>`;
      const rep = kidsOf(t, kids[0].id);
      txt = rep.length ? tr('oppReplies', { mv: plyLabel(rep[0]), p: shareOf(t, rep[0]) }) : tr('endOfLine');
    } else if (kids.length) {
      big = plyLabel(kids[0]);
      txt = tr('oppAnswers', { list: kids.slice(0, 3).map(k => `${plyLabel(k)} ${shareOf(t, k)}%`).join(' · ') });
    } else {
      const c = canonical(t, cur);
      if (c.id !== cur.id) { txt = tr('transposes'); extra = `<button class="opb" data-a="node" data-id="${c.id}">${esc(tr('goThere'))} · ${esc(plyLabel(c))}</button>`; }
      else txt = tr('endOfLine');
    }
    return `<div class="of-in"><div class="of-row"><span class="of-big">${esc(big)}</span>${chip}<span class="of-txt">${esc(txt)}</span>${extra}</div>` +
      `<div class="of-btns"><button class="opb pri" data-a="review-card"${card ? '' : ' disabled'}>${esc(tr('reviewMove'))}</button>` +
      `<button class="opb" data-a="study-here"${branch ? '' : ' disabled'}>${esc(tr('studyHere'))}</button>` +
      `<button class="opl" data-a="tab" data-t="tree"${branch ? '' : ' disabled'}>${esc(tr(branch === 1 ? 'branch1' : 'branchN', { n: branch }))}</button></div></div>`;
  }

  function drillHTML() {
    const d = OP.drill, ch = curChapter(), t = tree();
    const remaining = d.queue.filter(q => !d.done.has(q.id));
    const due = remaining.filter(q => !q.isNew).length, nw = remaining.filter(q => q.isNew).length;
    let h = `<div class="oc-head"><div><div class="gc-k">${esc(tr('drillTitle'))}</div><div class="oc-name" style="font-size:30px">${esc(ch ? ch.name : '')}</div></div><button class="gc-btn sm ter" data-a="end">${esc(tr('endBtn'))}</button></div>` +
      `<div class="oc-cnt"><div><b>${due}</b><span>${esc(tr('dDue'))}</span></div><div><b>${nw}</b><span>${esc(tr('dNew'))}</span></div><div><b>${d.ok}</b><span>${esc(tr('dOk'))}</span></div><div><b${d.ko ? ' style="color:var(--err)"' : ''}>${d.ko}</b><span>${esc(tr('dKo'))}</span></div></div>`;
    if (d.finished) {
      const empty = !d.queue.length;
      return h + `<div class="gc-body tall" id="opBody"><div class="gc-k">${esc(tr('sessKicker'))}</div><div class="gc-h1">${esc(empty ? tr('nothingDueTitle') : tr('doneTitle'))}</div>` +
        `<div class="gc-p">${esc(empty ? d.msg : tr('doneSummary', { ok: d.ok, ko: d.ko }))}</div><div class="gc-row"><button class="gc-btn pri" data-a="review">${esc(tr('again'))}</button><button class="gc-btn" data-a="explore">${esc(tr('exploreTree'))}</button></div></div>`;
    }
    const n = d.node, curN = currentNode();
    const nn = n ? (n.ply % 2 === 0 ? (n.ply / 2 + 1) + '.' : Math.ceil(n.ply / 2) + '…') : '';
    const exp = n && t ? kidsOf(t, n.id).map(k => k.move_san).join(' / ') : '';
    let kicker = tr('kYour'), title = nn + '?', sub = tr('subAsk'), red = false;
    if (d.msg === tr('newMove')) { kicker = tr('kNew'); title = nn + exp.split(' / ')[0]; sub = tr('subNew'); }
    if (d.missed && !d.busy) {
      red = true; kicker = d.hinted ? tr('kHint') : tr('kWrong'); title = nn + exp.split(' / ')[0];
      sub = d.hinted ? tr('subHint', { num: nn, san: exp }) : tr('subWrong', { num: nn, played: d.played || '', san: exp });
    }
    if (d.busy && d.msg === tr('correct')) { kicker = d.missed ? tr('kNowGot') : tr('kCorrect'); title = curN ? plyLabel(curN) : ''; sub = tr('subOpp'); }
    if (d.busy && d.msg === tr('lineDone')) { kicker = tr('lineDone'); title = '✓'; sub = tr('subNext'); }
    const shown = OP.path.slice(1, 13).map(id => t && t.nodes.get(id)).filter(Boolean);
    const line = shown.map(x => `<span>${x.ply % 2 === 1 ? `<i>${Math.ceil(x.ply / 2)}.</i>` : ''}${esc(x.move_san)}</span>`).join('');
    const tail = !d.busy && !d.finished ? `<span style="color:var(--ink-3)">${esc(nn)}?</span>` : '';
    return h + `<div class="gc-body tall" id="opBody"><div class="gc-k"${red ? ' style="color:var(--err)"' : ''}>${esc(kicker)}</div><div class="oc-big">${esc(title)}</div><div class="gc-p" style="font-size:24px">${esc(sub)}</div>` +
      `<div class="oc-line">${line}${tail}</div><div style="flex:1"></div><div class="gc-row"><button class="gc-btn sm" data-a="hint">${esc(tr('hintBtn'))} <span style="color:var(--ink-3)">${esc(tr('hintCount'))}</span></button><button class="gc-btn sm" data-a="skip">${esc(tr('skip'))}</button></div></div>`;
  }

  function gamesHTML() {
    return `<div class="oc-head"><div class="oc-name" style="font-size:40px">${esc(tr('gTitleShort'))}</div><button class="gc-btn sm ter" data-a="explore">${esc(tr('backRep'))}</button></div>` +
      `<div class="gc-body" id="opBody" data-v="games"><div class="oc-form"><label>${esc(tr('gAccounts'))}<input id="opUser" autocomplete="off" spellcheck="false"></label>` +
      `<label>${esc(tr('gMonths'))}<select id="opMonths"><option>1</option><option selected>2</option><option>3</option><option>6</option></select></label>` +
      `<button class="gc-btn pri sm" data-a="sync" id="opSyncBtn">${esc(tr('gSync'))}</button></div><div class="gc-hint"><span id="opUserHint"></span> <span id="opSyncStatus"></span></div><div id="opGamesSummary"></div></div>`;
  }

  function setHF(on) {
    if (document.body.classList.contains('op-hf') === on) return;
    document.body.classList.toggle('op-hf', on);
    if (typeof fitBoard === 'function') { fitBoard(); }
    if (typeof renderArrows === 'function') renderArrows();
  }

  function renderColumn() {
    const side = $('opCol'), right = $('opRight'), head = $('opHead'), foot = $('opFoot');
    if (!side || !right) return;
    if (renderLevels()) return;
    const ch = curChapter(), t = tree();
    const games = OP.view === 'games' && OP.mode !== 'drill';
    // sidebar (si ridisegna sempre; la ricerca resta com'è)
    const sideScroll = side.querySelector('.os-list') ? side.querySelector('.os-list').scrollTop : 0;
    if (false) {
      side.innerHTML = sideHTML();
      const sl = side.querySelector('.os-list'); if (sl) sl.scrollTop = sideScroll;
      applySearch();
    }
    const keepBody = games && body() && body().dataset.v === 'games';
    if (!keepBody) {
      const old = right.querySelector('.gc-body, .or-scroll'), keep = old ? old.scrollTop : 0;
      const wrap = $('opTreeWrap'), kx = wrap ? wrap.scrollLeft : 0, ky = wrap ? wrap.scrollTop : 0;
      let html;
      if (OP.mode === 'drill' && OP.drill) html = drillHTML();
      else if (games) html = gamesHTML();
      else if (!ch) html = '<div class="gc-body" id="opBody"></div>';
      else if (!ch.built || !t) html = unbuiltHTML(ch);
      else html = rightExploreHTML(ch, t);
      right.innerHTML = html;
      const nb = right.querySelector('.gc-body, .or-scroll'); if (nb && nb.id === 'opBody') nb.scrollTop = keep;
      const w2 = $('opTreeWrap');
      if (w2) {
        const c = right.querySelector('.oc-n.cur');
        if (c) { w2.scrollLeft = c.offsetLeft - (w2.clientWidth - c.offsetWidth) / 2; w2.scrollTop = Math.max(0, c.offsetTop - w2.clientHeight / 2); }
        else { w2.scrollLeft = kx; w2.scrollTop = ky; }
      }
    }
    // colonna centrale: intestazione + piede, solo quando si esplora un capitolo costruito
    const hf = OP.mode === 'explore' && !games && !!(ch && ch.built && t);
    if (head) head.innerHTML = hf ? headHTML(ch, t) : '';
    if (foot) foot.innerHTML = hf ? footHTML(ch, t) : '';
    setHF(hf);
    const cr = $('opCrumbs'), on = cr && cr.querySelector('.oh-cr.on');
    if (on) cr.scrollLeft = Math.max(0, on.offsetLeft - (cr.clientWidth - on.offsetWidth) / 2);
  }

  function renderAll() {
    if (!OP.active) return;
    renderChapters();
    renderColumn();
  }

  function onColClick(ev) {
    const el = ev.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const a = el.dataset.a;
    if (onLevelClick(a, el)) return;
    if (a === 'chap') { if (OP.mode === 'drill') stopDrill(); setView('explore'); selectChapter(el.dataset.id); }
    else if (a === 'node') {
      if (OP.mode === 'drill') return;
      goToNode(+el.dataset.id);
    }
    else if (a === 'tab') { OP.tab = el.dataset.t; renderColumn(); }
    else if (a === 'onlydue') { OP.onlyDue = !OP.onlyDue; renderColumn(); }
    else if (a === 'review') { setView('explore'); startDrill(); }
    else if (a === 'review-ch') { setView('explore'); startDrill({ chapter: OP.chapterId }); }
    else if (a === 'review-card') {
      const t = tree(), c = t && cardAt(t, currentNode());
      if (c) startDrill({ chapter: OP.chapterId, cards: [c.id] });
    }
    else if (a === 'study-here') {
      const t = tree(), n = currentNode();
      if (t && n) startDrill({ chapter: OP.chapterId, branch: n.id });
    }
    else if (a === 'games') openGames();
    else if (a === 'explore') { if (OP.mode === 'drill') stopDrill(); else { setView('explore'); renderAll(); } }
    else if (a === 'end') { const d = OP.drill; if (d) { d.finished = true; d.msg = tr('sessionDone'); d.arrow = null; renderAll(); renderArrows(); } }
    else if (a === 'hint') {
      const d = OP.drill;
      if (!d || !d.node || d.busy) return;
      d.arrow = kidsOf(tree(), d.node.id)[0]?.move_uci || null;
      if (!d.missed) { d.missed = true; d.hinted = true; d.ko++; grade(d.node, false); }
      renderAll(); renderArrows();
    }
    else if (a === 'skip') { const d = OP.drill; if (d && d.node) { d.done.add(d.node.id); nextLine(); } }
    else if (a === 'build') {
      api('/api/rep/build', {}).then(() => { OP.build = { running: true }; renderAll(); pollBuild(); });
    }
    else if (a === 'sync') syncGames();
  }
  ['opColWrap', 'opRight', 'opHead', 'opFoot'].forEach(id => $(id) && $(id).addEventListener('click', onColClick));
  // tessere e rombi sono <g role="button">: Invio / Spazio come un click
  $('opRight') && $('opRight').addEventListener('keydown', ev => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest && ev.target.matches('[role="button"][data-a]')) { ev.preventDefault(); onColClick(ev); }
  });
  $('opCol') && $('opCol').addEventListener('input', ev => {
    if (ev.target.id === 'opSearch') { OP.search = ev.target.value; applySearch(); }
  });

  function setView(v) {
    OP.view = v;
    document.body.classList.toggle('op-games', v === 'games');
  }

  function renderChapters() {
    const box = $('opChapters');
    if (!box) return;
    let html = '';
    for (const color of ['white', 'black']) {
      const list = OP.chapters.filter(c => c.color === color);
      if (!list.length) continue;
      html += `<div class="group ${color === 'white' ? 'book' : 'out'}"><i></i>${esc(tr(color))}</div>`;
      for (const c of list) {
        const cur = c.id === OP.chapterId ? ' aria-current="true"' : '';
        const tag = !c.built ? '—' : (c.due ? `<b>${c.due}</b>` : '') + (c.new ? ` <span>+${c.new}</span>` : '');
        const tip = c.built ? tr('dueTag', { n: c.due }) + ' · ' + tr('newTag', { n: c.new }) : tr('notBuilt');
        html += `<button class="obj op-ch" data-id="${esc(c.id)}" title="${esc(tip)}"${cur}>
          <i class="sw ${color === 'white' ? 'sw-white' : 'sw-black'}"></i>
          <span class="op-ch-name">${esc(c.name)}</span><small>${tag}</small></button>`;
      }
    }
    box.innerHTML = html;
    box.querySelectorAll('.op-ch').forEach(b => b.onclick = () => {
      if (OP.mode === 'drill') stopDrill();
      selectChapter(b.dataset.id);
    });
    const due = OP.chapters.reduce((a, c) => a + (c.due || 0), 0);
    const nw = OP.chapters.reduce((a, c) => a + (c.new || 0), 0);
    const rb = $('opReviewBtn');
    if (rb) {
      rb.textContent = tr('reviewN', { n: due + Math.min(nw, OP.newPerDay || 10) });
      rb.disabled = !OP.chapters.some(c => c.built);
    }
    window.setOpBadge && window.setOpBadge(due);
    $('opCount') && ($('opCount').textContent = OP.chapters.filter(c => c.built).length + '/' + OP.chapters.length);
  }

  function renderKids() {
    const box = $('opKids');
    const head = $('opKidsHead');
    if (!box) return;
    const t = tree();
    const ch = OP.chapters.find(c => c.id === OP.chapterId);
    if (!t || !ch || !ch.built) { box.innerHTML = ''; if (head) head.textContent = ''; return; }
    const n = currentNode();
    if (!n) return;
    if (head) head.textContent = n.user_to_move ? tr('yourMove') : tr('oppMove');
    const kids = kidsOf(t, n.id);
    if (inVariation()) { box.innerHTML = ''; return; }
    if (!kids.length) {
      const c = canonical(t, n);
      box.innerHTML = c.id !== n.id
        ? `<div class="op-note">${esc(tr('transposes'))}</div><button class="btn btn-wide" id="opTransBtn">${esc(tr('goThere'))} · ${esc(plyLabel(c))}</button>`
        : `<div class="op-note">${esc(tr('endOfLine'))}</div>`;
      $('opTransBtn') && ($('opTransBtn').onclick = () => goToNode(c.id));
      return;
    }
    const total = kids.reduce((a, k) => a + (k.weight || 1), 0) || 1;
    box.innerHTML = kids.map(k => {
      const share = Math.round(100 * (k.weight || 1) / total);
      const tag = n.user_to_move ? `<span class="cb inv">${esc(tr('yours'))}</span>`
        : k.flag === 'punish' ? `<span class="cb">${esc(tr('punish'))}</span>` : `<span class="op-share">${share}%</span>`;
      const bar = n.user_to_move ? '' : `<i class="op-bar"><i style="width:${share}%"></i></i>`;
      const ev = evalOf(k);
      return `<button class="op-kid" data-id="${k.id}">
        <span class="op-kid-san">${esc(plyLabel(k))}</span>${bar}
        <span class="op-kid-ev">${esc(ev ? evText(ev) : '')}</span>${tag}
        <span class="op-kid-name">${esc(k.name || '')}</span></button>`;
    }).join('');
    box.querySelectorAll('.op-kid').forEach(b => b.onclick = () => goToNode(+b.dataset.id));
  }

  function lineText(t, n) {
    return ancestors(t, n.id).slice(1).map(x => x.ply % 2 === 1 ? `${Math.ceil(x.ply / 2)}.${x.move_san}` : x.move_san).join(' ');
  }

  function renderInspector() {
    const box = $('opInsp');
    if (!box) return;
    const ch = OP.chapters.find(c => c.id === OP.chapterId);
    if (!ch) { box.innerHTML = ''; return; }
    if (!ch.built) { renderBuildPanel(box); return; }
    const t = tree(); const n = currentNode();
    if (!t || !n) return;
    // nome: ultimo nome lungo il percorso
    const path = ancestors(t, n.id);
    const named = [...path].reverse().find(x => x.name);
    const card = isCard(t, n);
    const reps = card ? `${n.srs_reps}${n.srs_lapses ? ' · ' + n.srs_lapses + '✕' : ''}` : '—';
    const mine = kidsOf(t, n.id);
    let yours = '';
    if (n.user_to_move && mine.length) {
      yours = `<div class="op-yours"><div><span class="op-k">${esc(tr('yourMove'))}</span>
        <div class="op-yours-san">${mine.map(k => esc(plyLabel(k))).join(' / ')}</div></div>
        <button class="btn" id="opChangeBtn">${esc(tr('change'))}</button></div>
        <div id="opCands"></div>`;
    } else if (!n.user_to_move && mine.length) {
      yours = `<div class="op-yours"><div><span class="op-k">${esc(tr('oppMove'))}</span>
        <div class="op-yours-san op-dim">${mine.slice(0, 4).map(k => esc(k.move_san)).join(' · ')}</div></div></div>`;
    }
    const isRoot = n.ply <= (ch.root_san || []).length;
    const comment = n.comment || (isRoot ? (ch.context || '') : '');
    box.innerHTML = `
      <div class="op-head">
        <div class="op-k">${esc((named?.eco || '') + (named?.eco ? ' · ' : '') + ch.name)}</div>
        <h2>${esc(named?.name || ch.name)}</h2>
        <div class="op-line">${esc(lineText(t, n))}</div>
      </div>
      <div class="summary">
        <div><b id="opEvalTile">${esc(evText(evalOf(n) || gameEvals[mainIdx]))}</b><span>${esc(tr('tEval'))}</span></div>
        <div><b>${n.weight || 0}</b><span>${esc(tr('tWeight'))}</span></div>
        <div><b>${esc(card ? dueText(n) : '—')}</b><span>${esc(tr('tNext'))}</span></div>
        <div><b>${esc(reps)}</b><span>${esc(tr('tReps'))}</span></div>
      </div>
      ${yours}
      <div class="op-comment">
        <div class="op-k">${esc(tr('ideas'))}${n.comment_src === 'ai' ? ' · AI' : ''}</div>
        <div class="explanation-text" id="opCommentText">${comment ? esc(comment) : `<span class="op-dim">${esc(tr('noComment'))}</span>`}</div>
        <div class="op-row"><button class="btn" id="opAiBtn">${esc(tr('explainAi'))}</button>
        <button class="btn" id="opEditBtn">${esc(tr('edit'))}</button></div>
      </div>`;
    $('opChangeBtn') && ($('opChangeBtn').onclick = () => showCandidates(n));
    $('opAiBtn').onclick = () => explainNode(n);
    $('opEditBtn').onclick = () => editComment(n);
  }

  function renderBuildPanel(box) {
    const b = OP.build || {};
    box.innerHTML = `
      <div class="op-head"><div class="op-k">${esc(tr('repertoire'))}</div><h2>${esc(tr('notBuilt'))}</h2></div>
      <p class="op-note">${esc(OP.engine ? tr('buildHint') : tr('noEngine'))}</p>
      ${b.running ? `<div class="progress-bar"><div class="progress-fill" style="width:${b.total ? Math.round(100 * b.done / b.total) : 5}%"></div></div>
         <div class="op-note">${esc(tr('building', { ch: b.chapter || '', done: b.done || 0, total: b.total || 0, nodes: b.nodes || 0 }))}</div>`
        : `<button class="btn btn-primary btn-wide" id="opBuildBtn" ${OP.engine ? '' : 'disabled'}>${esc(tr('buildBtn'))}</button>`}
      ${b.error ? `<div class="op-note">${esc(b.error)}</div>` : ''}`;
    $('opBuildBtn') && ($('opBuildBtn').onclick = async () => {
      await api('/api/rep/build', {});
      OP.build = { running: true };
      renderInspector();
      pollBuild();
    });
  }

  let pollTimer = null;
  function pollBuild(after) {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      const b = await api('/api/rep/build_status');
      OP.build = b;
      if (b.running) {
        if (OP.active && OP.level === 1 && b.job === 'merge') renderAll();
        if (OP.active && OP.mode === 'explore') {
          const ch = OP.chapters.find(c => c.id === OP.chapterId);
          if (!ch || !ch.built) renderAll(); else toast(tr('rebuilding'));
        }
        pollBuild(after);
      } else {
        OP.trees = {};
        await refreshChapters();
        if (after) after();
        else if (OP.active && OP.chapterId) await selectChapter(OP.chapterId);
      }
    }, 1200);
  }

  function renderFlow() {
    const box = $('opFlow');
    if (!box) return;
    const t = tree();
    if (!t || !OP.path.length) { box.innerHTML = ''; return; }
    const shown = OP.path.slice(1).map(id => t.nodes.get(id));
    // anteprima della continuazione principale (tratteggiata)
    let tail = t.nodes.get(OP.path[OP.path.length - 1]);
    const preview = [];
    if (OP.mode === 'explore') {
      for (let i = 0; i < 4 && tail; i++) {
        const k = kidsOf(t, tail.id)[0];
        if (!k) break;
        preview.push(k); tail = k;
      }
    }
    const byUser = n => !n.user_to_move;          // dopo la mossa tocca all'avversario → l'hai mossa tu
    box.innerHTML = shown.map((n, i) => {
      const idx = i + 1;
      const cls = idx === mainIdx && !inVariation() ? 'cur' : idx < mainIdx ? 'done' : '';
      return `<button class="stg ${cls}" data-i="${idx}"><b>${String(n.ply).padStart(2, '0')} · ${esc(byUser(n) ? tr('you') : tr('oppShort'))}</b>
        <span>${esc(plyLabel(n))}</span><small>${esc(n.eco ? n.eco + ' ' + (n.name || '').split(':').pop().trim() : '')}</small></button>`;
    }).join('') + preview.map(n => `<button class="stg planned" data-node="${n.id}"><b>${String(n.ply).padStart(2, '0')} · ${esc(byUser(n) ? tr('you') : tr('oppShort'))}</b>
        <span>${esc(plyLabel(n))}</span><small>${esc(n.eco || '')}</small></button>`).join('');
    box.querySelectorAll('.stg').forEach(b => b.onclick = () => {
      if (OP.mode === 'drill') return;
      if (b.dataset.node) goToNode(+b.dataset.node); else goToIndex(+b.dataset.i);
    });
    const cur = box.querySelector('.stg.cur') || box.lastElementChild;
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // ── Cambia mossa / commenti ─────────────────────────────────────────
  async function showCandidates(n) {
    const box = $('opCands');
    box.innerHTML = `<div class="op-note">${esc(tr('loadingCands'))}</div>`;
    const d = await api(`/api/rep/node/${n.id}/candidates`);
    if (d.error) { box.innerHTML = `<div class="op-note">${esc(d.error)}</div>`; return; }
    const current = new Set(kidsOf(tree(), n.id).map(k => k.move_uci));
    box.innerHTML = `<div class="op-k">${esc(tr('pickMove'))}</div>` + d.candidates.map(c => `
      <div class="op-cand${current.has(c.uci) ? ' on' : ''}"><span class="op-kid-san">${esc(c.san)}</span>
      <span class="op-kid-ev">${esc(evText(c.eval_mate != null ? { type: 'mate', value: c.eval_mate } : { type: 'cp', value: c.eval_cp }))}</span>
      <span class="op-share">${c.weight ? c.weight + ' ' + esc(tr('tWeight').toLowerCase()) : 'engine'}</span>
      <button class="btn btn-xs" data-uci="${esc(c.uci)}" ${current.has(c.uci) ? 'disabled' : ''}>${esc(tr('pick'))}</button></div>`).join('');
    box.querySelectorAll('button[data-uci]').forEach(b => b.onclick = async () => {
      const r = await api(`/api/rep/node/${n.id}/set_move`, { uci: b.dataset.uci });
      if (!r.ok) { toast(r.error || 'Errore'); return; }
      toast(tr('rebuilding'));
      const keep = n.id;
      pollBuild(async () => { await loadTree(OP.chapterId, true); goToNode(keep); });
    });
  }

  async function explainNode(n) {
    const el = $('opCommentText');
    el.innerHTML = `<span class="op-dim">${esc(tr('aiWorking'))}</span>`;
    const d = await api(`/api/rep/node/${n.id}/explain`, { lang: currentLang });
    if (d.explanation) {
      n.comment = d.explanation; n.comment_src = 'ai';
      renderInspector();
    } else {
      el.innerHTML = `<span class="op-dim">${esc(tr('aiOff'))}</span>`;
    }
  }

  function editComment(n) {
    const el = $('opCommentText');
    el.innerHTML = `<textarea class="op-textarea" id="opCommentEdit">${esc(n.comment || '')}</textarea>
      <div class="op-row"><button class="btn btn-primary" id="opSaveC">${esc(tr('save'))}</button>
      <button class="btn" id="opCancelC">${esc(tr('cancel'))}</button></div>`;
    $('opSaveC').onclick = async () => {
      const text = $('opCommentEdit').value.trim();
      await api(`/api/rep/node/${n.id}/comment`, { text });
      n.comment = text || null; n.comment_src = text ? 'manual' : null;
      renderInspector();
    };
    $('opCancelC').onclick = renderInspector;
  }

  // ── RIPASSO ─────────────────────────────────────────────────────────
  function newDoneToday() {
    try { return +(localStorage.getItem('op_new_' + OP.today) || 0); } catch { return 0; }
  }
  function bumpNewDone() {
    try { localStorage.setItem('op_new_' + OP.today, newDoneToday() + 1); } catch {}
  }

  // scope: {} = tutto · {chapter} = un capitolo · {chapter, cards:[id]} / {chapter, branch:id} = ripasso libero
  async function startDrill(scope) {
    if (!scope || scope instanceof Event) scope = {};
    let built = OP.chapters.filter(c => c.built);
    if (scope.chapter) built = built.filter(c => c.id === scope.chapter);
    if (!built.length) return;
    setView('explore');
    for (const c of built) await loadTree(c.id, true);
    const due = [], fresh = [];
    let free = null;
    if (scope.cards || scope.branch) {
      const t = OP.trees[scope.chapter];
      const nodes = scope.cards ? scope.cards.map(id => t.nodes.get(id)).filter(Boolean) : cardsUnder(t, scope.branch);
      free = nodes.map(n => ({ ch: scope.chapter, id: n.id, ply: n.ply, w: n.weight, isNew: n.srs_state === 'new', free: true }));
    }
    for (const c of (free ? [] : built)) {
      const t = OP.trees[c.id];
      const seen = new Set();
      for (const n of t.nodes.values()) {
        if (!isCard(t, n) || seen.has(n.epd)) continue;
        seen.add(n.epd);
        if (n.srs_state === 'new') fresh.push({ ch: c.id, id: n.id, ply: n.ply, w: n.weight, isNew: true });
        else if (!n.srs_due || n.srs_due <= OP.today) due.push({ ch: c.id, id: n.id, due: n.srs_due || '' });
      }
    }
    due.sort((a, b) => a.due.localeCompare(b.due));
    fresh.sort((a, b) => (a.ply - b.ply) || (b.w - a.w));
    const newLeft = Math.max(0, (OP.newPerDay || 10) - newDoneToday());
    const queue = free || [...due, ...fresh.slice(0, newLeft)];
    OP.mode = 'drill';
    document.body.classList.add('op-drill');
    OP.drill = { queue, done: new Set(), graded: new Set(), ok: 0, ko: 0,
                 nDue: free ? free.filter(q => !q.isNew).length : due.length, nNew: free ? free.filter(q => q.isNew).length : Math.min(fresh.length, newLeft),
                 node: null, target: null, busy: false, arrow: null, msg: '', finished: false };
    customDrawings = [];
    if (!queue.length) { OP.drill.finished = true; OP.drill.msg = tr('nothingDue'); renderAll(); return; }
    nextLine();
  }
  OP.startDrill = startDrill;

  function stopDrill() {
    OP.mode = 'explore';
    OP.drill = null;
    document.body.classList.remove('op-drill');
    refreshChapters().then(() => { OP.trees = {}; if (OP.chapterId) selectChapter(OP.chapterId); });
  }

  // quante carte in coda ci sono sotto ogni nodo (per scegliere le risposte avversarie)
  function pendingUnder(t, id, pending, memo = new Map()) {
    if (memo.has(id)) return memo.get(id);
    let c = pending.has(id) ? 1 : 0;
    for (const k of kidsOf(t, id)) c += pendingUnder(t, k.id, pending, memo);
    memo.set(id, c);
    return c;
  }

  function nextLine() {
    const d = OP.drill;
    const item = d.queue.find(q => !d.done.has(q.id));
    if (!item) {
      d.finished = true; d.msg = tr('sessionDone'); d.arrow = null;
      renderAll(); renderArrows();
      return;
    }
    OP.chapterId = item.ch;
    const t = tree();
    const target = t.nodes.get(item.id);
    loadPath(t, ancestors(t, target.id));
    promptAt(target);
  }

  function promptAt(n) {
    const d = OP.drill;
    const t = tree();
    n = canonical(t, n);
    d.node = n; d.arrow = null; d.missed = false; d.hinted = false; d.played = '';
    const graded = d.graded.has(n.id);
    const isNew = n.srs_state === 'new' && !graded;
    if (isNew) {
      d.arrow = kidsOf(t, n.id)[0].move_uci;
      d.msg = tr('newMove');
    } else {
      d.msg = tr('yourTurn');
    }
    d.busy = false;
    renderAll(); renderArrows();
  }

  async function grade(n, correct) {
    const d = OP.drill;
    if (d.graded.has(n.id)) return;
    const item = d.queue.find(q => q.id === n.id);
    const inQueue = !!item && !item.free;
    const isDueNow = n.srs_state === 'new' || !n.srs_due || n.srs_due <= OP.today;
    if (item && item.free) d.done.add(n.id);          // ripasso libero: la carta è fatta comunque
    // carte non ancora in scadenza: contano solo gli errori
    if (!inQueue && !isDueNow && correct) return;
    d.graded.add(n.id);
    d.done.add(n.id);
    if (n.srs_state === 'new' && correct) bumpNewDone();
    const r = await api('/api/rep/review', { node_id: n.id, correct });
    if (r.ok) Object.assign(n, r);
  }

  function drillMove(from, to, promotion) {
    const d = OP.drill;
    if (!d || d.busy || d.finished) return;
    const t = tree();
    const n = d.node;
    const probe = new Chess(mainHistory[mainIdx].fen);
    const mv = probe.move({ from, to, promotion: promotion || 'q' });
    if (!mv) return;
    const kids = kidsOf(t, n.id);
    const epd3 = f => f.split(' ').slice(0, 3).join(' ');
    let hit = kids.find(k => k.move_uci.slice(0, 4) === from + to);
    if (!hit) {
      // trasposizione verso una posizione del repertorio: accettata
      const e = epd3(probe.fen());
      hit = kids.find(k => epd3(k.fen) === e);
    }
    if (!hit) {
      d.ko += d.missed ? 0 : 1;
      d.missed = true;
      d.played = mv.san;
      grade(n, false);
      d.arrow = kids[0].move_uci;
      d.msg = tr('wrong', { san: kids.map(k => k.move_san).join(' / ') });
      selectedSquare = null; legalMoves = [];
      renderBoard(); renderAll();
      return;
    }
    if (!d.missed) { d.ok++; grade(n, true); }
    d.msg = tr('correct');
    d.arrow = null;
    advance(hit);
  }

  function advance(userChild) {
    const d = OP.drill;
    const t = tree();
    goToNodeKeep(userChild);
    let n = canonical(t, userChild);
    const opp = kidsOf(t, n.id);
    if (!opp.length) return lineDone();
    // risposta avversaria: verso i rami con carte in coda, altrimenti per frequenza
    const pending = new Set(d.queue.filter(q => !d.done.has(q.id)).map(q => q.id));
    const scored = opp.map(k => ({ k, p: pendingUnder(t, k.id, pending), w: k.weight || 1 }));
    const pool = scored.some(s => s.p > 0) ? scored.filter(s => s.p > 0) : scored;
    const sum = pool.reduce((a, s) => a + (s.p || s.w), 0);
    let r = Math.random() * sum, pick = pool[0].k;
    for (const s of pool) { r -= (s.p || s.w); if (r <= 0) { pick = s.k; break; } }
    d.busy = true;
    renderAll();
    setTimeout(() => {
      if (OP.drill !== d) return;
      goToNodeKeep(pick);
      const next = canonical(t, pick);
      if (!kidsOf(t, next.id).length) return lineDone();
      promptAt(next);
    }, 550);
  }

  function goToNodeKeep(n) {
    // aggiunge la mossa in coda al percorso corrente senza ricaricare la partita
    const t = tree();
    loadPath(t, ancestors(t, n.id));
  }

  function lineDone() {
    const d = OP.drill;
    d.busy = true;
    d.msg = tr('lineDone');
    if (d.node) d.done.add(d.node.id);
    toast(tr('lineDone'));
    renderAll();
    setTimeout(() => { if (OP.drill === d) nextLine(); }, 800);
  }

  // ── PARTITE chess.com (colonna + pannello sulla scacchiera) ─────────
  async function openGames() {
    setView('games');
    renderAll();
    const s = await api('/api/rep/settings');
    const u = $('opUser');
    if (u) u.value = s.chesscom_username || s.suggested_username || '';
    const hint = $('opUserHint');
    if (hint) hint.textContent = !s.chesscom_username && s.suggested_username ? tr('gSuggest', { u: s.suggested_username }) : '';
    await renderGames();
  }

  async function syncGames() {
    const st = $('opSyncStatus');
    st.textContent = tr('gSyncing');
    const d = await api('/api/rep/games/sync', { username: $('opUser').value.trim(), months: +$('opMonths').value });
    st.textContent = d.ok ? tr('gAdded', { added: d.added, seen: d.seen }) : (d.error || 'Errore');
    await renderGames();
    await refreshChapters();
  }

  function statusText(g) {
    const vars = { ml: g.move_label || '', played: g.played || '', exp: (g.expected || []).join(' / ') };
    return { you: tr('sYou', vars), opp: tr('sOpp', vars), uncovered: tr('sUnc', vars),
             end: tr('sEnd'), no_tree: tr('sNoTree') }[g.status] || g.status;
  }

  async function renderGames() {
    const list = $('opGamesList'), sumEl = $('opGamesSummary');
    if (!list || !sumEl) return;
    list.innerHTML = '<div class="games-loading">…</div>';
    const d = await api('/api/rep/games');
    const games = d.games || [];
    if (!$('opGamesList')) return;
    if (!games.length) { list.innerHTML = `<div class="games-empty">${esc(tr('gEmpty'))}</div>`; sumEl.innerHTML = ''; $('opGamesCount').textContent = ''; return; }
    const count = k => games.filter(g => g.status === k).length;
    const holes = {};
    games.filter(g => g.status === 'uncovered').forEach(g => {
      const key = g.color + '|' + (g.move_label || '') + (g.played || '');
      holes[key] = (holes[key] || 0) + 1;
    });
    const holeRows = Object.entries(holes).sort((a, b) => b[1] - a[1]).map(([k, n]) => {
      const [color, move] = k.split('|');
      return `<div class="oc-hrow"><span>${esc(tr('gHoleRow', { color: tr(color), move, n }).replace(/: \d+ .*$/, ''))}</span><b>${esc(tr('nGames', { n }))}</b></div>`;
    }).join('');
    const chRows = Object.entries(d.chapters || {}).filter(([id]) => id).map(([id, s]) => {
      const ch = OP.chapters.find(c => c.id === id);
      const pts = s.scored ? (Math.round(s.points * 2) / 2).toString() : '—';
      return `<div class="oc-trow"><span>${esc(ch ? ch.name : id)}</span><b>${s.games}</b><b>${pts}</b><b>${s.you || 0}</b></div>`;
    }).join('');
    sumEl.innerHTML = `
      <div class="oc-box4">
        <div><b>${games.length}</b><span>${esc(tr('gCount'))}</span></div>
        <div><b>${count('end')}</b><span>${esc(tr('gEnd'))}</span></div>
        <div><b>${count('you')}</b><span>${esc(tr('gYou'))}</span></div>
        <div><b style="color:var(--err)">${count('uncovered')}</b><span>${esc(tr('gHoles'))}</span></div>
      </div>
      ${holeRows ? `<div class="oc-holes"><span class="gc-k">${esc(tr('gHolesTitle'))}</span>${holeRows}</div>` : ''}
      ${chRows ? `<div class="oc-tbl"><span class="gc-k">${esc(tr('gByChapter'))}</span><div class="oc-trow oc-th"><span>${esc(tr('gChapter'))}</span><span>${esc(tr('gCount'))}</span><span>${esc(tr('gScore'))}</span><span>${esc(tr('gLeft'))}</span></div>${chRows}</div>` : ''}`;
    const LIST_MAX = 300, shown = games.slice(0, LIST_MAX);
    $('opGamesCount').textContent = tr('gShowing', { n: shown.length, t: games.length });
    list.innerHTML = shown.map(g => {
      const opp = g.color === 'white' ? g.black : g.white;
      const res = g.score == null ? '·' : g.score === 1 ? '1' : g.score === 0 ? '0' : '½';
      const canStudy = g.chapter_id && g.node_id;
      const hole = g.status === 'uncovered';
      const tag = hole ? tr('holeTag') : g.lapse_applied ? tr('gLapse') : '';
      return `<div class="oc-grow">
        <span class="mono">${esc(g.date)}</span>
        <i class="sw ${g.color === 'white' ? 'sw-white' : 'sw-black'}"></i>
        <span class="opp">${esc(opp)}</span>
        <span class="res">${res}</span>
        <span class="st"><span${hole ? ' style="color:var(--err)"' : ''}>${esc(statusText(g))}</span>${tag ? `<small>${esc(tag)}</small>` : ''}</span>
        <span class="act"><button class="gc-btn sm ter" data-open="${esc(g.key)}" data-ply="${g.ply || 0}">${esc(tr('open'))}</button>
        <button class="gc-btn sm" data-study="${esc(g.chapter_id || '')}" data-node="${g.node_id || 0}"${canStudy ? '' : ' disabled'}>${esc(tr('study'))}</button></span></div>`;
    }).join('');
    list.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => {
      const r = await api(`/api/rep/games/${encodeURIComponent(b.dataset.open)}/pgn`);
      if (!r.pgn) return;
      OP.close();
      loadPgn(r.pgn);
      goToIndex(Math.max(0, (+b.dataset.ply || 1) - 1));
    });
    list.querySelectorAll('[data-study]').forEach(b => b.onclick = async () => {
      if (!b.dataset.study) return;
      setView('explore');
      if (!OP.active) await OP.open(b.dataset.study);
      if (OP.mode === 'drill') stopDrill();
      OP.chapterId = b.dataset.study;
      await loadTree(OP.chapterId);
      renderChapters();
      studyNode(+b.dataset.node);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  //  APERTURE v3 — tre livelli: galleria · rami e percorso · studio della linea
  // ══════════════════════════════════════════════════════════════════════
  Object.assign(I18N.it, {
    l1Title: 'Le tue aperture', l1Sub: '{n} aperture · {d} carte da ripassare oggi',
    l2Sub: '{c} · {b} rami · {l} linee · {k} · {d} da ripassare oggi', l2Sub1: '{c} · 1 ramo · {l} linee · {k} · {d} da ripassare oggi',
    l2Trunk: 'Tronco comune', l2TrunkSub: '{k} · le mosse che giochi sempre, prima che i rami si dividano',
    l2Branch: 'Ramo {n}', l2Lines: '{n} linee', l2Lines1: '1 linea', l2Share: '{p}% delle partite',
    lsDue: 'da ripassare', lsNew: 'nuova', lsSeen: 'vista · drill sbloccato', lsLearned: 'imparata', lsTr: 'traspone',
    l2Moves: '{n} mosse mie', l2Moves1: '1 mossa mia', l2LineDrill: 'Drill della linea', l2AfterStudy: 'dopo lo studio',
    l2BranchDrill: 'Drill del ramo', l2AllDrill: "Tutta l'apertura", l2DrillPrev: 'le {a} di prima + {b} nuove · {k}',
    l2DrillFirst: 'tronco + questo ramo · {k}', l2Locked: 'si sblocca dopo lo studio di tutte le linee',
    l2StudyAria: 'Studia la linea {m}', l2DrillAria: 'Drill della linea {m}', l2BrDrillAria: 'Drill cumulativo fino al ramo {n}',
    l3LineOf: 'Linea {i} di {n}', l3Prev: '‹ Linea', l3Next: 'Linea ›', l3Step: 'Mossa {i} di {n}',
    l3Start: 'Inizio', l3StartSub: 'Premi → oppure «Prossima» per seguire la linea.',
    l3Mine: 'La mia mossa', l3Opp: "Risposta dell'avversario · {p}%", l3Then: 'Poi', l3NextBtn: 'Prossima',
    l3Done: 'Linea finita · vai al drill', l3MyMoves: 'mosse mie', l3Due: 'da ripassare', l3New: 'nuove',
    l3Out: 'Sei fuori dalla linea.', l3BackLine: '↩ Torna alla linea', l3PrevAria: 'Mossa precedente', l3NextAria: 'Mossa successiva',
    crumbDrill: 'Ripasso', pathAria: 'Percorso',
  });
  Object.assign(I18N.en, {
    l1Title: 'My openings', l1Sub: '{n} openings · {d} cards due today',
    l2Sub: '{c} · {b} branches · {l} lines · {k} · {d} due today', l2Sub1: '{c} · 1 branch · {l} lines · {k} · {d} due today',
    l2Trunk: 'Common trunk', l2TrunkSub: '{k} · the moves I always play, before the branches split',
    l2Branch: 'Branch {n}', l2Lines: '{n} lines', l2Lines1: '1 line', l2Share: '{p}% of games',
    lsDue: 'due', lsNew: 'new', lsSeen: 'seen · drill unlocked', lsLearned: 'learned', lsTr: 'transposes',
    l2Moves: '{n} moves of mine', l2Moves1: '1 move of mine', l2LineDrill: 'Line drill', l2AfterStudy: 'after studying',
    l2BranchDrill: 'Branch drill', l2AllDrill: 'Whole opening', l2DrillPrev: 'the previous {a} + {b} new · {k}',
    l2DrillFirst: 'trunk + this branch · {k}', l2Locked: 'unlocks once every line is studied',
    l2StudyAria: 'Study line {m}', l2DrillAria: 'Drill line {m}', l2BrDrillAria: 'Cumulative drill up to branch {n}',
    l3LineOf: 'Line {i} of {n}', l3Prev: '‹ Line', l3Next: 'Line ›', l3Step: 'Move {i} of {n}',
    l3Start: 'Start', l3StartSub: 'Press → or “Next” to follow the line.',
    l3Mine: 'My move', l3Opp: 'Opponent reply · {p}%', l3Then: 'Then', l3NextBtn: 'Next',
    l3Done: 'Line finished · go to drill', l3MyMoves: 'my moves', l3Due: 'due', l3New: 'new',
    l3Out: 'I am off the line.', l3BackLine: '↩ Back to the line', l3PrevAria: 'Previous move', l3NextAria: 'Next move',
    crumbDrill: 'Review', pathAria: 'Path',
  });

  OP.level = 1;                 // 1 galleria · 2 rami e percorso · 3 studio della linea
  OP.branchOpen = {};           // capitolo → id del ramo aperto (tutte chiuse all'ingresso)
  OP.lineLeaf = null;           // foglia della linea in studio (livello 3)
  OP.focusLine = false;

  const nCards = n => tr(n === 1 ? 'cards1' : 'cards', { n });
  const PLAY = '<svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true"><path d="M1 1 L11 7 L1 13 Z"/></svg>';

  // linee studiate (livello 3 arrivato in fondo): sbloccano il drill della linea
  // salvate nel database dell'app e legate alla posizione finale (chiave capitolo:EPD):
  // restano anche se l'albero viene aggiornato, e valgono da qualsiasi browser
  OP.studied = OP.studied || new Set();
  function studiedSet() { return OP.studied; }
  async function loadStudied() {
    // una tantum: porta nel database i segni che erano rimasti nel browser
    try {
      const old = JSON.parse(localStorage.getItem('cr_op_studied') || '[]');
      if (old.length && !localStorage.getItem('cr_op_studied_db')) {
        const items = old.map(k => { const i = k.lastIndexOf(':'); return { chapter_id: k.slice(0, i), leaf_id: +k.slice(i + 1) }; });
        await api('/api/rep/studied', { items });
        localStorage.setItem('cr_op_studied_db', '1');
      }
    } catch {}
    const d = await api('/api/rep/studied');
    OP.studied = new Set((d && d.studied) || []);
  }
  function markStudied(chId, leafId) {
    const t = tree(), leaf = t && t.nodes.get(leafId);
    if (!leaf) return;
    const k = chId + ':' + leaf.epd;
    if (OP.studied.has(k)) return;
    OP.studied.add(k);
    api('/api/rep/studied', { chapter_id: chId, epd: leaf.epd });
  }

  // mini scacchiera (galleria e card dei rami)
  function miniBoard(fen, flip) {
    const rows = String(fen).split(' ')[0].split('/');
    const cells = [];
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const c of rows[r] || '') {
        if (c >= '1' && c <= '8') { for (let k = 0; k < +c; k++) { cells.push({ d: (r + f) % 2, p: '' }); f++; } }
        else { cells.push({ d: (r + f) % 2, p: (c === c.toLowerCase() ? 'b' : 'w') + c.toLowerCase() }); f++; }
      }
    }
    if (flip) cells.reverse();
    return `<span class="mb" aria-hidden="true">` + cells.map(c => `<i class="${c.d ? 'd' : 'l'}">` +
      (c.p && PIECE_MAP[c.p] ? `<img alt="" src="/static/pieces/${PIECE_MAP[c.p]}.svg">` : '') + `</i>`).join('') + `</span>`;
  }
  function chapterFen(ch) {
    const c = new Chess();
    for (const san of (ch.root_san || [])) { if (!c.move(san)) break; }
    return c.fen();
  }

  // ── modello di un capitolo: tronco · rami · linee ─────────────────────
  const shortName = s => { if (!s) return ''; const a = String(s).split(':'); return a[a.length - 1].split(',').pop().trim(); };
  function chapterModel(t, ch) {
    let n = t.root;
    for (let i = 0; i < (ch.root_san || []).length; i++) {
      const k = kidsOf(t, n.id).find(x => x.main) || kidsOf(t, n.id)[0];
      if (!k) break;
      n = k;
    }
    // il tronco prosegue finché non c'è un bivio
    let end = n, probe = n;
    while (kidsOf(t, probe.id).length === 1) probe = kidsOf(t, probe.id)[0];
    if (kidsOf(t, probe.id).length > 1) end = probe;
    const trunk = ancestors(t, end.id);
    const trunkCards = trunk.filter(x => isCard(t, x));
    const st = studiedSet();
    const branches = kidsOf(t, end.id).map((b, bi) => {
      const leaves = [];
      (function walk(id) { const k = kidsOf(t, id); if (!k.length) leaves.push(t.nodes.get(id)); else k.forEach(c => walk(c.id)); })(b.id);
      const lines = leaves.map(leaf => {
        let s = leaf;
        while (s.id !== b.id && kidsOf(t, s.parent_id).length === 1) s = t.nodes.get(s.parent_id);
        const path = ancestors(t, leaf.id);
        const own = path.slice(path.indexOf(s)).filter(x => isCard(t, x));
        const cards = path.filter(x => isCard(t, x));
        let name = '';
        for (const x of path.slice(path.indexOf(s))) if (x.name && x.name.length > name.length) name = x.name;
        if (!name) for (const x of path) if (x.name) name = x.name;
        let state;
        if (!own.length && canonical(t, leaf).id !== leaf.id) state = 'tr';
        else {
          const ref = own.length ? own : cards;
          state = ref.every(x => cardState(x) === 'new') ? 'new' : ref.some(x => cardState(x) === 'due') ? 'due' : 'learned';
        }
        const studied = state !== 'tr' && (state !== 'new' || st.has(ch.id + ':' + leaf.epd));
        return { leaf, start: s, label: plyLabel(s), name: shortName(name), own, cards, state, studied };
      });
      const under = cardsUnder(t, b.id);
      return { node: b, idx: bi, lines, under, due: under.filter(x => cardState(x) === 'due').length,
               share: shareOf(t, b), name: shortName(b.name) };
    });
    // drill del ramo: cumulativo e progressivo
    const seen = new Set(trunkCards.map(x => x.id));
    let acc = trunkCards.slice();
    branches.forEach(b => {
      const before = acc.length;
      for (const c of b.under) if (!seen.has(c.id)) { seen.add(c.id); acc.push(c); }
      b.drill = acc.slice();
      b.drillPrev = before;
      b.drillOpen = b.lines.every(l => l.state === 'tr' || l.studied);
    });
    return { end, trunk, trunkCards, branches, lines: branches.reduce((a, b) => a + b.lines.length, 0) };
  }
  const modelNow = () => { const t = tree(), ch = curChapter(); return t && ch && ch.built ? chapterModel(t, ch) : null; };
  function findLine(M, leafId) {
    for (const b of M.branches) { const i = b.lines.findIndex(l => l.leaf.id === leafId); if (i >= 0) return { b, i, line: b.lines[i] }; }
    return null;
  }

  // ── livello 1: galleria ───────────────────────────────────────────────
  function galleryHTML() {
    const due = OP.chapters.reduce((a, c) => a + (c.due || 0), 0);
    const anyBuilt = OP.chapters.some(c => c.built);
    const grp = color => {
      const list = OP.chapters.filter(c => c.color === color);
      if (!list.length) return '';
      return `<section class="opg-grp"><div class="opg-gh"><i class="sw ${color === 'white' ? 'sw-white' : 'sw-black'}"></i>` +
        `<h2>${esc(tr(color === 'white' ? 'grpWhite' : 'grpBlack'))}</h2><span></span></div><div class="opg-grid">` +
        list.map(c => {
          const moves = (c.root_san || []).map((s, i) => (i % 2 === 0 ? (i / 2 + 1) + '.' : '') + s).join(' ');
          const tot = (c.due || 0) + (c.new || 0), learned = Math.max(0, (c.cards || 0) - tot);
          const foot = !c.built ? `<span class="opg-nb">${esc(tr('notBuiltTag'))}</span>`
            : `<span class="opg-bar"><i class="a" style="flex:${c.due || 0}"></i><i class="b" style="flex:${c.new || 0}"></i><i class="c" style="flex:${learned}"></i></span>` +
              `<span class="opg-row"><span class="opg-tags"><b class="os-pill">${esc(tr('pillToday', { n: c.due || 0 }))}</b><small>${esc(tr('newTag', { n: c.new || 0 }))}</small></span><em aria-hidden="true">→</em></span>`;
          const bm = OP.build || {};
          const merging = bm.running && bm.job === 'merge' && bm.chapter === c.name;
          const fresh = c.built && (c.new_lines > 0 || merging)
            ? `<span class="opg-new${merging ? ' run' : ''}" role="button" tabindex="0" data-a="merge" data-id="${esc(c.id)}"><i aria-hidden="true"></i>` +
              `<b>${esc(merging ? tr('mergeRun', { n: bm.nodes || 0 }) : tr(c.new_lines === 1 ? 'newLines1' : 'newLines', { n: c.new_lines }))}</b>` +
              `${merging ? '' : `<em>${esc(tr('mergeBtn'))} →</em>`}</span>` : '';
          return `<button type="button" class="opg-card${fresh ? ' has-new' : ''}" data-a="open" data-id="${esc(c.id)}">${miniBoard(chapterFen(c), color === 'black')}` +
            `<span class="opg-info"><span class="opg-tx"><b class="opg-nm">${esc(c.name)}</b><span class="opg-mv">${esc(moves)}</span></span>` +
            `${fresh}<span class="opg-ft">${foot}</span></span></button>`;
        }).join('') + `</div></section>`;
    };
    return `<div class="opg"><header class="opg-head"><div class="opg-ttl"><h1>${esc(tr('l1Title'))}</h1>` +
      `<span class="opg-sub">${esc(tr('l1Sub', { n: OP.chapters.length, d: due }))}</span></div>` +
      `<button type="button" class="opb pri" data-a="review"${anyBuilt ? '' : ' disabled'}>${esc(tr('todayAll', { n: reviewCount() }))} ${PLAY}</button></header>` +
      grp('white') + grp('black') + `</div>`;
  }

  // ── livello 2: rami e percorso ────────────────────────────────────────
  const CAP = (x, y) => `<g class="op2-cap" transform="translate(${f1(x - 18)},${f1(y - 12)})"><polygon points="18,3 34,10 18,17 2,10"/>` +
    `<path d="M9 14 v6 c0 3 18 3 18 0 v-6"/><path d="M34 10 v9"/></g>`;
  function branchPathSVG(M, b) {
    const W = 470, XL = 128, XD = 344, Y0 = 62, DY = 132;
    const lsKey = { due: 'lsDue', new: 'lsNew', learned: 'lsLearned', tr: 'lsTr' };
    let g = '', th = '';
    b.lines.forEach((l, i) => {
      const seen = l.state === 'new' && l.studied;
      const y = Y0 + i * DY, st = l.state === 'tr' ? 'new' : seen ? 'seen' : l.state;
      const meta = l.state === 'tr' ? tr('lsTr') : tr(l.cards.length === 1 ? 'l2Moves1' : 'l2Moves', { n: l.cards.length }) + ' · ' + tr(seen ? 'lsSeen' : lsKey[l.state]);
      g += tileSVG(XL, y, st, l.label, false, false, l.leaf.id, tr('l2StudyAria', { m: l.label }), { a: 'line', badge: l.state !== 'tr' });
      g += `<text class="op2-nm" x="${XL}" y="${y + 58}" text-anchor="middle">${esc(l.name || l.label)}</text>` +
           `<text class="op2-mt" x="${XL}" y="${y + 76}" text-anchor="middle">${esc(meta)}</text>`;
      if (l.state !== 'tr') {
        const dy = y + 26;
        th += `<path class="pzt-th${l.studied ? ' on' : ''}" d="M${XL + THW + 4} ${y + 12} L${XD - 44} ${dy - 6}"/>`;
        g += `<g transform="translate(${XD},${dy}) scale(.8)">` +
          tileSVG(0, 0, l.studied ? 'learned' : 'new', '', false, false, l.leaf.id, tr('l2DrillAria', { m: l.label }), { a: 'line-drill', badge: false, plain: true, extra: CAP(0, 0), cls: 'op2-dr' }) + `</g>` +
          `<text class="op2-nm sm" x="${XD}" y="${dy + 50}" text-anchor="middle">${esc(tr('l2LineDrill'))}</text>` +
          `<text class="op2-mt" x="${XD}" y="${dy + 67}" text-anchor="middle">${esc(l.studied ? nCards(l.cards.length) : tr('l2AfterStudy'))}</text>`;
      }
    });
    const yf = Y0 + b.lines.length * DY + 44, xf = W / 2, last = b.idx === M.branches.length - 1;
    const k = nCards(b.drill.length);
    const meta = !b.drillOpen ? tr('l2Locked') : b.idx === 0 ? tr('l2DrillFirst', { k }) : tr('l2DrillPrev', { a: b.drillPrev, b: b.drill.length - b.drillPrev, k });
    th += `<path class="op2-rule" d="M24 ${yf - 70} L${W - 24} ${yf - 70}"/>`;
    g += tileSVG(xf, yf, b.drillOpen ? 'learned' : 'new', 'DRILL ' + (b.idx + 1), b.drillOpen, false, b.node.id, tr('l2BrDrillAria', { n: b.idx + 1 }), { a: 'branch-drill', badge: false, plain: true, cls: 'op2-dr fin' }) +
      `<text class="op2-nm" x="${xf}" y="${yf + 58}" text-anchor="middle">${esc(last && M.branches.length > 1 ? tr('l2AllDrill') : tr('l2BranchDrill'))}</text>` +
      `<text class="op2-mt" x="${xf}" y="${yf + 76}" text-anchor="middle">${esc(meta)}</text>`;
    const H = yf + 96;
    return `<svg class="op2-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="group" aria-label="${esc(tr('pathAria'))}">${th}${g}</svg>`;
  }

  function openingHTML(ch, t) {
    const btns = (extra = '') => `<div class="opg-btns"><button type="button" class="opl" data-a="games">${esc(tr('gamesBtn'))}</button>${extra}</div>`;
    if (!ch.built || !t) {
      return `<div class="opg op2"><header class="opg-head"><div class="opg-ttl"><h1>${esc(ch.name)}</h1></div></header><div class="op2-unbuilt">${unbuiltHTML(ch)}</div></div>`;
    }
    const M = chapterModel(t, ch);
    const flip = t.color === 'black';
    const trunkTxt = M.trunk.slice(1).map((n, i) => (n.ply % 2 === 1 ? Math.ceil(n.ply / 2) + '.' : (i === 0 ? Math.ceil(n.ply / 2) + '…' : '')) + n.move_san).join(' ');
    const open = OP.branchOpen[ch.id];
    const sub = tr(M.branches.length === 1 ? 'l2Sub1' : 'l2Sub', { c: tr(ch.color), b: M.branches.length, l: M.lines, k: nCards(ch.cards || 0), d: ch.due || 0 });
    const sections = M.branches.map(b => {
      const on = open === b.node.id;
      const meta = [b.name, tr(b.lines.length === 1 ? 'l2Lines1' : 'l2Lines', { n: b.lines.length }), nCards(b.under.length), tr('l2Share', { p: b.share })].filter(Boolean).join(' · ');
      return `<section class="op2-br${on ? ' on' : ''}"><button type="button" class="op2-bh" data-a="branch" data-id="${b.node.id}" aria-expanded="${on}">` +
        miniBoard(b.node.fen, flip) +
        `<span class="op2-bt"><span class="or-k">${esc(tr('l2Branch', { n: b.idx + 1 }))}</span><b>${esc(plyLabel(b.node))}</b><span class="op2-bm">${esc(meta)}</span></span>` +
        `<b class="os-pill">${esc(tr('pillToday', { n: b.due }))}</b><em class="op2-sg" aria-hidden="true">${on ? '−' : '+'}</em></button>` +
        (on ? `<div class="op2-path">${branchPathSVG(M, b)}</div>` : '') + `</section>`;
    }).join('');
    return `<div class="opg op2"><header class="opg-head"><div class="opg-ttl"><h1>${esc(ch.name)}</h1><span class="opg-sub">${esc(sub)}</span></div>` +
      btns(`<button type="button" class="opb pri" data-a="review-ch">${esc(tr('reviewCh', { n: chapterReviewN(ch) }))} ${PLAY}</button>`) + `</header>` +
      `<div class="op2-trunk"><span class="or-k">${esc(tr('l2Trunk'))}</span><b>${esc(trunkTxt)}</b><span>${esc(tr('l2TrunkSub', { k: nCards(M.trunkCards.length) }))}</span></div>` +
      `<div class="op2-list">${sections}</div></div>`;
  }

  // ── livello 3: studio della linea ─────────────────────────────────────
  function loadLine(leafId, at = 0) {
    const t = tree();
    if (!t || !t.nodes.has(leafId)) return;
    OP.level = 3; OP.lineLeaf = leafId;
    loadPath(t, ancestors(t, leafId), at);
  }
  // da una partita: apre la linea che contiene quella posizione, già al punto giusto
  function studyNode(id) {
    const t = tree(), n = t && t.nodes.get(id);
    if (!n) { OP.level = 2; renderAll(); return; }
    let leaf = n;
    while (kidsOf(t, leaf.id).length) leaf = kidsOf(t, leaf.id)[0];
    const M = modelNow(), F = M && findLine(M, leaf.id);
    if (F) { OP.branchOpen[OP.chapterId] = F.b.node.id; loadLine(leaf.id, n.ply); }
    else { OP.level = 2; goToNode(id); }
  }
  const sanShort = n => (n.ply % 2 === 1 ? Math.ceil(n.ply / 2) + '.' : '') + n.move_san;

  function lineColHTML(t, ch) {
    const M = chapterModel(t, ch), F = findLine(M, OP.lineLeaf);
    if (!F) return '';
    const { b, i, line } = F;
    const N = OP.path.length - 1, idx = Math.min(mainIdx, N);
    const node = t.nodes.get(OP.path[idx]), next = idx < N ? t.nodes.get(OP.path[idx + 1]) : null;
    if (idx === N && !inVariation()) markStudied(ch.id, line.leaf.id);
    const head = `<div class="op3-h"><div class="op3-ht"><span class="or-k">${esc(tr('l2Branch', { n: b.idx + 1 }) + ' · ' + tr('l3LineOf', { i: i + 1, n: b.lines.length }))}</span><h1>${esc(line.name || line.label)}</h1></div>` +
      `<div class="op3-ln"><button type="button" class="opb sm" data-a="line-go" data-id="${i > 0 ? b.lines[i - 1].leaf.id : ''}"${i > 0 ? '' : ' disabled'}>${esc(tr('l3Prev'))}</button>` +
      `<button type="button" class="opb sm" data-a="line-go" data-id="${i < b.lines.length - 1 ? b.lines[i + 1].leaf.id : ''}"${i < b.lines.length - 1 ? '' : ' disabled'}>${esc(tr('l3Next'))}</button></div></div>`;
    const segs = OP.path.slice(1).map((id, k) => `<button type="button" class="op3-sg${k + 1 <= idx ? ' on' : ''}" data-a="ply" data-i="${k + 1}" aria-label="${esc(plyLabel(t.nodes.get(id)))}"><i></i></button>`).join('');
    const step = `<div class="op3-step"><div class="op3-sr"><button type="button" class="op3-ar" data-a="ply" data-i="${idx - 1}" aria-label="${esc(tr('l3PrevAria'))}"${idx > 0 ? '' : ' disabled'}>◀</button>` +
      `<span class="or-k">${esc(tr('l3Step', { i: idx, n: N }))}</span>` +
      `<button type="button" class="opb pri sm" data-a="ply" data-i="${idx + 1}"${idx < N ? '' : ' disabled'}>${esc(tr('l3NextBtn'))} ${PLAY}</button></div><div class="op3-segs">${segs}</div></div>`;
    let bodyH;
    if (inVariation()) {
      bodyH = `<div class="op3-who">${esc(tr('l3Out'))}</div><div><button type="button" class="opb" data-a="back-line">${esc(tr('l3BackLine'))}</button></div>`;
    } else if (idx === 0) {
      bodyH = `<div class="op3-big"><b>${esc(tr('l3Start'))}</b></div><div class="op3-who">${esc(tr('l3StartSub'))}</div>`;
    } else {
      const mine = isMine(t, node), card = mine ? t.nodes.get(node.parent_id) : null, cs = card ? cardState(card) : '';
      const numTxt = node.ply % 2 === 1 ? Math.ceil(node.ply / 2) + '.' : Math.ceil(node.ply / 2) + '…';
      bodyH = `<div class="op3-big"><i>${esc(numTxt)}</i><b>${esc(node.move_san)}</b></div>` +
        `<div class="op3-who">${esc(mine ? tr('l3Mine') : tr('l3Opp', { p: shareOf(t, node) }))}` +
        (cs ? ` <span class="of-chip ${cs}">${esc(tr(cs === 'due' ? 'stDueToday' : stateKey(cs)))}</span>` : '') + `</div>`;
    }
    if (!inVariation()) {
      bodyH += next ? `<div class="op3-then"><span class="or-k">${esc(tr('l3Then'))}</span><b>${esc(plyLabel(next))}</b></div>`
        : `<div><button type="button" class="opb pri" data-a="line-done">${esc(tr('l3Done'))} ${PLAY}</button></div>`;
    }
    const foot = `<div class="op3-foot"><button type="button" class="op3-fa" data-a="ply" data-i="${idx - 1}" aria-label="${esc(tr('l3PrevAria'))}"${idx > 0 ? '' : ' disabled'}>◀</button>` +
      `<span class="op3-cnt">${idx} / ${N}</span>` +
      `<button type="button" class="op3-fa" data-a="ply" data-i="${idx + 1}" aria-label="${esc(tr('l3NextAria'))}"${idx < N ? '' : ' disabled'}>▶</button></div>`;
    return `<div class="op3">${head}${step}<div class="op3-body">${bodyH}</div>${foot}</div>`;
  }

  function lineBarHTML(t) {
    const N = OP.path.length - 1, idx = Math.min(mainIdx, N);
    const chips = OP.path.slice(1).map((id, k) => {
      const n = t.nodes.get(id);
      return `<button type="button" class="op3-chip${k + 1 === idx ? ' on' : ''}${isMine(t, n) ? ' me' : ''}" data-a="ply" data-i="${k + 1}">${esc(sanShort(n))}</button>`;
    }).join('');
    return `<div class="op3-bar"><div class="op3-nav"><button type="button" class="op3-ar" data-a="ply" data-i="${idx - 1}" aria-label="${esc(tr('l3PrevAria'))}"${idx > 0 ? '' : ' disabled'}>◀</button>` +
      `<button type="button" class="op3-ar" data-a="ply" data-i="${idx + 1}" aria-label="${esc(tr('l3NextAria'))}"${idx < N ? '' : ' disabled'}>▶</button></div>` +
      `<span class="op3-cnt">${idx} / ${N}</span><div class="op3-chips" id="op3Chips">${chips}</div></div>`;
  }

  // ── percorso in alto (briciole) ───────────────────────────────────────
  function crumbsTop(games) {
    const ch = curChapter(), nm = ch ? ch.name : '';
    const l = (lv, txt) => `<button type="button" class="cr-l" data-oplv="${lv}">${esc(txt)}</button>`;
    const sep = ' <span class="cr-s">/</span> ';
    if (OP.mode === 'drill') return l(1, tr('openings')) + sep + (OP.level >= 2 && nm ? l(2, nm) + sep : '') + `<b>${esc(tr('crumbDrill'))}</b>`;
    if (games) return l(1, tr('openings')) + sep + (nm ? l(2, nm) + sep : '') + `<b>${esc(tr('gTitleShort'))}</b>`;
    if (OP.level === 1) return `<b>${esc(tr('openings'))}</b>`;
    if (OP.level === 2) return l(1, tr('openings')) + sep + `<b>${esc(nm)}</b>`;
    const M = modelNow(), F = M && findLine(M, OP.lineLeaf);
    const ln = F ? tr('l2Branch', { n: F.b.idx + 1 }) + ' · ' + (F.line.name || F.line.label) : '';
    return l(1, tr('openings')) + sep + l(2, nm) + sep + `<b>${esc(ln)}</b>`;
  }

  function applyLevel(lv) {
    const b = document.body, was = b.classList.contains('op-l1') ? 1 : b.classList.contains('op-l2') ? 2 : b.classList.contains('op-l3') ? 3 : 0;
    if (was === lv) return;
    b.classList.remove('op-l1', 'op-l2', 'op-l3');
    if (lv) b.classList.add('op-l' + lv);
    if (typeof fitBoard === 'function') fitBoard();
    if (typeof renderArrows === 'function') renderArrows();
  }

  function goLevel(n) {
    if (!OP.active) return;
    OP.level = n;
    if (n < 3) OP.focusLine = !!OP.lineLeaf;
    if (OP.mode === 'drill') { stopDrill(); return; }
    setView('explore');
    if (n === 2 && OP.chapterId) selectChapter(OP.chapterId);
    else renderAll();
  }
  OP.goLevel = goLevel;

  // disegna i livelli; ritorna false se tocca alla vista di ripasso / partite
  function renderLevels() {
    const games = OP.view === 'games' && OP.mode !== 'drill';
    const lv = OP.mode === 'explore' && !games ? OP.level : 0;
    const page = $('opPage'), side = $('opCol'), right = $('opRight'), head = $('opHead'), foot = $('opFoot');
    applyLevel(lv);
    $gameMeta.innerHTML = crumbsTop(games);
    if (!lv) { if (page) page.innerHTML = ''; if (side) side.innerHTML = ''; if (foot) foot.innerHTML = ''; return false; }
    const ch = curChapter(), t = tree();
    if (head) head.innerHTML = '';
    setHF(false);
    if (lv === 3 && ch && ch.built && t && OP.lineLeaf && t.nodes.has(OP.lineLeaf)) {
      if (page) page.innerHTML = '';
      if (right) right.innerHTML = '';
      side.innerHTML = lineColHTML(t, ch);
      if (foot) foot.innerHTML = '';
      return true;
    }
    if (lv === 3) { OP.level = 2; applyLevel(2); }
    if (side) side.innerHTML = '';
    if (foot) foot.innerHTML = '';
    if (right) right.innerHTML = '';
    if (!page) return true;
    const keep = page.scrollTop;
    page.innerHTML = OP.level === 1 || !ch ? galleryHTML() : openingHTML(ch, t);
    page.scrollTop = keep;
    if (OP.focusLine && OP.level === 2) {
      OP.focusLine = false;
      const el = page.querySelector(`[data-a="line"][data-id="${OP.lineLeaf}"]`);
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
    }
    return true;
  }

  function onLevelClick(a, el) {
    const t = tree(), ch = curChapter();
    if (a === 'merge') {
      if (OP.build && OP.build.running) return;
      if (!OP.engine) { toast(tr('mergeNoEngine')); return; }
      api('/api/rep/merge', { chapter_id: el.dataset.id }).then(r => {
        OP.build = (r && r.build) || { running: true, job: 'merge' };
        renderAll();
        pollBuild(() => renderAll());
      });
      return;
    }
    if (a === 'open') { OP.level = 2; OP.lineLeaf = null; const p = $('opPage'); if (p) p.scrollTop = 0; selectChapter(el.dataset.id); }
    else if (a === 'branch') { const id = +el.dataset.id; OP.branchOpen[OP.chapterId] = OP.branchOpen[OP.chapterId] === id ? null : id; renderAll(); }
    else if (a === 'line') loadLine(+el.dataset.id);
    else if (a === 'line-drill') {
      const M = modelNow(), F = M && findLine(M, +el.dataset.id);
      if (!F) return true;
      if (!F.line.studied) { loadLine(F.line.leaf.id); return true; }
      OP.lineLeaf = F.line.leaf.id; OP.level = 2;
      startDrill({ chapter: OP.chapterId, cards: F.line.cards.map(x => x.id) });
    }
    else if (a === 'branch-drill') {
      const M = modelNow(), b = M && M.branches.find(x => x.node.id === +el.dataset.id);
      if (!b) return true;
      if (!b.drillOpen) { toast(tr('l2Locked')); return true; }
      OP.level = 2;
      startDrill({ chapter: OP.chapterId, cards: b.drill.map(x => x.id) });
    }
    else if (a === 'ply') { const i = +el.dataset.i; if (i >= 0 && i < mainHistory.length) { if (inVariation()) $('btnBackMain') && $('btnBackMain').click(); goToIndex(i); } }
    else if (a === 'line-go') { if (el.dataset.id) loadLine(+el.dataset.id); }
    else if (a === 'back-line') { $('btnBackMain') && $('btnBackMain').click(); }
    else if (a === 'line-done') {
      const M = modelNow(), F = M && findLine(M, OP.lineLeaf);
      if (!F) return true;
      markStudied(ch.id, F.line.leaf.id);
      OP.level = 2; OP.focusLine = true;
      startDrill({ chapter: OP.chapterId, cards: F.line.cards.map(x => x.id) });
    }
    else return false;
    return true;
  }

  $('opPage') && $('opPage').addEventListener('click', onColClick);
  $('opPage') && $('opPage').addEventListener('keydown', ev => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches && ev.target.matches('[role="button"][data-a]')) { ev.preventDefault(); onColClick(ev); }
  });
  $gameMeta.addEventListener('click', ev => {
    const el = ev.target.closest('[data-oplv]');
    if (el && OP.active) goLevel(+el.dataset.oplv);
  });
  document.addEventListener('keydown', e => {
    if (!OP.active || e.key !== 'Escape') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (document.querySelector('.modal-bg.show, .modal-bg.open')) return;
    if (OP.mode === 'explore' && OP.view === 'explore' && OP.level > 1) goLevel(OP.level - 1);
  });

  // ── Piccole utilità UI ─────────────────────────────────────────────
  let toastTimer = null;
  function toast(text) {
    const el = $('opToast');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  function translateStatic() {
    document.querySelectorAll('[data-op]').forEach(el => { el.textContent = tr(el.dataset.op); });
  }
  OP.translate = () => { translateStatic(); if (OP.active) renderAll(); };

  // ── Collegamenti ───────────────────────────────────────────────────
  function wire() {
    $('opReviewBtn') && ($('opReviewBtn').onclick = () => startDrill());
    $('opGamesBtn') && ($('opGamesBtn').onclick = openGames);
    $('opBackBtn') && ($('opBackBtn').onclick = () => OP.close());
    translateStatic();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();
