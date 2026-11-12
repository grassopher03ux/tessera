'use strict';

// URL relativi: funziona sia da localhost che da 127.0.0.1 (e dall'exe)
const API    = '';
const PIECE_MAP = {
  wp: 'white_pawn',   wn: 'white_knight', wb: 'white_bishop',
  wr: 'white_rook',   wq: 'white_queen',  wk: 'white_king',
  bp: 'black_pawn',   bn: 'black_knight', bb: 'black_bishop',
  br: 'black_rook',   bq: 'black_queen',  bk: 'black_king',
};

// ── Arrow colors ───────────────────────────────────────────────────────────
const ARROW_COLORS = {
  green:  'rgba(51,46,46,.78)',    // freccia/cerchio utente (tasto destro)
  yellow: 'rgba(143,133,128,.8)',
  blue:   'rgba(88,80,77,.6)',     // Ctrl+destro
  red:    'rgba(158,148,141,.85)', // Alt+destro
};
const ENGINE_ARROW_COLOR = 'rgba(51,46,46,.72)'; // mossa migliore di Stockfish

/** Legge un colore dal tema attivo (CSS custom property), con valore di riserva. */
function cssVar(name, fallback) {
  try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; } catch { return fallback; }
}
const arrowColor = name => cssVar('--arrow-' + name, ARROW_COLORS[name] || ARROW_COLORS.green);

// ── Move classification metadata ───────────────────────────────────────────
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const MOVE_META = {
  brilliant:  { symbol: '!!' },
  great:      { symbol: '!'  },
  best:       { symbol: '★'  },
  excellent:  { symbol: '✓'  },
  inaccuracy: { symbol: '?!' },
  mistake:    { symbol: '?'  },
  blunder:    { symbol: '??' },
  book:       { symbol: 'BK' },
};

const SUMMARY_ROWS = ['brilliant', 'great', 'book', 'best', 'excellent', 'inaccuracy', 'mistake', 'blunder']
  .map(cls => ({ cls }));

// ── State ──────────────────────────────────────────────────────────────────
let mainHistory = [];   // [{fen, move}]  index 0 = start
let mainIdx     = 0;

let varHistory  = [];   // [{fen, move}]  continuation after branchIdx
let varIdx      = -1;   // -1 = not in variation
let branchIdx   = 0;

let chess     = new Chess();
let isFlipped = false;

let analysisTimer    = null;
let lastAnalysisFen  = null;
let gameEvals           = [];   // per-position evals (main line only)
let gameBestMoves       = [];   // [i] = UCI mossa migliore a mainHistory[i].fen
let gameTopMoves        = [];   // [i] = array top_moves completo a mainHistory[i].fen
let gameClassifications = [];   // [i] = classificazione della mossa che ha raggiunto mainHistory[i]
let appConfig           = {};   // config dal server (brilliant_enabled, ecc.)
let gameBookMoves       = [];   // [i] = true se la posizione mainHistory[i] è in opening book
let firstOutOfBook      = -1;   // indice prima mossa non in book (-1 = tutte in book)
let openingRequestId    = 0;    // token anti-stale per fetchOpening
let gameOpeningNames    = [];   // [i] = ultimo nome apertura raggiunto fino a mainHistory[i]
let gameNamedAt         = [];
let gameOpeningEco      = [];   // [i] = codice ECO del nome in gameOpeningNames[i]   // [i] = indice in cui quel nome è stato raggiunto
let bookInfoPromise     = Promise.resolve(); // richiesta /api/book_moves in corso

let gameAnalyzed    = false;   // analisi completa della partita disponibile (diversa dalle valutazioni live)
let analysisProgress = null;   // {done, total} mentre l'analisi completa e in corso
let engineOnline    = true;
let aiKeyOn         = false;
let lastEngineView  = null;    // {fen, moves} ultime linee del motore a schermo

let currentLang     = 'it';    // lingua corrente ('it' | 'en')
let currentPgn      = '';      // testo PGN della partita caricata
let currentGameMeta = { white: '?', black: '?', event: '', date: '', result: '*' };

// Data saved after each analysis — used by the explain button
let lastAnalysisData = null; // {fen, bestMoveSan, pvSan, evaluation}

let customDrawings  = [];
let engineArrowData = [];
let arrowDragStart  = null;
let arrowDragModifier = 'green';
let selectedSquare  = null;
let legalMoves      = [];

// ── DOM ────────────────────────────────────────────────────────────────────
const $board       = document.getElementById('board');
const $arrows      = document.getElementById('arrows');
const $evalFill    = document.getElementById('evalFill');
const $evalTop     = document.getElementById('evalLabelTop');
const $evalBot     = document.getElementById('evalLabelBot');
const $openName    = document.getElementById('openingName');
const $varBadge    = document.getElementById('varBadge');
const $btnBack     = document.getElementById('btnBackMain');
const $moveList    = document.getElementById('moveList');
const $engineLines = document.getElementById('engineLines');
const $bestBox     = document.getElementById('bestMoveBox');
const $bestSan     = document.getElementById('bestMoveSan');
const $bestEval    = document.getElementById('bestMoveEval');
const $explBox     = document.getElementById('explanationBox');
const $explText    = document.getElementById('explanationText');
const $gameMeta    = document.getElementById('gameMeta');
const $statusDot   = document.getElementById('statusDot');
const $statusText  = document.getElementById('statusText');
const $btnExplain  = document.getElementById('btnExplain');
// Coach elements exist but panel is hidden; keep refs to avoid null errors
const $coachHint   = document.getElementById('coachHint');
const $chatMessages= document.getElementById('chatMessages');
const $chatInput   = document.getElementById('chatInput');
const $btnSend     = document.getElementById('btnSend');

// ── Translations ───────────────────────────────────────────────────────────
const TRANSLATIONS = {
  it: {
    // Rail sinistra / azioni
    railGame:          'Partita',
    railOpening:       'Apertura',
    importPgn:         'Importa PGN',
    analyzeGame:       'Analizza partita',
    gamesBtn:          'Partite salvate',
    summaryBtn:        'Sintesi',
    learnBtn:          'Aperture',
    statsBtn:          'Statistiche',
    navHome: 'Home', navGame: 'Partita', navOpenings: 'Aperture', navStats: 'Stats', navArchive: 'Archivio', navPuzzle: 'Puzzle', navSettings: 'Opzioni', navSupport: 'Supporta', supTitle: 'Supporta Tessera',
    loading:           'Caricamento...',
    settingsTitle:     'Impostazioni',
    // Stato
    aiOn:              ' · AI',
    aiOff:             ' · no AI',
    statusOnline:      'Stockfish · D{depth} · {n} aperture{ai}',
    stockfishOffline:  'Stockfish offline',
    stockfishError:    'Stockfish: {error}',
    serverOffline:     'Server offline',
    openaiDetected:    'OpenAI API key rilevata dall\'ambiente',
    openaiMissing:     'OpenAI non configurata — aggiungi OPENAI_API_KEY nel file .env',
    // Apertura
    theoryUntil:       'Teoria fino a {move}',
    inTheory:          'In teoria',
    // Scacchiera / HUD
    variationBadge:    'VARIANTE',
    backToMain:        '↩ Linea principale',
    boardHint:         'Clic: muovi · Destro: frecce · Esc: cancella',
    startPosition:     'Posizione iniziale',
    varFrom:           'Variante da {n}',
    outOfBook:         'Fuori teoria',
    theoryGroup:       'Teoria',
    whitePlayedOpening:'Il Bianco ha giocato la {name}',
    blackPlayedOpening:'Il Nero ha giocato la {name}',
    hudPos:            'Posizione <b>{i}</b> / {n}',
    hudTurn:           'Tratto <b>{side}</b>',
    white:             'Bianco',
    black:             'Nero',
    hudEval:           'Eval <b>{ev}</b>',
    hudDepth:          'Depth <b>{d}</b> · 3 linee',
    // Controlli
    ctrlStart:         'Inizio',
    ctrlPrev:          'Precedente (←)',
    ctrlNext:          'Successivo (→)',
    ctrlEnd:           'Fine',
    ctrlFlip:          'Ruota (F)',
    ctrlClear:         'Cancella frecce (Esc)',
    // Inspector motore
    engineTitle:       'Analisi Stockfish',
    tileEval:          'Valutazione',
    tileMove:          'Mossa giocata',
    tileAccW:          'Accuratezza bianco',
    tileAccB:          'Accuratezza nero',
    bestMoveLabel:     'Mossa migliore',
    linesTitle:        'Linee del motore',
    explainTitle:      'Commento',
    explainBtn:        'Spiega la mossa',
    explainLoading:    'Commento in corso…',
    explainBtnTitle:   'Commento OpenAI su questa posizione',
    enginePlaceholder: 'Naviga la partita per l\'analisi',
    analyzing:         'Analisi in corso…',
    engineError:       'Errore engine',
    serverUnreachable: 'Server non raggiungibile',
    noMoves:           'Nessuna mossa disponibile',
    movesTitle:        'Mosse',
    // Timeline
    graphWhite:        'Bianco',
    graphBlack:        'Nero',
    graphEmpty:        'Analizza la partita per vedere il grafico della valutazione',
    noGame:            'Nessuna partita',
    // Classificazioni
    cls_brilliant:     'Brillante',
    cls_great:         'Grande',
    cls_book:          'Teoria',
    cls_best:          'Migliore',
    cls_excellent:     'Ottima',
    cls_inaccuracy:    'Imprecisione',
    cls_mistake:       'Errore',
    cls_blunder:       'Errore grave',
    // Import
    importTitle:       'Importa PGN',
    openFile:          'Apri file .pgn',
    loadBtn:           'Carica',
    pgnPlaceholder:    'Incolla il PGN qui...\n\n[Event "..."]\n[White "..."]\n...\n\n1. e4 e5 2. Nf3 ...',
    insertPgn:         'Inserisci un PGN.',
    // Impostazioni
    sfPathLabel:       'Percorso Stockfish',
    setBtn:            'Imposta',
    openaiKeyLabel:    'OpenAI API Key',
    envVarHint:        '(variabile d\'ambiente)',
    openaiInstructions:'Crea un file <code>.env</code> accanto a <code>server.py</code> con:<br><code>OPENAI_API_KEY=sk-...</code><br>Serve per "Spiega la mossa". L\'analisi Stockfish funziona senza.',
    insertPath:        'Inserisci un percorso.',
    sfConfigured:      'Stockfish configurato.',
    errorGeneric:      'Errore.',
    serverUnreach:     'Server non raggiungibile.',
    analyzingTitle:    'Analisi in corso',
    // Archivio
    gamesEmpty:        'Nessuna partita salvata.',
    gamesLoad:         'Carica',
    gamesDelete:       'Elimina',
    gamesConfirmDel:   'Eliminare questa partita? L\'operazione non è reversibile.',
    fromCache:         'da cache',
    // Impara
    summaryTitle:      'Sintesi della partita',
    flipBtn:           'Ruota',
    clearBtn:          'Frecce ✕',
    ctrlSound:         'Suoni mosse on/off (M)',
    ctrlZoom:          'Ingrandisci',
    ctrlZoomOut:       'Riduci',
  },
  en: {
    railGame:          'Game',
    railOpening:       'Opening',
    importPgn:         'Import PGN',
    analyzeGame:       'Analyze game',
    gamesBtn:          'Saved games',
    summaryBtn:        'Summary',
    learnBtn:          'Openings',
    statsBtn:          'Statistics',
    navHome: 'Home', navGame: 'Game', navOpenings: 'Openings', navStats: 'Stats', navArchive: 'Archive', navPuzzle: 'Puzzle', navSettings: 'Settings', navSupport: 'Support', supTitle: 'Support Tessera',
    loading:           'Loading...',
    settingsTitle:     'Settings',
    aiOn:              ' · AI',
    aiOff:             ' · no AI',
    statusOnline:      'Stockfish · D{depth} · {n} openings{ai}',
    stockfishOffline:  'Stockfish offline',
    stockfishError:    'Stockfish: {error}',
    serverOffline:     'Server offline',
    openaiDetected:    'OpenAI API key detected from environment',
    openaiMissing:     'OpenAI not configured — add OPENAI_API_KEY to .env file',
    theoryUntil:       'Theory until {move}',
    inTheory:          'In theory',
    variationBadge:    'VARIATION',
    backToMain:        '↩ Main line',
    boardHint:         'Click: move · Right: arrows · Esc: clear',
    startPosition:     'Starting position',
    varFrom:           'Variation from {n}',
    outOfBook:         'Out of theory',
    theoryGroup:       'Theory',
    whitePlayedOpening:'White played the {name}',
    blackPlayedOpening:'Black played the {name}',
    hudPos:            'Position <b>{i}</b> / {n}',
    hudTurn:           '<b>{side}</b> to move',
    white:             'White',
    black:             'Black',
    hudEval:           'Eval <b>{ev}</b>',
    hudDepth:          'Depth <b>{d}</b> · 3 lines',
    ctrlStart:         'Start',
    ctrlPrev:          'Previous (←)',
    ctrlNext:          'Next (→)',
    ctrlEnd:           'End',
    ctrlFlip:          'Flip (F)',
    ctrlClear:         'Clear arrows (Esc)',
    engineTitle:       'Stockfish analysis',
    tileEval:          'Evaluation',
    tileMove:          'Move played',
    tileAccW:          'White accuracy',
    tileAccB:          'Black accuracy',
    bestMoveLabel:     'Best move',
    linesTitle:        'Engine lines',
    explainTitle:      'Comment',
    explainBtn:        'Explain the move',
    explainLoading:    'Commenting…',
    explainBtnTitle:   'OpenAI comment on this position',
    enginePlaceholder: 'Navigate the game for analysis',
    analyzing:         'Analyzing…',
    engineError:       'Engine error',
    serverUnreachable: 'Server unreachable',
    noMoves:           'No moves available',
    movesTitle:        'Moves',
    graphWhite:        'White',
    graphBlack:        'Black',
    graphEmpty:        'Analyze the game to see the evaluation graph',
    noGame:            'No game',
    cls_brilliant:     'Brilliant',
    cls_great:         'Great',
    cls_book:          'Book',
    cls_best:          'Best',
    cls_excellent:     'Excellent',
    cls_inaccuracy:    'Inaccuracy',
    cls_mistake:       'Mistake',
    cls_blunder:       'Blunder',
    importTitle:       'Import PGN',
    openFile:          'Open .pgn file',
    loadBtn:           'Load',
    pgnPlaceholder:    'Paste PGN here...\n\n[Event "..."]\n[White "..."]\n...\n\n1. e4 e5 2. Nf3 ...',
    insertPgn:         'Please enter a PGN.',
    sfPathLabel:       'Stockfish path',
    setBtn:            'Set',
    openaiKeyLabel:    'OpenAI API Key',
    envVarHint:        '(environment variable)',
    openaiInstructions:'Create a <code>.env</code> file next to <code>server.py</code> with:<br><code>OPENAI_API_KEY=sk-...</code><br>Required for "Explain the move". Stockfish analysis works without it.',
    insertPath:        'Please enter a path.',
    sfConfigured:      'Stockfish configured.',
    errorGeneric:      'Error.',
    serverUnreach:     'Server unreachable.',
    analyzingTitle:    'Analyzing',
    gamesEmpty:        'No saved games.',
    gamesLoad:         'Load',
    gamesDelete:       'Delete',
    gamesConfirmDel:   'Delete this game? This cannot be undone.',
    fromCache:         'from cache',
    summaryTitle:      'Game summary',
    flipBtn:           'Flip',
    clearBtn:          'Arrows ✕',
    ctrlSound:         'Move sounds on/off (M)',
    ctrlZoom:          'Enlarge',
    ctrlZoomOut:       'Shrink',
  },
};

/** Restituisce la stringa tradotta. Sostituisce {key} con i valori di vars. */
function t(key, vars = {}) {
  const map = TRANSLATIONS[currentLang] ?? TRANSLATIONS.it;
  let str   = map[key] ?? TRANSLATIONS.it[key] ?? key;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)), str
  );
}

/** Aggiorna tutti gli elementi data-i18n / data-i18n-title / data-i18n-placeholder. */
function translateDOM() {
  // Testo (innerHTML per supportare tag come <code>, <br>)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  // Attributo title
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  // Attributo placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
}

/** Cambia lingua, persiste in localStorage, ri-renderizza la UI. */
function setLanguage(lang) {
  currentLang = lang;
  try { localStorage.setItem('cr_lang', lang); } catch {}
  const btn = document.getElementById('langBtn');
  if (btn) btn.textContent = lang.toUpperCase();
  translateDOM();
  if (window.updateZoomBtn) window.updateZoomBtn();
  // Elementi gestiti dinamicamente dal JS (non coperti da data-i18n)
  updateOpeningBar(mainIdx);
  if (!lastAnalysisFen) {
    $engineLines.innerHTML =
      `<div class="engine-placeholder">${t('enginePlaceholder')}</div>`;
  }
  if ($btnExplain && !$btnExplain.disabled) {
    $btnExplain.textContent = t('explainBtn');
  }
  renderMoveList();
  updateHud();
  updateTiles();
  if (window.OP) OP.translate();
  if (window.ST) ST.translate();
  if (window.AR) AR.translate();
  if (window.HM) HM.translate();
  if (window.PL) PL.translate();
  if (window.PZ) PZ.translate();
  if (window.GM) GM.render();
  pollStatus();
}

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  // Ripristina lingua salvata
  try {
    const saved = localStorage.getItem('cr_lang');
    if (saved === 'it' || saved === 'en') currentLang = saved;
  } catch {}
  const langBtn = document.getElementById('langBtn');
  if (langBtn) {
    langBtn.textContent = currentLang.toUpperCase();
    langBtn.addEventListener('click', () =>
      setLanguage(currentLang === 'it' ? 'en' : 'it')
    );
  }

  // Tema: "Lattice" (base, carta e inchiostro) ↔ "Night" (palette del reel a colori)
  const skinBtn = document.getElementById('skinBtn');
  if (skinBtn) {
    const applySkin = (night) => {
      if (night) document.documentElement.dataset.theme = 'night';
      else delete document.documentElement.dataset.theme;
      document.getElementById('skinLabel').textContent = night ? 'Night' : 'Lattice';
      skinBtn.setAttribute('aria-pressed', night ? 'true' : 'false');
      try { localStorage.setItem('cr_skin', night ? 'night' : 'lattice'); } catch {}
      renderArrows();                                   // frecce e grafici rileggono i colori del tema
      if (window.ST && ST.active && ST.rerender) ST.rerender();
    };
    applySkin(document.documentElement.dataset.theme === 'night');
    skinBtn.addEventListener('click', () => {
      document.documentElement.classList.add('skin-anim');
      applySkin(document.documentElement.dataset.theme !== 'night');
      setTimeout(() => document.documentElement.classList.remove('skin-anim'), 450);
    });
  }

  translateDOM();
  SFX.updateButton();
  buildLabels();
  renderBoard();
  setupEvents();
  pollStatus();
  setInterval(pollStatus, 8000);
  // Ricalcola frecce se la finestra viene ridimensionata
  window.addEventListener('resize', () => { renderArrows(); });
}


// ── Status ─────────────────────────────────────────────────────────────────
async function pollStatus() {
  try {
    const d = await (await fetch(`${API}/api/status`)).json();

    engineOnline = !!d.engine; aiKeyOn = !!d.openai_key;
    if (window.AR) AR.setStatus(d);
    document.body.classList.toggle('eng-off', !engineOnline);
    if (window.GM) GM.render();
    if (d.engine) {
      $statusDot.className = 'status-dot online';
      const aiLabel = d.openai_key ? t('aiOn') : t('aiOff');
      $statusText.textContent = t('statusOnline',
        { depth: d.depth || 16, n: d.openings, ai: aiLabel });
    } else {
      $statusDot.className = 'status-dot offline';
      $statusText.textContent = d.engine_error
        ? t('stockfishError', { error: d.engine_error })
        : t('stockfishOffline');
    }

    const dd = document.getElementById('depthDisplay');
    if (dd) dd.textContent = d.engine ? 'D' + (d.depth || 16) : '';
    appConfig.depth = d.depth || 16;
    const es = document.getElementById('explainStatus');
    if (es) es.textContent = d.openai_key ? 'OpenAI' : 'offline';
    if (d.stockfish_path) document.getElementById('sfPath').value = d.stockfish_path;
    appConfig.brilliant_enabled = d.brilliant_enabled ?? false;

    // OpenAI key status bar in settings
    const bar = document.getElementById('keyStatusBar');
    if (bar) {
      if (d.openai_key) {
        bar.className = 'key-status-bar ok';
        bar.style.display = '';
        bar.innerHTML = t('openaiDetected');
      } else {
        bar.style.display = 'none';
      }
    }

    // Titolo del bottone Spiega
    if ($btnExplain) {
      $btnExplain.title = d.openai_key
        ? t('explainBtnTitle')
        : t('openaiMissing');
    }

  } catch {
    $statusDot.className = 'status-dot offline';
    $statusText.textContent = t('serverOffline');
  }
}

// ── Board coordinates ──────────────────────────────────────────────────────
function buildLabels() {
  const ranks = document.getElementById('rankLabels');
  const files = document.getElementById('fileLabels');
  ranks.innerHTML = files.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const r = document.createElement('span');
    r.textContent = isFlipped ? i + 1 : 8 - i;
    ranks.appendChild(r);
  }
  for (let i = 0; i < 8; i++) {
    const f = document.createElement('span');
    f.textContent = isFlipped ? 'hgfedcba'[i] : 'abcdefgh'[i];
    files.appendChild(f);
  }
  updatePlayerStrips();   // i nomi girano con la scacchiera
}

/**
 * Strisce giocatore sopra/sotto la scacchiera: nome (elo) + precisione.
 * Il giocatore in basso è quello che sta "in basso" sulla scacchiera,
 * quindi con Ruota le due strisce si scambiano.
 */
function updatePlayerStrips() {
  if (window.PZ && PZ.active) { PZ.strips(); return; }
  const fmt = (name, elo) => {
    const n = (name && name !== '?') ? name : '—';
    return escHtml(n) + ((elo && elo !== '?' && elo !== '0') ? `<span class="elo">${escHtml(elo)}</span>` : '');
  };
  const meta = (typeof currentGameMeta !== 'undefined' && currentGameMeta) || {};
  let accW = null, accB = null;
  if (typeof gameEvals !== 'undefined' && gameEvals.some(e => e) && mainHistory.length > 2) {
    const acc = gameAccuracy();
    accW = acc.w; accB = acc.b;
  }
  const white = { side: 'white', name: fmt(meta.white, meta.whiteElo), acc: accW };
  const black = { side: 'black', name: fmt(meta.black, meta.blackElo), acc: accB };
  const top = isFlipped ? white : black;
  const bot = isFlipped ? black : white;
  const paint = (p, sw, nm, ac) => {
    const swEl = document.getElementById(sw), nmEl = document.getElementById(nm), acEl = document.getElementById(ac);
    if (!swEl || !nmEl || !acEl) return;
    swEl.className = 'sw sw-' + p.side;
    nmEl.innerHTML = p.name;
    if (p.acc !== null && p.acc !== undefined) {
      acEl.hidden = false;
      acEl.textContent = p.acc + '%';
      acEl.title = t(p.side === 'white' ? 'tileAccW' : 'tileAccB');
    } else {
      acEl.hidden = true;
    }
  };
  paint(top, 'swTop', 'nameTop', 'accTop');
  paint(bot, 'swBot', 'nameBot', 'accBot');
  paintCaptured(top, 'capTop');
  paintCaptured(bot, 'capBot');
}

// ── Pezzi mangiati: cronologia completa di ciò che ogni giocatore ha preso, + vantaggio di materiale (+N) ──
const CAP_ORDER = ['p', 'n', 'b', 'r', 'q'];

/** Pezzi mangiati da ciascun colore (per tipo) e differenza di materiale sulla scacchiera (bianco − nero). */
function capturedState() {
  const moves = [];
  if (inVariation()) {
    for (let i = 1; i <= branchIdx; i++) moves.push(mainHistory[i]?.move);
    for (let i = 1; i <= varIdx; i++) moves.push(varHistory[i]?.move);
  } else {
    for (let i = 1; i <= mainIdx; i++) moves.push(mainHistory[i]?.move);
  }
  const taken = { w: {}, b: {} };            // pezzi mangiati DA bianco / DA nero
  for (const mv of moves) {
    if (mv && mv.captured) taken[mv.color][mv.captured] = (taken[mv.color][mv.captured] || 0) + 1;
  }
  // materiale dalla posizione corrente (gestisce promozioni e partenze da FEN)
  let mat = { w: 0, b: 0 };
  for (const ch of currentFen().split(' ')[0]) {
    const lc = ch.toLowerCase();
    if (PIECE_VALUES[lc]) mat[ch === lc ? 'b' : 'w'] += PIECE_VALUES[lc];
  }
  return { taken, diff: mat.w - mat.b };
}

function paintCaptured(p, capId) {
  const el = document.getElementById(capId);
  if (!el) return;
  const { taken, diff } = capturedState();
  const side = p.side === 'white' ? 'w' : 'b';
  const victim = side === 'w' ? 'b' : 'w';   // i pezzi mangiati dal bianco sono neri e viceversa
  let html = '';
  for (const k of CAP_ORDER) {
    const n = taken[side][k] || 0;
    if (!n) continue;
    html += '<span class="cap-g">' + `<img alt="" src="/static/pieces/${PIECE_MAP[victim + k]}.svg">`.repeat(n) + '</span>';
  }
  const lead = side === 'w' ? diff : -diff;
  if (lead > 0) html += `<b class="cap-adv">+${lead}</b>`;
  if (el.dataset.k !== html) { el.innerHTML = html; el.dataset.k = html; }
}

// ── Board rendering ────────────────────────────────────────────────────────
function renderBoard() {
  if (window.PZ && PZ.active) { PZ.render(arguments[0]); return; }   // modulo puzzle: disegna lui
  $board.innerHTML = '';
  const currentHistory = inVariation() ? varHistory : mainHistory;
  const currentPos     = inVariation() ? varIdx     : mainIdx;
  const lastMove = currentPos > 0 ? currentHistory[currentPos].move : null;

  fitBoard();
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const fileIdx = isFlipped ? 7 - col : col;
      const rankIdx = isFlipped ? row : 7 - row;
      const sq      = 'abcdefgh'[fileIdx] + (rankIdx + 1);
      const isLight = (fileIdx + rankIdx) % 2 === 1;

      const div = document.createElement('div');
      div.className = 'square ' + (isLight ? 'light' : 'dark');
      div.dataset.sq = sq;

      if (lastMove) {
        if (sq === lastMove.from) div.classList.add('last-from');
        if (sq === lastMove.to)   div.classList.add('last-to');
      }
      if (sq === selectedSquare) div.classList.add('selected');

      const piece = chess.get(sq);
      if (piece) {
        div.classList.add('has-piece');
        const img = document.createElement('img');
        img.className = 'piece' + (piece.type === 'p' ? ' piece-pawn' : '');
        img.src = '/static/pieces/' + PIECE_MAP[piece.color + piece.type] + '.svg';
        img.draggable = false;
        div.appendChild(img);
      }

      if (legalMoves.find(m => m.to === sq)) {
        div.classList.add('legal-dest');
      }

      div.addEventListener('click', () => onSquareClick(sq));
      $board.appendChild(div);
    }
  }

  renderArrows();
  renderMoveBadge();
  updateVariationUI();
  updateHud();
}

/**
 * Badge di classificazione sul pezzo appena mosso (angolo in alto a destra
 * della casa d'arrivo). Vive in un layer sopra board e frecce, quindi può
 * sporgere dalla casa come su chess.com. Mostra SOLO la mossa corrente:
 * appena si cambia posizione viene sostituito o rimosso.
 */
function renderMoveBadge() {
  const fx = document.getElementById('boardFx');
  if (!fx) return;
  const mv  = !inVariation() && mainIdx > 0 ? mainHistory[mainIdx]?.move : null;
  const cls = mv ? gameClassifications[mainIdx] : null;
  if (!mv || !cls || !NOTABLE.has(cls)) { fx.innerHTML = ''; fx.dataset.key = ''; return; }

  const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sq')) || 64;
  // Niente ri-animazione se nulla è cambiato (es. selezione di un pezzo)
  const key = [mainIdx, cls, isFlipped, s].join('|');
  if (fx.dataset.key === key && fx.firstChild) return;
  fx.dataset.key = key;

  const file = 'abcdefgh'.indexOf(mv.to[0]);
  const rank = parseInt(mv.to[1], 10) - 1;
  const col  = isFlipped ? 7 - file : file;
  const row  = isFlipped ? rank : 7 - rank;
  const size = Math.round(s * 0.4);              // cerchio = 40% della casa
  const B = 1;                                   // bordo di .chess-board
  const x = B + (col + 1) * s + s * 0.14 - size; // top -14% / right -14% della casa d'arrivo
  const y = B + row * s - s * 0.14;

  fx.innerHTML =
    `<div class="move-badge" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px;font-size:${Math.round(size * 0.44)}px">` +
    clsBadge(cls) + `</div>`;
}

function inVariation() { return varIdx >= 0; }

function currentFen() {
  if (inVariation()) return varHistory[varIdx].fen;
  return mainHistory[mainIdx] ? mainHistory[mainIdx].fen : new Chess().fen();
}

// ── Square click ───────────────────────────────────────────────────────────
function onSquareClick(sq) {
  if (window.OP && OP.onSquareClick(sq)) return;   // modulo aperture: ripasso in corso
  if (!selectedSquare) {
    const piece = chess.get(sq);
    if (!piece || piece.color !== chess.turn()) return;
    selectedSquare = sq;
    legalMoves = chess.moves({ square: sq, verbose: true });
    renderBoard();
  } else {
    if (sq === selectedSquare) {
      selectedSquare = null; legalMoves = []; renderBoard(); return;
    }
    const mv = legalMoves.find(m => m.to === sq);
    if (mv) {
      const fromSq = selectedSquare;
      const prom   = mv.flags.includes('p') ? 'q' : undefined;
      selectedSquare = null; legalMoves = [];
      applyMove(fromSq, sq, prom);
    } else {
      const piece = chess.get(sq);
      if (piece && piece.color === chess.turn()) {
        selectedSquare = sq;
        legalMoves = chess.moves({ square: sq, verbose: true });
        renderBoard();
      } else {
        selectedSquare = null; legalMoves = []; renderBoard();
      }
    }
  }
}

// ── Apply a move ───────────────────────────────────────────────────────────
function applyMove(from, to, promotion = 'q') {
  if (window.OP && OP.interceptMove(from, to, promotion)) return;
  const result = chess.move({ from, to, promotion });
  if (!result) return;

  if (!inVariation()) {
    const next = mainHistory[mainIdx + 1];
    if (next && next.move && next.move.from === from && next.move.to === to) {
      chess.undo();
      goToIndex(mainIdx + 1, { sound: true });
      return;
    }
    branchIdx  = mainIdx;
    varHistory = [{ fen: currentFen(), move: null }];
    varIdx     = 0;
  }

  const newFen  = chess.fen();
  const trimIdx = varIdx + 1;
  varHistory    = varHistory.slice(0, trimIdx);
  varHistory.push({ fen: newFen, move: result });
  varIdx = varHistory.length - 1;

  SFX.playMove(result);
  renderBoard();
  renderMoveList();
  scheduleAnalysis();
  fetchOpening(newFen);
}

// ── Navigation ─────────────────────────────────────────────────────────────
// opts.sound: true = suona sempre, false = mai, assente = solo passo in avanti
function goToIndex(idx, opts = {}) {
  idx    = Math.max(0, Math.min(idx, mainHistory.length - 1));
  const prevIdx = inVariation() ? -1 : mainIdx;
  mainIdx = idx;
  varIdx  = -1;
  varHistory  = [];
  selectedSquare = null;
  legalMoves     = [];

  chess.load(mainHistory[idx].fen);
  const wantSound = opts.sound ?? (idx === prevIdx + 1);
  if (wantSound && idx !== prevIdx) SFX.playMove(mainHistory[idx].move);
  renderBoard();
  renderMoveList();
  updateEvalBar(gameEvals[idx]);
  updateOpeningBar(idx);
  scheduleAnalysis();
  if (window.OP) OP.onNavigate();

  const active = $moveList.querySelector('.move-btn.active');
  if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function goVarIndex(idx) {
  idx = Math.max(0, Math.min(idx, varHistory.length - 1));
  if (idx === 0) { returnToMainLine(); return; }
  if (idx === varIdx + 1) SFX.playMove(varHistory[idx].move);
  varIdx = idx;
  chess.load(varHistory[idx].fen);
  renderBoard();
  renderMoveList();
  scheduleAnalysis();
  fetchOpening(varHistory[idx].fen);
}

function returnToMainLine() {
  varIdx    = -1;
  varHistory = [];
  chess.load(mainHistory[branchIdx].fen);
  mainIdx = branchIdx;
  renderBoard();
  renderMoveList();
  updateEvalBar(gameEvals[mainIdx]);
  scheduleAnalysis();
  updateOpeningBar(mainIdx);
}

function navigatePrev() {
  if (inVariation()) {
    if (varIdx > 1) goVarIndex(varIdx - 1); else returnToMainLine();
  } else { goToIndex(mainIdx - 1); }
}

function navigateNext() {
  if (inVariation()) {
    if (varIdx < varHistory.length - 1) goVarIndex(varIdx + 1);
  } else { goToIndex(mainIdx + 1); }
}

document.getElementById('btnStart').onclick = () => { if (inVariation()) returnToMainLine(); goToIndex(0); };
document.getElementById('btnPrev').onclick  = navigatePrev;
document.getElementById('btnNext').onclick  = navigateNext;
document.getElementById('btnEnd').onclick   = () => {
  if (inVariation()) goVarIndex(varHistory.length - 1);
  else goToIndex(mainHistory.length - 1, { sound: true });
};
document.getElementById('btnFlip').onclick  = () => { isFlipped = !isFlipped; buildLabels(); renderBoard(); };
document.getElementById('btnClearDrawings').onclick = clearCustomDrawings;
document.getElementById('btnBackMain').onclick      = returnToMainLine;
document.getElementById('btnSound').onclick         = () => SFX.toggle();

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (window.PZ && PZ.active) return;            // puzzle: le frecce non scorrono la partita sotto
  if (e.key === 'ArrowLeft')  { e.preventDefault(); navigatePrev(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); navigateNext(); }
  if (e.key === 'ArrowUp')    { e.preventDefault(); if (inVariation()) returnToMainLine(); goToIndex(0); }
  if (e.key === 'ArrowDown')  { e.preventDefault(); goToIndex(mainHistory.length - 1, { sound: true }); }
  if (e.key === 'f' || e.key === 'F') { isFlipped = !isFlipped; buildLabels(); renderBoard(); }
  if (e.key === 'm' || e.key === 'M') SFX.toggle();
  if (e.key === 'Escape') clearCustomDrawings();
});

// ── Variation UI ───────────────────────────────────────────────────────────
function updateVariationUI() {
  const inVar = inVariation();
  $varBadge.style.display = inVar ? '' : 'none';
  $btnBack.style.display  = inVar ? '' : 'none';
}

// ── Move List ──────────────────────────────────────────────────────────────
function renderMoveList() {
  $moveList.innerHTML = '';
  const mc = document.getElementById('moveCount');
  if (mc) mc.textContent = mainHistory.length > 1 ? String(Math.ceil((mainHistory.length - 1) / 2)) : '';
  renderEvalGraph();
  updateTiles();
  if (window.GM) GM.render();
  if (mainHistory.length <= 1) {
    $moveList.innerHTML = `<div class="engine-placeholder">${t('noGame')}</div>`;
    return;
  }

  // Gruppi come l'object explorer di Lattice: TEORIA / FUORI TEORIA
  const outOfBookPairStart = firstOutOfBook === -1 ? -1
    : (firstOutOfBook % 2 === 1 ? firstOutOfBook : firstOutOfBook - 1);
  const hasBook = gameBookMoves[1] === true;
  const groupHead = (label, kind, count) => {
    const g = document.createElement('div');
    g.className = 'group ' + kind;
    g.innerHTML = `<i></i>${escHtml(label)}${count ? ' · ' + count : ''}`;
    $moveList.appendChild(g);
  };
  if (hasBook) {
    const nBook = firstOutOfBook === -1 ? mainHistory.length - 1 : firstOutOfBook - 1;
    groupHead(t('theoryGroup'), 'book', nBook);
  }

  for (let i = 1; i < mainHistory.length; i += 2) {
    if (firstOutOfBook !== -1 && i === outOfBookPairStart && hasBook) {
      groupHead(t('outOfBook'), 'out', mainHistory.length - firstOutOfBook);
    }

    const pair = document.createElement('div');
    pair.className = 'move-pair';

    const num = document.createElement('span');
    num.className = 'move-num';
    num.textContent = String(Math.ceil(i / 2)).padStart(2, '0');
    pair.appendChild(num);

    pair.appendChild(makeMainMoveBtn(i));
    if (i + 1 < mainHistory.length) pair.appendChild(makeMainMoveBtn(i + 1));
    else pair.appendChild(document.createElement('span'));

    $moveList.appendChild(pair);
  }

  if (inVariation() && varHistory.length > 1) {
    const section  = document.createElement('div');
    section.className = 'var-section';

    const label = document.createElement('div');
    label.className   = 'var-label';
    label.textContent = t('varFrom', { n: moveLabel(branchIdx) || t('startPosition') });
    section.appendChild(label);

    const movesDiv = document.createElement('div');
    movesDiv.className = 'var-moves';

    for (let i = 1; i < varHistory.length; i++) {
      const mv = varHistory[i].move;
      if (!mv) continue;
      const isWhiteTurn = (branchIdx + i) % 2 === 1;
      if (isWhiteTurn || i === 1) {
        const numSpan = document.createElement('span');
        const n = Math.ceil((branchIdx + i) / 2);
        numSpan.textContent = isWhiteTurn ? n + '.' : n + '…';
        movesDiv.appendChild(numSpan);
      }
      const btn = document.createElement('button');
      btn.className   = 'var-move-btn' + (i === varIdx ? ' active' : '');
      btn.textContent = mv.san;
      btn.onclick     = () => goVarIndex(i);
      movesDiv.appendChild(btn);
    }

    section.appendChild(movesDiv);
    $moveList.appendChild(section);
    setTimeout(() => section.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
  }
}

function makeMainMoveBtn(idx) {
  const mv  = mainHistory[idx].move;
  const cls = gameClassifications[idx] || null;

  const btn = document.createElement('button');
  btn.className = 'move-btn' + (!inVariation() && idx === mainIdx ? ' active' : '');
  if (cls) btn.classList.add(cls);
  if (gameBookMoves[idx]) btn.classList.add('book');

  const sanSpan = document.createElement('span');
  sanSpan.textContent = mv ? mv.san : '';
  btn.appendChild(sanSpan);

  if (cls && MOVE_META[cls]) btn.insertAdjacentHTML('beforeend', clsBadge(cls));
  if (cls) btn.title = t('cls_' + cls);

  btn.onclick = () => goToIndex(idx, { sound: true });
  return btn;
}

// ── Move classification ────────────────────────────────────────────────────
//
// Modello "probabilità di vittoria" (lo stesso di lichess): perdere 50cp a
// parità è grave, perderli a +8 è irrilevante. Tutte le soglie sono in punti
// percentuali di probabilità di vittoria di chi ha mosso.

const WIN_THRESHOLDS = { inaccuracy: 5, mistake: 10, blunder: 15 }; // come lichess
const EXCELLENT_MAX_LOSS = 2;    // entro il 2% → "Ottima"
const GREAT_MIN_GAP      = 10;   // la 2ª linea è peggio di almeno 10% → mossa unica
const SAC_MIN_MATERIAL   = 2;    // sacrificio = almeno 2 punti di materiale in presa
const SEE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** Probabilità di vittoria del BIANCO (0–100) da una valutazione {type, value}. */
function winPctWhite(ev, fen) {
  if (!ev) return null;
  if (ev.type === 'mate') {
    if (ev.value > 0) return 100;
    if (ev.value < 0) return 0;
    // mate 0 → chi ha il tratto è già matto
    return fen && fen.split(' ')[1] === 'w' ? 0 : 100;
  }
  if (ev.value == null) return null;
  const cp = Math.max(-1000, Math.min(1000, ev.value));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Probabilità di vittoria dal punto di vista del colore 'w' | 'b'. */
function winPctFor(color, ev, fen) {
  const w = winPctWhite(ev, fen);
  if (w === null) return null;
  return color === 'w' ? w : 100 - w;
}

function topMoveEval(m) {
  if (!m) return null;
  if (m.Mate != null) return { type: 'mate', value: m.Mate };
  if (m.Centipawn != null) return { type: 'cp', value: m.Centipawn };
  return null;
}

/**
 * Static Exchange Evaluation: quanto materiale guadagna il lato al tratto
 * catturando su `sq` e continuando lo scambio nel modo migliore (≥ 0).
 * Usa solo mosse legali, quindi inchiodature e raggi X sono gestiti.
 */
function seeGain(board, sq) {
  const target = board.get(sq);
  if (!target) return 0;
  const caps = board.moves({ verbose: true }).filter(m => m.to === sq && m.captured);
  if (!caps.length) return 0;
  caps.sort((a, b) => SEE_VALUES[a.piece] - SEE_VALUES[b.piece]);
  const m = caps[0];
  board.move({ from: m.from, to: m.to, promotion: m.promotion ? 'q' : undefined });
  const promo = m.promotion ? SEE_VALUES.q - 1 : 0;
  const gain  = SEE_VALUES[target.type] + promo - seeGain(board, sq);
  board.undo();
  return Math.max(0, gain);
}

/**
 * Vero sacrificio: dopo la mossa l'avversario può vincere materiale
 * (almeno SAC_MIN_MATERIAL) rispetto a quanto la mossa stessa ha catturato.
 * Si contano solo pezzi (cavallo o più), non pedoni.
 */
function isSacrifice(prevFen, mv) {
  const b = new Chess(prevFen);
  const mover = b.turn();
  const res = b.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
  if (!res) return false;
  const gained = (mv.captured ? SEE_VALUES[mv.captured] : 0) +
                 (mv.promotion ? SEE_VALUES[mv.promotion] - 1 : 0);
  let maxLoss = 0;
  for (const sq of b.SQUARES) {
    const p = b.get(sq);
    if (!p || p.color !== mover || p.type === 'k' || SEE_VALUES[p.type] < 3) continue;
    maxLoss = Math.max(maxLoss, seeGain(b, sq));
  }
  return maxLoss - gained >= SAC_MIN_MATERIAL;
}

/**
 * Calcola la classificazione della mossa che ha portato a mainHistory[idx].
 * Restituisce null per idx=0 o se mancano gli eval necessari.
 */
function computeClassification(idx) {
  if (idx <= 0 || idx >= mainHistory.length) return null;
  const mv = mainHistory[idx].move;
  if (!mv) return null;

  const prevFen = mainHistory[idx - 1].fen;
  const curFen  = mainHistory[idx].fen;
  const mover   = prevFen.split(' ')[1];
  const before  = winPctFor(mover, gameEvals[idx - 1], prevFen);
  const after   = winPctFor(mover, gameEvals[idx], curFen);
  const loss    = (before === null || after === null) ? null : Math.max(0, before - after);

  // Teoria: ha la precedenza, tranne quando la "teoria" è una trappola in cui
  // si cade davvero (i TSV lichess contengono anche linee-trappola con nome).
  if (gameBookMoves[idx] && (loss === null || loss < WIN_THRESHOLDS.mistake)) return 'book';
  if (loss === null) return null;

  if (loss >= WIN_THRESHOLDS.blunder)    return 'blunder';
  if (loss >= WIN_THRESHOLDS.mistake)    return 'mistake';
  if (loss >= WIN_THRESHOLDS.inaccuracy) return 'inaccuracy';

  const playedUci = (mv.from + mv.to + (mv.promotion || '')).toLowerCase();
  const topMoves  = gameTopMoves[idx - 1] || [];
  const bestUci   = (gameBestMoves[idx - 1] || '').toLowerCase();
  const isBest    = !!bestUci && playedUci === bestUci;

  // BRILLIANT: mossa (quasi) migliore + vero sacrificio, senza essere già
  // completamente vinti prima e senza stare perdendo dopo.
  // Eccezione: il sacrificio che forza il matto (es. 16.Qb8+!! di Morphy).
  const prevEv      = gameEvals[idx - 1];
  const matingSac   = isBest && prevEv && prevEv.type === 'mate' &&
                      (mover === 'w' ? prevEv.value > 0 : prevEv.value < 0);
  if (appConfig.brilliant_enabled && (isBest || loss < EXCELLENT_MAX_LOSS) &&
      (before < 97 || matingSac) && after >= 45 && isSacrifice(prevFen, mv)) {
    return 'brilliant';
  }

  if (isBest) {
    // GREAT: era l'unica mossa buona (2ª linea molto peggiore).
    // Esclusi: ricatture ovvie e mosse forzate (una sola mossa legale).
    if (topMoves.length >= 2) {
      const w1 = winPctFor(mover, topMoveEval(topMoves[0]), prevFen);
      const w2 = winPctFor(mover, topMoveEval(topMoves[1]), prevFen);
      const prevMove   = mainHistory[idx - 1].move;
      const recapture  = !!(mv.captured && prevMove && prevMove.captured && prevMove.to === mv.to);
      const forced     = new Chess(prevFen).moves().length <= 1;
      const mates      = (mv.san || '').includes('#'); // dare matto è ovvio, non "grande"
      if (w1 !== null && w2 !== null && w1 - w2 >= GREAT_MIN_GAP &&
          !recapture && !forced && !mates && after >= 30) {
        return 'great';
      }
    }
    return 'best';
  }

  return 'excellent';
}

/** Ricalcola gameClassifications[] per tutta la partita. */
function refreshClassifications() {
  for (let i = 0; i < mainHistory.length; i++) {
    gameClassifications[i] = computeClassification(i);
  }
}

// Usata per il contesto dell'explain: solo gli errori.
function classifyMove(prevEv, ev, prevFen, curFen) {
  const mover  = prevFen.split(' ')[1];
  const before = winPctFor(mover, prevEv, prevFen);
  const after  = winPctFor(mover, ev, curFen);
  if (before === null || after === null) return null;
  const loss = before - after;
  if (loss >= WIN_THRESHOLDS.blunder)    return 'blunder';
  if (loss >= WIN_THRESHOLDS.mistake)    return 'mistake';
  if (loss >= WIN_THRESHOLDS.inaccuracy) return 'inaccuracy';
  return null;
}

// ── Opening ────────────────────────────────────────────────────────────────

/**
 * Nome apertura per una posizione fuori dalla linea principale (varianti).
 * Se la posizione non ha un nome proprio, lascia quello già mostrato.
 */
async function fetchOpening(fen) {
  const myId = ++openingRequestId;
  try {
    const r = await fetch(`${API}/api/opening?fen=${encodeURIComponent(fen)}`);
    if (myId !== openingRequestId) return; // risposta stale
    const d = await r.json();
    if (d.name) $openName.textContent = d.name;
  } catch { /* server offline o errore */ }
}

/**
 * Aggiorna la barra: nomi giocatori + nome apertura / testo fuori-teoria.
 * I nomi della linea principale arrivano già calcolati da /api/book_moves
 * (ultimo nome raggiunto, portato avanti anche nelle posizioni senza nome).
 */
function updateOpeningBar(idx) {
  updatePlayerStrips();

  openingRequestId++; // invalida eventuali fetchOpening in volo (varianti)
  const name = gameOpeningNames[idx] || '';
  const ecoEl = document.getElementById('openingEco');
  const subEl = document.getElementById('openingSub');
  if (ecoEl) ecoEl.textContent = name ? (gameOpeningEco[idx] || '') : '';
  if (subEl) {
    if (mainHistory.length <= 1 || !gameBookMoves.length) subEl.textContent = '';
    else if (firstOutOfBook === -1) subEl.textContent = t('inTheory');
    else if (firstOutOfBook > 1) subEl.textContent = t('theoryUntil', { move: moveLabel(firstOutOfBook - 1) });
    else subEl.textContent = '';
  }
  if (mainHistory.length <= 1 || !name) {
    $openName.textContent = '';
    return;
  }
  const outOfBook = firstOutOfBook !== -1 && idx >= firstOutOfBook;
  if (!outOfBook) {
    $openName.textContent = name;
  } else {
    // named_at dispari → il nome è stato raggiunto da una mossa del Bianco
    const namedAt = gameNamedAt[idx] ?? -1;
    const key = namedAt % 2 === 1 ? 'whitePlayedOpening' : 'blackPlayedOpening';
    $openName.textContent = t(key, { name });
  }
}

/** Chiede al server teoria e nomi per tutta la linea principale. */
function fetchBookInfo() {
  const hist = mainHistory;              // per scartare risposte di una partita precedente
  const fens = hist.map(h => h.fen);
  const n    = fens.length;
  bookInfoPromise = (async () => {
    try {
      const r = await fetch(`${API}/api/book_moves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fens }),
      });
      const d = await r.json();
      if (!Array.isArray(d.book) || d.book.length !== n || mainHistory !== hist) return;
      gameBookMoves    = d.book;
      gameOpeningNames = d.names    || [];
      gameNamedAt      = d.named_at || [];
      gameOpeningEco   = d.eco      || [];
      const i = d.book.slice(1).findIndex(v => !v);
      firstOutOfBook = i === -1 ? -1 : i + 1;
      if (gameEvals.some(e => e)) refreshClassifications();
      renderMoveList();
      if (!inVariation()) updateOpeningBar(mainIdx);
    } catch { /* server offline — nessun dato teoria */ }
  })();
  return bookInfoPromise;
}

// ── Engine Analysis ────────────────────────────────────────────────────────
function scheduleAnalysis() {
  if (window.PZ && PZ.active) return;            // niente analisi live durante i puzzle
  if (window.OP && OP.blocksAnalysis()) return;  // niente motore durante il ripasso
  const fen = currentFen();
  if (fen === lastAnalysisFen) return;           // già a schermo: tieni linee, freccia e spiegazione
  lastAnalysisFen = null;                        // ciò che è a schermo non vale più
  clearTimeout(analysisTimer);

  // Freccia del motore: vale solo per la posizione in cui è stata calcolata
  engineArrowData = [];
  renderArrows();
  $bestBox.style.display = 'none';

  // Nascondi spiegazione precedente quando cambia posizione
  $explBox.style.display = 'none';
  $explText.textContent  = '';
  lastAnalysisData       = null;
  if ($btnExplain) $btnExplain.disabled = true;

  analysisTimer = setTimeout(runAnalysis, 400);
}

let analysisSeq = 0;   // token anti-risposte fuori ordine

async function runAnalysis() {
  const fen = currentFen();
  if (fen === lastAnalysisFen) return;
  const seq     = ++analysisSeq;
  const reqIdx  = inVariation() ? -1 : mainIdx;   // posizione per cui chiediamo l'analisi
  const isStale = () => seq !== analysisSeq || currentFen() !== fen;

  $engineLines.innerHTML = `<div class="engine-placeholder">${t('analyzing')}</div>`;
  $bestBox.style.display = 'none';

  try {
    const r = await fetch(`${API}/api/analyze`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fen, multipv: 3 }),
    });
    if (!r.ok) {
      const err = await r.json();
      if (isStale()) return;
      $engineLines.innerHTML =
        `<div class="engine-placeholder">${err.error || t('engineError')}</div>`;
      return;
    }
    const data = await r.json();

    // Salva eval e mossa migliore all'indice DELLA RICHIESTA (non a quello
    // corrente: nel frattempo l'utente può aver cambiato mossa)
    if (reqIdx >= 0 && mainHistory[reqIdx]?.fen === fen) {
      gameEvals[reqIdx]           = data.evaluation;
      gameBestMoves[reqIdx]       = data.top_moves?.[0]?.Move || '';
      gameTopMoves[reqIdx]        = data.top_moves || [];
      gameClassifications[reqIdx] = computeClassification(reqIdx);
    }

    if (isStale()) {                               // risposta superata: niente frecce/linee
      if (reqIdx >= 0) renderMoveList();
      return;
    }
    lastAnalysisFen = fen;
    renderMoveBadge();

    displayEngineLines(data, fen);
    updateEvalBar(data.evaluation);
    updateHudEngine(data.evaluation, appConfig.depth);

    const best = data.top_moves?.[0];
    if (best) {
      const san = uciToSan(fen, best.Move);
      $bestSan.textContent  = san || best.Move;
      $bestEval.textContent = formatScore(best.Centipawn, best.Mate);
      $bestEval.className   = 'best-move-eval ' + scoreClass(best.Centipawn, best.Mate);
      $bestBox.style.display = '';

      engineArrowData = [{
        from:  best.Move.slice(0, 2),
        to:    best.Move.slice(2, 4),
        color: ENGINE_ARROW_COLOR,
        width: Math.max(6, Math.round(getSq() * 0.14)),
      }];
      renderArrows();

      // Salva dati per il bottone Spiega
      lastAnalysisData = {
        fen,
        bestMoveSan: san || best.Move,
        pvSan:       best.PV_SAN || '',
        evaluation:  data.evaluation,
      };
      if ($btnExplain) {
        $btnExplain.disabled  = false;
        $btnExplain.textContent = t('explainBtn');
      }
    }

    renderMoveList();
    updateTiles();
  } catch {
    if (!isStale()) $engineLines.innerHTML = `<div class="engine-placeholder">${t('serverUnreachable')}</div>`;
  }
}

function displayEngineLines(data, fen) {
  $engineLines.innerHTML = '';
  const moves = data.top_moves || [];
  lastEngineView = { fen, moves };
  if (window.GM) GM.render();
  if (!moves.length) {
    $engineLines.innerHTML = `<div class="engine-placeholder">${t('noMoves')}</div>`;
    return;
  }
  moves.forEach((m, i) => {
    const line = document.createElement('div');
    line.className = 'engine-line' + (i === 0 ? ' best' : '');

    const score = document.createElement('div');
    score.className   = 'ev-score ' + scoreClass(m.Centipawn, m.Mate);
    score.textContent = formatScore(m.Centipawn, m.Mate);

    const movesDiv = document.createElement('div');
    movesDiv.className = 'ev-moves';
    const san = uciToSan(fen, m.Move);
    // Mostra mossa + prime mosse della PV
    const pvHint = m.PV_SAN ? ` <span class="pv-hint">${escHtml(m.PV_SAN)}</span>` : '';
    movesDiv.innerHTML = `<strong>${escHtml(san || m.Move)}</strong>${pvHint}`;

    line.appendChild(score);
    line.appendChild(movesDiv);

    line.onclick = () => {
      if (m.Move) {
        engineArrowData = [{
          from:  m.Move.slice(0, 2),
          to:    m.Move.slice(2, 4),
          color: ARROW_COLORS.blue,
          width: 7,
        }];
        renderArrows();
      }
    };

    $engineLines.appendChild(line);
  });
}

// ── Explain on demand ──────────────────────────────────────────────────────
async function fetchExplanation() {
  if (!lastAnalysisData) return;

  $explBox.style.display  = 'none';
  $explText.textContent   = '';
  if ($btnExplain) { $btnExplain.disabled = true; $btnExplain.textContent = t('explainLoading'); }
  if (window.GM) GM.render();

  try {
    // Costruisci contesto: usa la mossa GIOCATA se siamo in revisione partita
    let moveSan       = lastAnalysisData.bestMoveSan;
    let evalBefore    = formatEvalForExplain(lastAnalysisData.evaluation);
    let evalAfter     = 'N/A';
    let classification = 'N/A';
    let fenForExplain = lastAnalysisData.fen;

    if (!inVariation() && mainIdx > 0) {
      const playedMove = mainHistory[mainIdx].move;
      if (playedMove) moveSan = playedMove.san;

      const prevEv = gameEvals[mainIdx - 1];
      const curEv  = gameEvals[mainIdx];
      if (prevEv)   evalBefore = formatEvalForExplain(prevEv);
      if (curEv)    evalAfter  = formatEvalForExplain(curEv);

      const cls = gameClassifications[mainIdx] ||
        classifyMove(prevEv, curEv, mainHistory[mainIdx - 1].fen, mainHistory[mainIdx].fen);
      if (cls) classification = cls;

      // FEN PRIMA della mossa giocata
      fenForExplain = mainHistory[mainIdx - 1].fen;
    }

    const r = await fetch(`${API}/api/explain`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        fen:            fenForExplain,
        move_san:       moveSan,
        eval_before:    evalBefore,
        eval_after:     evalAfter,
        classification,
        best_move_san:  lastAnalysisData.bestMoveSan,
        pv_san:         lastAnalysisData.pvSan,
        lang:           currentLang,
      }),
    });

    const d = await r.json();
    if (d.explanation) {
      $explText.textContent  = d.explanation;
      $explBox.style.display = '';
    }
  } catch { /* silenzioso */ }

  if ($btnExplain) { $btnExplain.disabled = false; $btnExplain.textContent = t('explainBtn'); }
  if (window.GM) GM.render();
}

function formatEvalForExplain(ev) {
  if (!ev) return 'N/A';
  if (ev.type === 'mate') return (ev.value > 0 ? '+M' : '-M') + Math.abs(ev.value);
  const p = ev.value / 100;
  return (p >= 0 ? '+' : '') + p.toFixed(2);
}

// ── Full Game Analysis ─────────────────────────────────────────────────────
async function analyzeGame() {
  if (window.OP && OP.active) OP.close(); if (window.ST && ST.active) ST.close();
  if (mainHistory.length <= 1 || analysisProgress) return;

  // 1. Controlla la cache
  if (currentPgn) {
    try {
      const cr = await fetch(`${API}/api/check_game`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pgn_text: currentPgn, ...currentGameMeta }),
      });
      if (cr.ok) {
        const cd = await cr.json();
        // Usa la cache solo se e' un'analisi del formato attuale (2 linee);
        // quelle vecchie vengono rifatte e sovrascritte.
        if (cd.from_cache && cd.current) {
          applyAnalysisResults(cd.results);
          showCacheChip();
          return;
        }
      }
    } catch { /* se la check fallisce, procedi con analisi fresca */ }
  }

  // 2. Analisi fresca: l'avanzamento sta nella colonna, si puo continuare a navigare
  const fens       = mainHistory.map(h => h.fen);
  const hist       = mainHistory;
  const chunkSize  = 10;
  const allResults = new Array(fens.length);
  analysisProgress = { done: 0, total: fens.length };
  renderMoveList();

  for (let i = 0; i < fens.length; i += chunkSize) {
    try {
      const r = await fetch(`${API}/api/analyze_game`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ fens: fens.slice(i, i + chunkSize) }),
      });
      if (r.ok) {
        const d = await r.json();
        d.results.forEach((res, j) => {
          allResults[i + j]        = res;
          gameEvals[i + j]         = res.evaluation;
          gameBestMoves[i + j]     = res.top_moves?.[0]?.Move || '';
          gameTopMoves[i + j]      = res.top_moves || [];
        });
      }
    } catch {}
    if (mainHistory !== hist) { analysisProgress = null; return; }   // nel frattempo e stata caricata un'altra partita
    analysisProgress = { done: Math.min(fens.length, i + chunkSize), total: fens.length };
    renderEvalGraph();
    if (window.GM) GM.render();
  }

  await bookInfoPromise;           // la teoria serve per classificare "Libro"
  analysisProgress = null;
  gameAnalyzed = true;
  refreshClassifications();
  updateEvalBar(gameEvals[mainIdx]);
  renderMoveList();
  renderBoard();
  document.getElementById('summaryBtn').style.display = '';

  // 3. Salva nel DB (fire-and-forget)
  saveToDB(allResults);
}
document.getElementById('analyzeGameBtn').onclick = analyzeGame;

// ── PGN Loading ────────────────────────────────────────────────────────────
/** chess.js 0.10 vuole una riga vuota tra intestazioni e mosse: la aggiungiamo. */
function normalizePgn(pgn) {
  return pgn.replace(/\r\n?/g, '\n').trim()
            .replace(/(\[[^\]\n]*\])[ \t]*\n(?=[ \t]*[^\[\s])/, '$1\n\n');
}

function loadPgn(pgn) {
  const tmp = new Chess();
  if (!tmp.load_pgn(normalizePgn(pgn), { sloppy: true }))
    throw new Error('PGN non valido o formato non riconosciuto.');

  const headers  = tmp.header();
  const history  = tmp.history({ verbose: true });
  const startFen = headers['FEN'] || new Chess().fen();
  const play     = new Chess(startFen);

  mainHistory = [{ fen: startFen, move: null }];
  for (const mv of history) {
    play.move({ from: mv.from, to: mv.to, promotion: mv.promotion });
    mainHistory.push({ fen: play.fen(), move: mv });
  }

  document.getElementById('summaryBtn').style.display = 'none';
  gameAnalyzed = false; analysisProgress = null; lastEngineView = null;

  gameEvals           = new Array(mainHistory.length).fill(null);
  gameBestMoves       = new Array(mainHistory.length).fill('');
  gameTopMoves        = new Array(mainHistory.length).fill([]);
  gameClassifications = new Array(mainHistory.length).fill(null);
  gameBookMoves       = new Array(mainHistory.length).fill(false);
  gameOpeningNames    = [];
  gameNamedAt         = [];
  gameOpeningEco      = [];
  firstOutOfBook      = -1;
  varHistory = []; varIdx = -1; branchIdx = 0;

  // Teoria + nomi apertura in background (non bloccante)
  fetchBookInfo();

  const w = headers['White'] || '?', b = headers['Black'] || '?';
  const ev = headers['Event'] || '', dt = headers['Date'] || '', res = headers['Result'] || '*';

  // Salva metadati e PGN grezzo per cache/DB
  currentPgn      = pgn;
  const wElo = headers['WhiteElo'] || '';
  const bElo = headers['BlackElo'] || '';
  currentGameMeta = { white: w, black: b, event: ev, date: dt, result: res, whiteElo: wElo, blackElo: bElo };

  $gameMeta.innerHTML = (w === '?' && b === '?') ? '' : `<b>${escHtml(w)}</b> vs <b>${escHtml(b)}</b>` +
    (ev && ev !== '?' ? ` / ${escHtml(ev)}` : '') +
    (dt && dt !== '???.??.??' ? ` / ${escHtml(dt)}` : '') + ` / ${escHtml(res)}`;

  document.getElementById('analyzeGameBtn').disabled = false;
  goToIndex(0);
}

// ── Eval Bar — funzione logistica stile Lichess ────────────────────────────
function updateEvalBar(ev) {
  if (!ev) {
    $evalFill.style.height = '50%';
    $evalTop.textContent   = '';
    $evalBot.textContent   = '';
    return;
  }

  let pct, label;

  if (ev.type === 'mate') {
    // Matto: barra al massimo/minimo, no formula logistica
    pct   = ev.value > 0 ? 96 : 4;
    label = (ev.value > 0 ? '+M' : '-M') + Math.abs(ev.value);
  } else {
    // Centipawn SEMPRE dal punto di vista del Bianco
    const cp = ev.value;
    // Formula logistica Lichess: win-prob Bianco in [0,1]
    const winProb = 1 / (1 + Math.exp(-0.00368208 * cp));
    pct   = Math.max(3, Math.min(97, winProb * 100));
    const p = cp / 100;
    label = (p >= 0 ? '+' : '') + p.toFixed(1);
  }

  $evalFill.style.height = pct + '%';
  const isPos = ev.type === 'mate' ? ev.value > 0 : ev.value >= 0;
  // Bianco = carta dal basso → etichetta in basso se il Bianco sta meglio
  $evalTop.textContent = '';
  $evalBot.textContent = label;
}

// ── Arrows & Drawings ──────────────────────────────────────────────────────
function squareCenter(sq) {
  const file = 'abcdefgh'.indexOf(sq[0]);
  const rank = parseInt(sq[1]) - 1;
  const col  = isFlipped ? 7 - file : file;
  const row  = isFlipped ? rank : 7 - rank;
  // Legge --sq dal CSS al momento del disegno: funziona con qualsiasi
  // dimensione della board (resize drag, media query, ecc.)
  const s = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--sq')
  ) || 64;
  return { x: col * s + s / 2, y: row * s + s / 2 };
}

function squareFromEvent(e) {
  const rect = $board.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const s = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--sq')
  ) || 64;
  const col = Math.floor(x / s);
  const row = Math.floor(y / s);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  const fileIdx = isFlipped ? 7 - col : col;
  const rankIdx = isFlipped ? row : 7 - row;
  return 'abcdefgh'[fileIdx] + (rankIdx + 1);
}

function renderArrows() {
  $arrows.innerHTML = '';
  if (!(window.PZ && PZ.active) && !(window.OP && OP.hidesEngineArrow())) engineArrowData.forEach(a => svgArrow(a.from, a.to, a.color === ENGINE_ARROW_COLOR ? cssVar('--engine-arrow', a.color) : a.color, a.width));
  if (window.OP) OP.drawArrows();
  if (window.PZ && PZ.active) PZ.drawArrows();
  customDrawings.forEach(d => {
    if (d.type === 'arrow')  svgArrow(d.from, d.to, arrowColor(d.color), 6);
    if (d.type === 'circle') svgCircle(d.sq, arrowColor(d.color));
  });
}

function svgArrow(fromSq, toSq, color, width, opacity) {
  const from = squareCenter(fromSq);
  const to   = squareCenter(toSq);
  const dx   = to.x - from.x, dy = to.y - from.y;
  const len  = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const headLen = width * 2 + 4;
  const ex = from.x + dx * (len - headLen) / len;
  const ey = from.y + dy * (len - headLen) / len;

  const id = 'mh' + Math.random().toString(36).slice(2, 8);
  let defs = $arrows.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    $arrows.appendChild(defs);
  }

  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('markerWidth', '4'); marker.setAttribute('markerHeight', '4');
  marker.setAttribute('refX', '2');        marker.setAttribute('refY', '2');
  marker.setAttribute('orient', 'auto');
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  poly.setAttribute('points', '0 0, 4 2, 0 4');
  poly.setAttribute('fill', color);
  if (opacity != null) poly.setAttribute('fill-opacity', opacity);
  marker.appendChild(poly);
  defs.appendChild(marker);

  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', from.x); line.setAttribute('y1', from.y);
  line.setAttribute('x2', ex);     line.setAttribute('y2', ey);
  line.setAttribute('stroke', color);
  if (opacity != null) line.setAttribute('stroke-opacity', opacity);
  line.setAttribute('stroke-width', width);
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('marker-end', `url(#${id})`);
  $arrows.appendChild(line);
}

function svgCircle(sq, color) {
  const { x, y } = squareCenter(sq);
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', x);    circle.setAttribute('cy', y);
  circle.setAttribute('r', 26);
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', color);
  circle.setAttribute('stroke-width', 4);
  $arrows.appendChild(circle);
}

function clearCustomDrawings() {
  customDrawings = [];
  renderArrows();
}

// ── Right-click arrow drawing ──────────────────────────────────────────────
(function setupDrawing() {
  const boardWrap = document.querySelector('.board-inner-wrap');

  boardWrap.addEventListener('mousedown', e => {
    if (e.button === 2) {
      e.preventDefault();
      arrowDragStart    = squareFromEvent(e);
      arrowDragModifier = e.shiftKey ? 'yellow' : e.ctrlKey ? 'blue' : e.altKey ? 'red' : 'green';
    }
  });

  boardWrap.addEventListener('mouseup', e => {
    if (e.button === 2 && arrowDragStart) {
      const end = squareFromEvent(e);
      if (end && end !== arrowDragStart) {
        toggleCustomDrawing({ type: 'arrow', from: arrowDragStart, to: end, color: arrowDragModifier });
      } else if (arrowDragStart) {
        toggleCustomDrawing({ type: 'circle', sq: arrowDragStart, color: arrowDragModifier });
      }
      arrowDragStart = null;
      renderArrows();
    }
  });

  boardWrap.addEventListener('contextmenu', e => e.preventDefault());

  $board.addEventListener('mousedown', e => {
    if (e.button === 0 && customDrawings.length > 0) {
      customDrawings = [];
      renderArrows();
    }
  });
})();

function toggleCustomDrawing(d) {
  const idx = customDrawings.findIndex(x => {
    if (x.type !== d.type || x.color !== d.color) return false;
    return d.type === 'arrow'
      ? (x.from === d.from && x.to === d.to)
      : x.sq === d.sq;
  });
  if (idx >= 0) customDrawings.splice(idx, 1);
  else customDrawings.push(d);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function uciToSan(fen, uci) {
  try {
    const t  = new Chess(fen);
    const mv = t.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    return mv ? mv.san : uci;
  } catch { return uci; }
}

function formatScore(cp, mate) {
  if (mate !== null && mate !== undefined)
    return (mate > 0 ? '+M' : '-M') + Math.abs(mate);
  if (cp === null || cp === undefined) return '0.00';
  const p = cp / 100;
  return (p >= 0 ? '+' : '') + p.toFixed(2);
}

function scoreClass(cp, mate) {
  if (mate !== null && mate !== undefined) return mate > 0 ? 'mate-pos' : 'mate-neg';
  return (cp ?? 0) >= 0 ? 'pos' : 'neg';
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Analysis results helpers ───────────────────────────────────────────────

/**
 * Applica un array di results (formato /api/analyze_game o /api/check_game)
 * ai vettori di stato e ricalcola le classificazioni.
 */
function applyAnalysisResults(results) {
  results.forEach((res, i) => {
    if (!res) return;
    gameEvals[i]     = res.evaluation || null;
    gameBestMoves[i] = res.top_moves?.[0]?.Move || '';
    gameTopMoves[i]  = res.top_moves || [];
  });
  // Le classificazioni si ricalcolano sempre: così le partite salvate
  // beneficiano subito di eventuali miglioramenti dell'algoritmo.
  refreshClassifications();
  updateEvalBar(gameEvals[mainIdx]);
  renderMoveList();
  renderBoard();
  if (gameEvals.some(e => e !== null)) {
    gameAnalyzed = true;
    document.getElementById('summaryBtn').style.display = '';
    renderMoveList();
  }
}

/** Mostra il badge "📦 da cache" per 3 secondi accanto al game-meta. */
function showCacheChip() {
  const chip = document.getElementById('cacheChip');
  if (!chip) return;
  chip.textContent    = t('fromCache');
  chip.style.display  = '';
  chip.style.opacity  = '1';
  clearTimeout(chip._timer);
  chip._timer = setTimeout(() => { chip.style.display = 'none'; }, 3000);
}

/** Salva la partita e i risultati nel DB (fire-and-forget, silenzioso). */
async function saveToDB(allResults) {
  if (!currentPgn) return;
  const positions = mainHistory.map((h, i) => ({
    ply:           i,
    fen:           h.fen,
    move_san:      h.move ? h.move.san : null,
    best_move_uci: allResults[i]?.top_moves?.[0]?.Move || '',
    eval_type:     allResults[i]?.evaluation?.type  || 'cp',
    eval_cp:       allResults[i]?.evaluation?.value ?? null,
    classification: gameClassifications[i] || null,
    top_moves:     allResults[i]?.top_moves || [],
  }));
  try {
    await fetch(`${API}/api/save_game`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pgn_text: currentPgn, ...currentGameMeta, positions }),
    });
  } catch { /* silenzioso */ }
}

// ── Games library ──────────────────────────────────────────────────────────

async function openGamesLibrary() {
  document.getElementById('gamesModal').classList.add('open');
  const list = document.getElementById('gamesList');
  list.innerHTML = '<div class="games-loading">…</div>';
  try {
    const r     = await fetch(`${API}/api/games`);
    const games = await r.json();
    renderGamesList(games);
  } catch {
    list.innerHTML = `<div class="games-empty">${t('serverUnreachable')}</div>`;
  }
}

function renderGamesList(games) {
  const list = document.getElementById('gamesList');
  if (!games.length) {
    list.innerHTML = `<div class="games-empty">${t('gamesEmpty')}</div>`;
    return;
  }
  list.innerHTML = '';
  games.forEach(g => {
    const row = document.createElement('div');
    row.className = 'games-row';

    const metaParts = [g.date && g.date !== '???.??.??' ? g.date : null, g.result]
      .filter(Boolean).join(' · ');
    const eventPart = g.event && g.event !== '?' ? ` · ${escHtml(g.event)}` : '';

    row.innerHTML = `
      <div class="games-row-info">
        <span class="games-players">${escHtml(g.white)} vs ${escHtml(g.black)}</span>
        <span class="games-meta">${escHtml(metaParts)}${eventPart}</span>
      </div>
      <div class="games-row-actions">
        <button class="btn btn-sm games-load-btn">${t('gamesLoad')}</button>
        <button class="btn btn-sm btn-danger games-del-btn">${t('gamesDelete')}</button>
      </div>`;

    row.querySelector('.games-load-btn').onclick = () => loadSavedGame(g.id);
    row.querySelector('.games-del-btn').onclick  = async () => {
      if (!confirm(t('gamesConfirmDel'))) return;
      await fetch(`${API}/api/games/${g.id}`, { method: 'DELETE' });
      openGamesLibrary(); // refresh lista
    };
    list.appendChild(row);
  });
}

async function loadSavedGame(id) {
  try {
    const r = await fetch(`${API}/api/games/${id}/pgn`);
    if (!r.ok) return;
    const { pgn } = await r.json();

    loadPgn(pgn);                                        // popola mainHistory + meta
    if (window.AR) AR.close();

    // Carica analisi dalla cache (sempre presente per partite salvate)
    const cr = await fetch(`${API}/api/check_game`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pgn_text: pgn, ...currentGameMeta }),
    });
    if (cr.ok) {
      const cd = await cr.json();
      if (cd.from_cache) {
        applyAnalysisResults(cd.results);
        showCacheChip();
      }
    }
  } catch { /* silenzioso */ }
}

// ── Summary modal ──────────────────────────────────────────────────────────

/** Accuratezza di una singola mossa (formula lichess) da calo di win% del giocatore. */
function moveAccuracy(winBefore, winAfter) {
  const drop = Math.max(0, winBefore - winAfter);
  const raw  = 103.1668100711649 * Math.exp(-0.04354415386753951 * drop) - 3.166924740191411;
  return Math.min(100, Math.max(0, raw + 1)); // +1 = bonus d'incertezza, come lichess
}

function stdDev(xs) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

/**
 * Accuratezza della partita come lichess: media tra media pesata per la
 * "volatilità" della posizione e media armonica delle accuratezze per mossa.
 */
function gameAccuracy() {
  const n = mainHistory.length;
  // win% del Bianco per ogni posizione (buchi riempiti con il valore precedente)
  const wins = [];
  for (let i = 0; i < n; i++) {
    const w = winPctWhite(gameEvals[i], mainHistory[i].fen);
    wins.push(w !== null ? w : (i ? wins[i - 1] : 50));
  }
  if (n < 3) return { w: null, b: null };

  const windowSize = Math.min(8, Math.max(2, Math.floor((n - 1) / 10)));
  const windows = [];
  for (let k = 0; k < Math.min(windowSize, n) - 2; k++) windows.push(wins.slice(0, windowSize));
  for (let s = 0; s + windowSize <= n; s++) windows.push(wins.slice(s, s + windowSize));
  const weights = windows.map(ws => Math.min(12, Math.max(0.5, stdDev(ws))));

  const per = { w: [], b: [] };
  for (let i = 1; i < n; i++) {
    if (!gameEvals[i - 1] || !gameEvals[i]) continue;
    const mover = mainHistory[i - 1].fen.split(' ')[1];
    const before = mover === 'w' ? wins[i - 1] : 100 - wins[i - 1];
    const after  = mover === 'w' ? wins[i]     : 100 - wins[i];
    per[mover].push({ acc: moveAccuracy(before, after), weight: weights[i - 1] ?? 1 });
  }

  const combine = list => {
    if (!list.length) return null;
    const wSum     = list.reduce((a, x) => a + x.weight, 0);
    const weighted = list.reduce((a, x) => a + x.acc * x.weight, 0) / wSum;
    const harmonic = list.length / list.reduce((a, x) => a + 1 / Math.max(x.acc, 1), 0);
    return ((weighted + harmonic) / 2).toFixed(1);
  };
  return { w: combine(per.w), b: combine(per.b) };
}

function computeSummary() {
  const wCounts = {}, bCounts = {};
  SUMMARY_ROWS.forEach(r => { wCounts[r.cls] = 0; bCounts[r.cls] = 0; });

  for (let i = 1; i < mainHistory.length; i++) {
    const isWhite = mainHistory[i - 1].fen.split(' ')[1] === 'w';
    const cls     = gameClassifications[i];
    const counts  = isWhite ? wCounts : bCounts;
    if (cls && counts[cls] !== undefined) counts[cls]++;
  }

  const acc = gameAccuracy();
  return { wCounts, bCounts, wAcc: acc.w, bAcc: acc.b };
}

function openSummaryModal() {
  const { wCounts, bCounts, wAcc, bAcc } = computeSummary();

  document.getElementById('summaryWhiteName').textContent = currentGameMeta.white || '—';
  document.getElementById('summaryBlackName').textContent = currentGameMeta.black || '—';
  document.getElementById('summaryWhiteAcc').textContent  = wAcc !== null ? wAcc + '%' : '—';
  document.getElementById('summaryBlackAcc').textContent  = bAcc !== null ? bAcc + '%' : '—';

  const rows = document.getElementById('summaryRows');
  rows.innerHTML = '';
  SUMMARY_ROWS.forEach(({ cls }) => {
    const row = document.createElement('div');
    row.className = 'summary-row';
    const w = wCounts[cls] ?? 0, b = bCounts[cls] ?? 0;
    row.innerHTML =
      `<span>${clsBadge(cls)}</span>` +
      `<span class="lbl">${escHtml(t('cls_' + cls))}</span>` +
      `<span class="n${w ? '' : ' zero'}">${w}</span>` +
      `<span class="n${b ? '' : ' zero'}">${b}</span>`;
    rows.appendChild(row);
  });

  document.getElementById('summaryModal').classList.add('open');
}

// ── Settings events ────────────────────────────────────────────────────────
function setupEvents() {
  // Summary modal
  document.getElementById('summaryBtn').onclick = openSummaryModal;
  document.getElementById('summaryClose').onclick = () =>
    document.getElementById('summaryModal').classList.remove('open');
  document.getElementById('summaryModal').addEventListener('click', e => {
    if (e.target === e.currentTarget)
      document.getElementById('summaryModal').classList.remove('open');
  });

  // Import modal
  document.getElementById('importBtn').onclick = () => {
    if (window.OP && OP.active) OP.close(); if (window.ST && ST.active) ST.close();
    document.getElementById('pgnError').textContent = '';
    document.getElementById('importModal').classList.add('open');
  };
  document.getElementById('importClose').onclick = () =>
    document.getElementById('importModal').classList.remove('open');
  document.getElementById('loadPgnBtn').onclick = () => {
    const pgn = document.getElementById('pgnInput').value.trim();
    if (!pgn) { document.getElementById('pgnError').textContent = t('insertPgn'); return; }
    try {
      loadPgn(pgn);
      document.getElementById('importModal').classList.remove('open');
    } catch (ex) {
      document.getElementById('pgnError').textContent = ex.message;
    }
  };
  document.getElementById('pgnFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = ev => { document.getElementById('pgnInput').value = ev.target.result; };
    rd.readAsText(f);
  };

  // Games library
  document.getElementById('gamesBtn').onclick   = () => { if (window.OP && OP.active) OP.close(); if (window.ST && ST.active) ST.close(); openGamesLibrary(); };

  // Settings modal

  document.getElementById('setSfPath').onclick = async () => {
    const path = document.getElementById('sfPath').value.trim();
    if (!path) { setSettingsMsg(t('insertPath'), 'err'); return; }
    try {
      const r = await fetch(`${API}/api/set_stockfish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
      const d = await r.json();
      if (d.success) { setSettingsMsg(t('sfConfigured'), 'ok'); pollStatus(); }
      else setSettingsMsg(d.error || t('errorGeneric'), 'err');
    } catch { setSettingsMsg(t('serverUnreach'), 'err'); }
  };

  // Explain button
  if ($btnExplain) {
    $btnExplain.addEventListener('click', fetchExplanation);
  }

  // Modulo aperture
  document.getElementById('learnBtn').onclick = () => { if (window.ST && ST.active) ST.close(); if (window.OP) OP.open(); };

  // Rail di navigazione: Game = chiude Aperture / Statistiche e torna alla partita
  document.getElementById('navGame').onclick = () => {
    if (window.OP && OP.active) OP.close();
    if (window.ST && ST.active) ST.close();
  };
  refreshOpBadge();

  // Close modals on backdrop click
  document.querySelectorAll('.modal-bg').forEach(bg =>
    bg.addEventListener('click', e => { if (e.target === bg) bg.classList.remove('open'); })
  );
}

function setSettingsMsg(text, cls) {
  const el = document.getElementById('settingsMsg');
  if (el) { el.textContent = text; el.className = 'settings-msg ' + cls; }
}

/** Badge sulla voce Openings del rail: carte da ripassare oggi. */
function setOpBadge(n) {
  const el = document.getElementById('opBadge');
  if (!el) return;
  el.textContent = n > 99 ? '99+' : String(n);
  el.hidden = !(n > 0);
}
async function refreshOpBadge() {
  try {
    const d = await (await fetch(`${API}/api/rep/chapters`)).json();
    setOpBadge((d.chapters || []).reduce((a, c) => a + (c.due || 0), 0));
  } catch {}
}
window.setOpBadge = setOpBadge;

// ── Right-col alignment ────────────────────────────────────────────────────
function alignRightCol() {
  const boardEl = document.getElementById('board');
  const rcEl    = document.querySelector('.right-col');
  const appEl   = document.querySelector('.app-shell');
  if (!boardEl || !rcEl || !appEl) return;
  const boardRect = boardEl.getBoundingClientRect();
  const appRect   = appEl.getBoundingClientRect();
  const boardTop  = boardRect.top  - appRect.top;
  const boardH    = boardRect.height;
  document.documentElement.style.setProperty('--rc-offset-top', boardTop + 'px');
  document.documentElement.style.setProperty('--rc-board-h',    boardH   + 'px');
}
window.addEventListener('resize', alignRightCol);

// ── Board Resizer ──────────────────────────────────────────────────────────
const SQ_MIN = 64;
const SQ_MAX = Math.round(64 * 1.6);
const SQ_KEY = 'cr_sq_size';

function getSq() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--sq').trim();
  return parseInt(v) || 64;
}

function setSq(px) {
  const clamped = Math.max(SQ_MIN, Math.min(SQ_MAX, Math.round(px)));
  document.documentElement.style.setProperty('--sq', clamped + 'px');
  try { localStorage.setItem(SQ_KEY, clamped); } catch {}
  buildLabels();
  renderBoard();
}

function loadSavedSq() {
  try {
    const saved = parseInt(localStorage.getItem(SQ_KEY));
    if (saved >= SQ_MIN && saved <= SQ_MAX)
      document.documentElement.style.setProperty('--sq', saved + 'px');
  } catch {}
}


// ── Suoni ──────────────────────────────────────────────────────────────────
// Sintetizzati con la Web Audio API: nessun file audio, funzionano offline e
// dentro l'exe. Mossa = colpo di legno; cattura = colpo più pieno e doppio;
// arrocco = due colpi; scacco = "ping" sopra il colpo; matto = accordo finale.
const SFX = (() => {
  let ctx = null, master = null, noiseBuf = null;
  let enabled = true;
  try { enabled = localStorage.getItem('cr_sound') !== 'off'; } catch {}

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  // Colpo del pezzo sul legno: rumore filtrato (attacco) + sinusoide (corpo)
  function knock(t, { freq = 1900, q = 4, gain = 0.55, body = 170, bodyGain = 0.35, dur = 0.06 } = {}) {
    const src = ctx.createBufferSource(); src.buffer = noise();
    const bp  = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const g   = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);

    const o  = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(body, t);
    o.frequency.exponentialRampToValueAtTime(body * 0.6, t + dur * 1.5);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(bodyGain, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.8);
    o.connect(g2); g2.connect(master);
    o.start(t); o.stop(t + dur * 2);
  }

  function tone(t, f, dur, gain = 0.16, type = 'triangle') {
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  const kinds = {
    move(t)    { knock(t); },
    capture(t) {
      knock(t,         { freq: 1300, q: 2.5, gain: 0.85, body: 125, bodyGain: 0.55, dur: 0.08 });
      knock(t + 0.03,  { freq: 2600, q: 5,   gain: 0.30, body: 230, bodyGain: 0.12, dur: 0.04 });
    },
    castle(t)  { knock(t); knock(t + 0.11, { freq: 1650 }); },
    promote(t) { tone(t + 0.05, 660, 0.12, 0.12); tone(t + 0.12, 990, 0.2, 0.12); },
    check(t)   { tone(t + 0.04, 988, 0.16); tone(t + 0.11, 1319, 0.24, 0.14); },
    mate(t) {
      [523.25, 659.25, 783.99].forEach((f, i) => tone(t + 0.1 + i * 0.09, f, 0.9, 0.12));
      tone(t + 0.38, 1046.5, 1.2, 0.11);
    },
  };

  /** Suona la mossa (oggetto verbose di chess.js). */
  function playMove(mv) {
    if (!enabled || !mv || !audio()) return;
    const t     = ctx.currentTime + 0.005;
    const flags = mv.flags || '';
    const san   = mv.san   || '';
    if (/[ce]/.test(flags))      kinds.capture(t);
    else if (/[kq]/.test(flags)) kinds.castle(t);
    else                         kinds.move(t);
    if (flags.includes('p'))     kinds.promote(t);
    if (san.includes('#'))       kinds.mate(t);
    else if (san.includes('+'))  kinds.check(t);
  }

  function updateButton() {
    const b = document.getElementById('btnSound');
    if (!b) return;
    b.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    b.classList.toggle('muted', !enabled);
  }

  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem('cr_sound', enabled ? 'on' : 'off'); } catch {}
    updateButton();
    if (enabled && audio()) kinds.move(ctx.currentTime + 0.005);  // conferma udibile
  }

  return { playMove, toggle, updateButton, get enabled() { return enabled; } };
})();
window.SFX = SFX;   // usabile anche da openings.js

// ── Menu "Partita" a scomparsa: chiuso, Apertura e Mosse salgono e la cronologia ha più spazio ──
(function initGameFold() {
  const btn = document.getElementById('gameFold');
  const box = document.getElementById('gameActions');
  if (!btn || !box) return;
  const apply = open => {
    box.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('game-fold-closed', !open);
  };
  let open = true;
  try { open = localStorage.getItem('cr_game_fold') !== 'closed'; } catch {}
  apply(open);
  btn.addEventListener('click', () => {
    open = !open;
    apply(open);
    try { localStorage.setItem('cr_game_fold', open ? 'open' : 'closed'); } catch {}
    requestAnimationFrame(() => { try { fitBoard(); renderArrows(); renderMoveBadge(); } catch {} });
  });
})();

// ── Comandi scacchiera: visibili solo con il mouse sopra, +3 s dopo che esce ──
(function initBoardTools() {
  const hud = document.getElementById('hudBR');
  if (!hud) return;
  let tm = null;
  const show  = () => { clearTimeout(tm); hud.classList.add('show'); };
  const later = () => { clearTimeout(tm); tm = setTimeout(() => hud.classList.remove('show'), 3000); };
  hud.addEventListener('mouseenter', show);
  hud.addEventListener('mouseleave', later);
  hud.addEventListener('focusin', show);
  hud.addEventListener('focusout', later);
})();

// ── Ingrandimento ──────────────────────────────────────────────────────────
// Modalità "zx": scacchiera più grande (bordo alto fermo, fondo alla mezzeria dell'ex istogramma),
// giocatori ai lati della scacchiera, istogramma nel pannello destro, pannelli fino in fondo.
// Vale solo nella vista partita: Aperture e Statistiche usano il layout normale.
(function initZoom() {
  const btn = document.getElementById('btnZoom');
  let zoomOn = false;
  zoomOn = false;   // con la nuova vista Game la scacchiera e gia grande: modalita ingrandita ritirata

  function updateZoomBtn() {
    if (!btn) return;
    const label = t(zoomOn ? 'ctrlZoomOut' : 'ctrlZoom');
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.setAttribute('aria-pressed', zoomOn ? 'true' : 'false');
  }
  window.updateZoomBtn = updateZoomBtn;

  function sync() {
    const b = document.body;
    b.classList.toggle('zoomed', zoomOn);
    const want = zoomOn && !b.classList.contains('op-active') && !b.classList.contains('st-active');
    if (b.classList.contains('zx') === want) return;
    b.classList.toggle('zx', want);
    // l'istogramma vive nella timeline (normale) o nel pannello destro (ingrandito)
    const graph = document.querySelector('.tl > .graph, #panelEngine > .graph');
    const panel = document.getElementById('panelEngine');
    const tl    = document.querySelector('.tl');
    const ctrl  = panel && panel.querySelector('.ctrl');
    if (graph && panel && tl && ctrl) {
      if (want) panel.insertBefore(graph, ctrl);
      else tl.insertBefore(graph, tl.firstChild);
    }
    requestAnimationFrame(() => {
      try { fitBoard(); renderEvalGraph(); renderArrows(); renderMoveBadge(); } catch {}
    });
  }

  if (btn) btn.addEventListener('click', () => {
    zoomOn = !zoomOn;
    try { localStorage.setItem('cr_zoom', zoomOn ? '1' : '0'); } catch {}
    updateZoomBtn();
    sync();
  });
  // Aperture / Statistiche cambiano le classi del body: il layout ingrandito si adegua
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  updateZoomBtn();
  sync();
})();

// ── Lattice UI helpers ─────────────────────────────────────────────────────

// Classi che meritano un segno (nella lista mosse, sulla casa, nel grafico).
// "Migliore" e "Ottima" restano senza segno: sono la norma, non la notizia.
const NOTABLE = new Set(['brilliant', 'great', 'inaccuracy', 'mistake', 'blunder']);

function clsBadge(cls) {
  const meta = MOVE_META[cls];
  if (!meta) return '';
  return `<span class="cb ${cls}" title="${escHtml(t('cls_' + cls))}">${meta.symbol}</span>`;
}

function evText(ev) {
  if (!ev) return '—';
  if (ev.type === 'mate') {
    if (ev.value === 0) return '#';
    return (ev.value > 0 ? '+M' : '-M') + Math.abs(ev.value);
  }
  const p = ev.value / 100;
  return (p >= 0 ? '+' : '') + p.toFixed(2);
}

function moveLabel(idx) {
  const mv = mainHistory[idx]?.move;
  if (!mv) return '';
  const n = Math.ceil(idx / 2);
  return (idx % 2 === 1 ? `${n}.` : `${n}…`) + mv.san;
}

/** Dimensiona la scacchiera sullo spazio disponibile nello stage. */
const NORMAL_BOTTOM = 112;   // altezza della timeline in modalità normale (= --bottom)
const STRIP_H = 36;          // riga giocatore (nome + pezzi mangiati)
const LBL_H   = 23;          // coordinate sotto la scacchiera
const ZOOM_COL = 170;        // larghezza della colonna giocatori in modalità ingrandita
function fitBoard() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const banner   = document.getElementById('learnBanner');
  const feedback = document.getElementById('learnFeedback');
  const extra = (banner && banner.offsetParent ? banner.offsetHeight + 6 : 0) +
                (feedback && feedback.offsetParent ? feedback.offsetHeight + 6 : 0);
  const zx = document.body.classList.contains('zx');
  // altezza che lo stage avrebbe in modalità normale (da qui il bordo alto resta fermo)
  const Hn = zx ? stage.clientHeight - NORMAL_BOTTOM : stage.clientHeight;
  // nelle Aperture le righe giocatore sono nascoste: la scacchiera usa quello spazio
  const strips = document.body.classList.contains('op-active') ? 0 : 2 * STRIP_H + 2 * 8;
  const availH = Hn - 24 /* margini */ - strips - 2 - LBL_H - extra;
  const availW = stage.clientWidth - 2 * 64 /* colonna comandi */ - 68 /* eval + coordinate */ - 20;
  let sqMax = (document.body.classList.contains('op-active') || document.body.classList.contains('pz-active')) ? 150 : 134;
  try { const cap = +localStorage.getItem('cr_board_cap') || 0; if (cap) sqMax = Math.min(sqMax, cap); } catch {}
  let sq = Math.max(36, Math.min(sqMax, Math.floor(Math.min(availH, availW) / 8)));
  if (zx) {
    // bordo alto = quello della scacchiera normale; il fondo arriva alla mezzeria dell'ex istogramma
    const top = Math.round((Hn - (2 * STRIP_H + 2 * 6 + 8 * sq + LBL_H)) / 2 + STRIP_H + 6);
    stage.style.setProperty('--zoom-top', top + 'px');
    const bottomLimit = stage.clientHeight - NORMAL_BOTTOM / 2;
    const fitH = Math.floor((bottomLimit - top) / 8);
    // colonna giocatori (a sinistra della barra eval) e colonna comandi (a destra)
    const blockW = ZOOM_COL + 14 + 8;   // colonna fissa: i pezzi mangiati vanno a capo, la scacchiera non si muove
    const fitW = Math.floor((stage.clientWidth - 64 - blockW - 52) / 8);
    const zsq = Math.max(36, Math.min(150, fitH, fitW));
    sq = Math.max(sq, zsq);                       // mai più piccola della scacchiera normale
    const free = stage.clientWidth - 64 - blockW - (8 * sq + 52);
    stage.style.setProperty('--zoom-left', Math.round(blockW + Math.max(0, free) / 2) + 'px');
  }
  const cur = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sq')) || 0;
  if (sq !== cur) document.documentElement.style.setProperty('--sq', sq + 'px');
}

/** HUD agli angoli dello stage + contatore della timeline. */
function updateHud() {
  const n    = Math.max(0, mainHistory.length - 1);
  const idx  = inVariation() ? branchIdx : mainIdx;
  const side = chess.turn() === 'w' ? t('white') : t('black');
  const pos  = document.getElementById('hudPos');
  if (pos) pos.innerHTML = t('hudPos', { i: idx, n }) + '<br>' + t('hudTurn', { side });

  const now = document.getElementById('plyNow');
  if (now) now.textContent = `${String(idx).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
  const sess = document.getElementById('plySess');
  if (sess) {
    if (mainHistory.length <= 1) sess.textContent = t('noGame');
    else if (idx === 0) sess.textContent = t('startPosition');
    else {
      const cls = gameClassifications[idx];
      sess.textContent = moveLabel(idx) + (cls ? ' · ' + t('cls_' + cls) : '');
    }
  }
}

function updateHudEngine(ev, depth) {
  const el = document.getElementById('hudTR');
  if (!el) return;
  el.innerHTML = ev ? t('hudEval', { ev: evText(ev) }) + '<br>' + t('hudDepth', { d: depth || '—' }) : '';
}

/** Valutazione e mossa giocata ora si leggono da barra e cronologia: qui resta la precisione accanto ai nomi. */
function updateTiles() {
  updatePlayerStrips();
}

/** Grafico della valutazione: una barra per semimossa; in alto i badge dei momenti chiave. */
function renderEvalGraph() {
  const el = document.getElementById('evalGraph');
  if (!el) return;
  el.innerHTML = '';
  const n = mainHistory.length;
  if (n <= 1) {
    el.innerHTML = `<div class="hist-empty dash">${t('noGame')}</div>`;
    return;
  }
  if (!gameAnalyzed && !analysisProgress) {
    el.innerHTML = `<div class="hist-empty dash">${escHtml(window.GM ? GM.tr('noGraph') : t('graphEmpty'))}</div>`;
    return;
  }
  el.style.gridAutoColumns = 'minmax(0, 1fr)';
  const moms = window.GM ? new Set(GM.moments().map(m => m.p)) : new Set();
  for (let i = 1; i < n; i++) {
    const b = document.createElement('button');
    b.className = 'gb' + (!inVariation() && i === mainIdx ? ' cur' : '');
    const w = winPctWhite(gameEvals[i], mainHistory[i].fen);
    const cls = gameClassifications[i];
    let up = '', dn = '', evTxt = '';
    if (w !== null) {
      evTxt = ' · ' + evText(gameEvals[i]);
      const d = (w - 50) / 50 * 100;
      if (d > 0.5) up = `<i class="${cls === 'book' ? 'book' : ''}" style="height:${d.toFixed(1)}%"></i>`;
      else if (d < -0.5) dn = `<i style="height:${(-d).toFixed(1)}%"></i>`;
    }
    const flag = (gameAnalyzed && moms.has(i) && cls) ? `<span class="cb xs ${cls}">${MOVE_META[cls].symbol}</span>` : '';
    b.innerHTML = `<span class="gb-f">${flag}</span><span class="gb-u">${up}</span><span class="gb-d">${dn}</span>`;
    b.title = moveLabel(i) + evTxt + (cls ? ' · ' + t('cls_' + cls) : '');
    b.onclick = () => goToIndex(i, { sound: true });
    el.appendChild(b);
  }
}

window.addEventListener('resize', () => { fitBoard(); renderArrows(); renderMoveBadge(); });

// ── Start ──────────────────────────────────────────────────────────────────
init();
renderMoveList();
