/* player.js — giocatore collegato (chip in alto) e primo avvio.
   L'username chess.com decide di chi sono partite, puzzle, statistiche e saluto. */
(function () {
  'use strict';
  const PL = window.PL = { name: '', names: [], open: false, job: null };
  const I18N = {
    it: {
      chip: 'GIOCATORE', chipAdd: '+ GIOCATORE', chipTitle: 'Giocatore collegato: cambia username chess.com',
      popK: 'GIOCATORE COLLEGATO', popNote: 'Cambiando nome, statistiche, puzzle e saluto seguono il nuovo giocatore. Le partite del nuovo nome vengono importate.',
      cancel: 'Annulla', saveImport: 'Salva e importa',
      wK: 'PRIMO AVVIO', wTitle: 'Benvenuto in Tessera',
      wP: 'Scrivi il tuo username chess.com: l’app importa le tue partite e prepara analisi, puzzle e aperture. Il tuo nome comparirà in alto e nei saluti.',
      wRunP: 'Ci vuole qualche minuto. Puoi chiudere questa finestra: il lavoro continua e i numeri compaiono man mano.',
      wLabel: 'USERNAME CHESS.COM', wPh: 'il tuo username', wHelp: 'Se hai più account, separali con una virgola.',
      s1: 'Importo le partite degli ultimi 3 mesi', s1d: 'da chess.com, rapid e blitz', s1ok: '{n} partite importate', s1none: 'Nessuna partita trovata negli ultimi 3 mesi',
      s2: 'Le analizzo con Stockfish', s2d: 'continua da solo: puoi già usare l’app', s2run: 'Analisi con Stockfish · {a} di {b}', s2ok: '{n} partite analizzate',
      s3: 'Costruisco le aperture', s3run: 'Costruisco le aperture · {a} di {b}', s3ok: 'Aperture pronte',
      later: 'Più tardi', start: 'Inizia', goApp: 'Vai all’app', retry: 'Riprova', close: 'Chiudi',
      needName: 'Scrivi un username.', noEngine: 'Stockfish non trovato: l’analisi partirà quando sarà disponibile.',
      supK: 'SUPPORTA TESSERA', supH: 'Tessera è gratuita e open source.',
      supP: 'La sviluppo nel tempo libero. Se ti è utile, puoi offrirmi un caffè: aiuta a coprire il tempo che ci metto e le prossime funzioni.',
      supCoffee: 'Offrimi un caffè', supStar: 'Lascia una stella', supStarD: 'GitHub · gratis, aiuta altri a trovarla', supOpen: 'Apri nel browser ↗',
      supNote: 'Il link si apre nel browser. L’app non invia nessun dato e questa finestra si apre solo se la apri tu.', supThanks: 'GRAZIE',
      tSup: 'Tessera è gratuita e open source. Se ti piace, puoi supportarla con un caffè.', tSupLink: 'Supporta il progetto →',
      tHelp: 'Come funziona', tK: 'COME FUNZIONA · {i} DI {n} · {t}', tSkip: 'Salta la guida', tPrev: 'Indietro', tNext: 'Avanti', tEnd: 'Fine',
      legNew: 'Nuova', legNewD: 'mai aperta', legSeen: 'Vista', legSeenD: 'studiata, drill sbloccato', legDue: 'Da ripassare', legDueD: 'torna oggi', legOk: 'Imparata', legOkD: 'drill fatto',
      slides: [
        ['home', 'Home', 'Tre cose per oggi', ['L’ultima partita con il momento chiave.', 'I puzzle nati dai tuoi errori.', 'Come stai andando rispetto a prima.'], 'Ogni card ti porta nella sua sezione.'],
        ['game', 'Partita', 'Rivedi una partita', ['Importa un PGN o aprila dall’Archivio.', '“Analizza la partita”: Stockfish valuta ogni mossa.', 'Icone: !! brillante · ★ migliore · ?! · ? · ?? errore grave.'], 'Le frecce ◀ ▶ (o la tastiera) scorrono le mosse.'],
        ['openings', 'Aperture', 'Studia il tuo repertorio', ['Livello 1: le tue aperture. Livello 2: i rami. Livello 3: la scacchiera.', 'Studia una linea fino in fondo, poi fai il drill (il prisma col cappello).', '“Ripasso di oggi”: le carte tornano a intervalli sempre più lunghi.'], 'legend'],
        ['stats', 'Statistiche', 'Sto migliorando?', ['Sei domande: precisione, errori, tattiche, aperture, fasi, avversari.', 'Ogni tema è diviso in Da lavorare · Migliorato · Stabile.', 'Clic su un tema: gli esempi sulla scacchiera, in un pop-up.'], 'Prima → ora confronta le ultime 30 partite con le 30 precedenti.'],
        ['puzzle', 'Puzzle', 'Allenati sui tuoi errori', ['Ogni errore grave delle tue partite diventa un puzzle.', 'Il percorso a prismi segna quelli risolti.', 'Hint e difficoltà nella barra in basso.'], ''],
        ['space', 'Il tuo spazio', 'Giocatore, tema e lingua', ['GIOCATORE in alto: cambi username e l’app importa le sue partite.', 'Night / Lattice cambia il tema, IT / EN la lingua.', 'Il ? accanto al giocatore riapre questa guida quando vuoi.'], ''],
      ],
    },
    en: {
      chip: 'PLAYER', chipAdd: '+ PLAYER', chipTitle: 'Linked player: change chess.com username',
      popK: 'LINKED PLAYER', popNote: 'When you change name, stats, puzzles and greeting follow the new player. The new name’s games are imported.',
      cancel: 'Cancel', saveImport: 'Save and import',
      wK: 'FIRST RUN', wTitle: 'Welcome to Tessera',
      wP: 'Type your chess.com username: the app imports your games and prepares analysis, puzzles and openings. Your name will appear at the top and in greetings.',
      wRunP: 'This takes a few minutes. You can close this window: the work goes on and numbers appear as they are ready.',
      wLabel: 'CHESS.COM USERNAME', wPh: 'your username', wHelp: 'If you have more accounts, separate them with a comma.',
      s1: 'Importing games from the last 3 months', s1d: 'from chess.com, rapid and blitz', s1ok: '{n} games imported', s1none: 'No games found in the last 3 months',
      s2: 'Analyzing them with Stockfish', s2d: 'runs on its own: you can already use the app', s2run: 'Stockfish analysis · {a} of {b}', s2ok: '{n} games analyzed',
      s3: 'Building the openings', s3run: 'Building the openings · {a} of {b}', s3ok: 'Openings ready',
      later: 'Later', start: 'Start', goApp: 'Go to the app', retry: 'Retry', close: 'Close',
      needName: 'Type a username.', noEngine: 'Stockfish not found: analysis will start when it is available.',
      supK: 'SUPPORT TESSERA', supH: 'Tessera is free and open source.',
      supP: 'I build it in my spare time. If you find it useful, you can buy me a coffee: it helps cover the time it takes and the next features.',
      supCoffee: 'Buy me a coffee', supStar: 'Leave a star', supStarD: 'GitHub · free, helps others find it', supOpen: 'Open in browser ↗',
      supNote: 'The link opens in your browser. The app sends no data, and this window only opens when you open it.', supThanks: 'THANK YOU',
      tSup: 'Tessera is free and open source. If you like it, you can support it with a coffee.', tSupLink: 'Support the project →',
      tHelp: 'How it works', tK: 'HOW IT WORKS · {i} OF {n} · {t}', tSkip: 'Skip the guide', tPrev: 'Back', tNext: 'Next', tEnd: 'Done',
      legNew: 'New', legNewD: 'never opened', legSeen: 'Seen', legSeenD: 'studied, drill unlocked', legDue: 'Due', legDueD: 'back today', legOk: 'Learned', legOkD: 'drill done',
      slides: [
        ['home', 'Home', 'Three things for today', ['Your last game with its key moment.', 'Puzzles born from your mistakes.', 'How you are doing compared with before.'], 'Each card takes you to its section.'],
        ['game', 'Game', 'Review a game', ['Import a PGN or open it from the Archive.', '“Analyze the game”: Stockfish rates every move.', 'Icons: !! brilliant · ★ best · ?! · ? · ?? blunder.'], 'The ◀ ▶ arrows (or the keyboard) step through the moves.'],
        ['openings', 'Openings', 'Study your repertoire', ['Level 1: your openings. Level 2: the branches. Level 3: the board.', 'Study a line to the end, then drill it (the prism with the cap).', '“Today’s review”: cards come back at longer and longer intervals.'], 'legend'],
        ['stats', 'Stats', 'Am I improving?', ['Six questions: accuracy, mistakes, tactics, openings, phases, opponents.', 'Each theme is grouped as To work on · Improved · Stable.', 'Click a theme: examples on the board, in a pop-up.'], 'Before → now compares your last 30 games with the 30 before.'],
        ['puzzle', 'Puzzle', 'Train on your mistakes', ['Every blunder in your games becomes a puzzle.', 'The prism path marks the ones you solved.', 'Hint and difficulty in the bottom bar.'], ''],
        ['space', 'Your space', 'Player, theme and language', ['PLAYER at the top: change username and the app imports their games.', 'Night / Lattice switches the theme, IT / EN the language.', 'The ? next to the player reopens this guide whenever you like.'], ''],
      ],
    },
  };
  const tr = (k, v) => {
    const lang = typeof currentLang !== 'undefined' ? currentLang : 'it';
    let s = (I18N[lang === 'en' ? 'en' : 'it'] || I18N.it)[k] || k;
    if (typeof s !== 'string') return s;
    if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]);
    return s;
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  async function api(url, body) {
    try {
      const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
      const d = await r.json().catch(() => ({}));
      if (!r.ok && d && !d.error) d.error = 'HTTP ' + r.status;
      return d || {};
    } catch (ex) { return { error: String(ex) }; }
  }
  const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  // Link per le donazioni. github: indirizzo del repository quando esiste (vuoto = la card della stella non compare).
  const SUPPORT = { paypal: 'https://paypal.me/MattiaColombo284', github: 'https://github.com/grassopher03ux/tessera' };
  const CUP = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3.5c0 1 1 1.5 1 2.5M12 3.5c0 1 1 1.5 1 2.5"/></svg>';
  const STAR = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';

  // ── chip in alto ─────────────────────────────────────────────────────
  function paintChip() {
    const b = $('plChip');
    if (!b) return;
    const busy = PL.job && PL.job.phase !== 'done' && PL.job.phase !== 'error';
    b.classList.toggle('empty', !PL.name);
    b.classList.toggle('on', PL.open);
    b.classList.toggle('busy', !!busy);
    b.title = tr('chipTitle');
    b.setAttribute('aria-expanded', String(PL.open));
    b.innerHTML = PL.name
      ? `<i aria-hidden="true"></i><span class="k">${esc(tr('chip'))}</span><b>${esc(PL.name)}</b><span aria-hidden="true">${PL.open ? '▴' : '▾'}</span>`
      : `<span>${esc(tr('chipAdd'))}</span>`;
  }
  async function loadName() {
    const s = await api('/api/rep/settings');
    PL.names = String(s.chesscom_username || s.suggested_username || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean);
    PL.name = PL.names[0] || '';
    PL.saved = String(s.chesscom_username || '');
    paintChip();
    return s;
  }

  function closePop() {
    const p = $('plPop'); if (p) p.remove();
    PL.open = false; paintChip();
  }
  function openPop() {
    if (!PL.name) { openWelcome(); return; }
    if (PL.open) { closePop(); return; }
    PL.open = true; paintChip();
    const chip = $('plChip').getBoundingClientRect();
    const p = document.createElement('div');
    p.id = 'plPop'; p.className = 'pl-pop'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', tr('popK'));
    p.style.top = Math.round(chip.bottom + 8) + 'px';
    p.style.right = Math.max(12, Math.round(window.innerWidth - chip.right)) + 'px';
    p.innerHTML = `<span class="pl-k">${esc(tr('popK'))}</span>` +
      `<input id="plIn" class="pl-in" type="text" autocomplete="off" spellcheck="false" value="${esc(PL.saved || PL.names.join(', '))}">` +
      `<span class="pl-note">${esc(tr('popNote'))}</span><span class="pl-err" id="plErr"></span>` +
      `<div class="pl-acts"><button type="button" class="pl-btn" data-a="cancel">${esc(tr('cancel'))}</button>` +
      `<button type="button" class="pl-btn pri" data-a="save">${esc(tr('saveImport'))}</button></div>`;
    document.body.appendChild(p);
    const inp = $('plIn'); inp.focus(); inp.select();
    p.addEventListener('click', ev => {
      const a = ev.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'cancel') closePop();
      else if (a.dataset.a === 'save') saveFromPop();
    });
    inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') saveFromPop(); if (ev.key === 'Escape') closePop(); });
  }
  async function saveFromPop() {
    const v = ($('plIn').value || '').trim();
    if (!v) { $('plErr').textContent = tr('needName'); return; }
    closePop();
    if (v === PL.saved) return;
    startJob(v, false);
  }

  // ── primo avvio ─────────────────────────────────────────────────────
  function stepHTML(state, title, sub, pct) {
    const ic = state === 'done' ? '<span class="pl-si done" aria-hidden="true">✓</span>'
      : state === 'run' ? '<span class="pl-si run" aria-hidden="true"><i></i></span>'
      : state === 'err' ? '<span class="pl-si err" aria-hidden="true">!</span>'
      : '<span class="pl-si" aria-hidden="true"></span>';
    return `<div class="pl-step ${state}">${ic}<div><b>${esc(title)}</b><span>${esc(sub)}</span>` +
      (pct != null ? `<span class="pl-bar"><i style="width:${Math.max(2, Math.min(100, pct)).toFixed(0)}%"></i></span>` : '') + '</div></div>';
  }
  function welcomeHTML() {
    const j = PL.job;
    let steps, body, foot;
    if (!j) {
      steps = stepHTML('todo', tr('s1'), tr('s1d')) + stepHTML('todo', tr('s2'), tr('s2d')) + stepHTML('todo', tr('s3'), openingNames());
      body = `<p class="pl-p">${esc(tr('wP'))}</p><label class="pl-lab"><span class="pl-k">${esc(tr('wLabel'))}</span>` +
        `<input id="plWIn" class="pl-in big" type="text" autocomplete="off" spellcheck="false" placeholder="${esc(tr('wPh'))}">` +
        `<span class="pl-help">${esc(tr('wHelp'))}</span><span class="pl-err" id="plWErr"></span></label>`;
      foot = `<button type="button" class="pl-link" data-a="later">${esc(tr('later'))}</button><button type="button" class="pl-btn pri big" data-a="start">${esc(tr('start'))} ▶</button>`;
    } else {
      const s1 = j.phase === 'import' ? stepHTML('run', tr('s1'), tr('s1d'))
        : j.importError ? stepHTML('err', tr('s1'), j.importError)
        : stepHTML('done', j.added || j.seen ? tr('s1ok', { n: j.seen || j.added }) : tr('s1none'), tr('s1d'));
      const a = j.an || {}, b = j.rb || {};
      const s2 = j.phase === 'import' || j.importError ? stepHTML('todo', tr('s2'), tr('s2d'))
        : !j.engine ? stepHTML('err', tr('s2'), tr('noEngine'))
        : a.running ? stepHTML('run', tr('s2run', { a: a.done || 0, b: a.total || 0 }), tr('s2d'), a.total ? 100 * a.done / a.total : 0)
        : stepHTML('done', tr('s2ok', { n: j.analyzed || a.done || 0 }), tr('s2d'));
      const s3 = j.phase === 'import' || j.importError || !j.engine ? stepHTML('todo', tr('s3'), openingNames())
        : b.running ? stepHTML('run', tr('s3run', { a: b.done || 0, b: b.total || 0 }), b.chapter || openingNames(), b.total ? 100 * b.done / b.total : 0)
        : stepHTML('done', tr('s3ok'), openingNames());
      steps = s1 + s2 + s3;
      body = `<p class="pl-p">${esc(tr('wRunP'))}</p>`;
      foot = j.importError
        ? `<button type="button" class="pl-link" data-a="later">${esc(tr('close'))}</button><button type="button" class="pl-btn pri big" data-a="retry">${esc(tr('retry'))}</button>`
        : `<span></span><button type="button" class="pl-btn pri big" data-a="go">${esc(tr('goApp'))} ▶</button>`;
    }
    const k = tr('wK') + (j ? ' · ' + j.name : '');
    return `<section class="pl-dlg" role="dialog" aria-modal="true" aria-label="${esc(tr('wTitle'))}">` +
      `<header class="pl-dh"><span class="pl-k">${esc(k)}</span><h2>${esc(tr('wTitle'))}</h2></header>` +
      `<div class="pl-db">${body}<div class="pl-steps">${steps}</div></div><footer class="pl-df">${foot}</footer></section>`;
  }
  function openingNames() {
    const ch = (window.OP && OP.chapters) || [];
    return ch.length ? ch.map(c => c.name).join(', ') : '';
  }
  function paintWelcome() {
    const w = $('plWel'); if (!w) return;
    const had = document.activeElement && document.activeElement.id === 'plWIn' ? document.activeElement.value : null;
    let dlg = w.querySelector('.pl-dlg');
    const tmp = document.createElement('div'); tmp.innerHTML = welcomeHTML();
    if (!dlg) { w.appendChild(tmp.firstChild); }
    else { dlg.innerHTML = tmp.firstChild.innerHTML; }          // la finestra resta la stessa: niente animazione
    const inp = $('plWIn');
    if (inp) { if (had != null) inp.value = had; inp.focus(); }
  }
  function openWelcome() {
    if ($('plWel')) return;
    const w = document.createElement('div');
    w.id = 'plWel'; w.className = 'pl-wel';
    document.body.appendChild(w);
    paintWelcome();
    w.addEventListener('click', ev => {
      const a = ev.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'later') { lsSet('cr_welcome_later', '1'); closeWelcome(); }
      else if (a.dataset.a === 'go') closeWelcome();
      else if (a.dataset.a === 'retry') { const n = PL.job && PL.job.name; PL.job = null; paintWelcome(); if (n) $('plWIn').value = n; }
      else if (a.dataset.a === 'start') {
        const v = ($('plWIn').value || '').trim();
        if (!v) { $('plWErr').textContent = tr('needName'); $('plWIn').focus(); return; }
        startJob(v, true);
      }
    });
    w.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' && ev.target.id === 'plWIn') w.querySelector('[data-a="start"]').click();
      if (ev.key === 'Escape') { ev.stopPropagation(); if (!PL.job) lsSet('cr_welcome_later', '1'); closeWelcome(); }
    });
  }
  function closeWelcome() { const w = $('plWel'); if (w) w.remove(); }

  // ── lavoro: salva nome → importa → analizza + costruisce aperture ────
  async function startJob(name, fromWelcome) {
    PL.job = { name, phase: 'import', fromWelcome };
    paintWelcome(); paintChip();
    await api('/api/rep/settings', { chesscom_username: name });
    await loadName();
    refreshApp();
    const r = await api('/api/rep/games/sync', { months: 3 });
    if (!r.ok) {
      PL.job.phase = 'error'; PL.job.importError = r.error || 'chess.com';
      paintWelcome(); paintChip();
      return;
    }
    Object.assign(PL.job, { phase: 'work', added: r.added || 0, seen: r.seen || 0 });
    const st = await api('/api/insights/status');
    PL.job.engine = !!st.engine;
    if (PL.job.engine) {
      await api('/api/insights/analyze', {});
      await api('/api/rep/build', {});                 // solo le aperture non ancora costruite
    }
    paintWelcome(); paintChip(); refreshApp();
    poll();
  }
  async function poll() {
    const j = PL.job; if (!j || j.phase !== 'work') return;
    const [a, b] = await Promise.all([api('/api/insights/status'), api('/api/rep/build_status')]);
    j.an = a; j.rb = b; j.analyzed = a.analyzed;
    paintWelcome();
    if (a.running || b.running) { paintChip(); setTimeout(poll, 2000); }
    else { j.phase = 'done'; paintChip(); refreshApp(); }
  }
  function refreshApp() {
    try { if (window.HM && HM.refresh && document.body.classList.contains('hm-active')) HM.refresh(); } catch {}
  }

  // ── guida "Come funziona" (pop-up a schede) ─────────────────────────
  const T = { i: 0 };
  const PR = (k) => {
    const top = k === 'ok' ? '#2ee6d6' : '#123b44', l = k === 'ok' ? '#1fa79c' : '#0c272d', r = k === 'ok' ? '#18897f' : '#0a2025';
    let s = `<svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true"><polygon points="17,2 32,10 17,18 2,10" fill="${top}" stroke="${k === 'new' ? '#2a7c80' : '#2ee6d6'}" stroke-width="1.5"${k === 'new' ? ' stroke-dasharray="3 3" opacity=".7"' : ''}/>` +
      `<polygon points="2,10 17,18 17,24 2,16" fill="${l}"/><polygon points="32,10 17,18 17,24 32,16" fill="${r}"/>`;
    if (k === 'seen') s += '<ellipse cx="28" cy="5" rx="5" ry="3" fill="#f2efe9"/><circle cx="28" cy="5" r="1.5" fill="#0b0d1a"/>';
    if (k === 'due') s += '<circle cx="29" cy="5" r="3.5" fill="#2ee6d6"/>';
    if (k === 'ok') s += '<circle cx="28" cy="5" r="4.5" fill="#f2efe9"/><path d="M25.8 5 l1.6 1.6 l2.8 -3.2" stroke="#0b0d1a" stroke-width="1.4" fill="none"/>';
    return s + '</svg>';
  };
  function slideHTML() {
    const S = tr('slides'), n = S.length, i = Math.max(0, Math.min(T.i, n - 1));
    const [img, name, title, pts, note] = S[i];
    const extra = note === 'legend'
      ? `<div class="tg-leg">${[['new', 'legNew', 'legNewD'], ['seen', 'legSeen', 'legSeenD'], ['due', 'legDue', 'legDueD'], ['ok', 'legOk', 'legOkD']].map(([k, a, b]) =>
          `<div>${PR(k)}<span><b>${esc(tr(a))}</b><small>${esc(tr(b))}</small></span></div>`).join('')}</div>`
      : note ? `<p class="tg-note">${esc(note)}</p>` : '';
    const dots = S.map((_, j) => `<button type="button" class="tg-dot${j === i ? ' on' : ''}" data-tg="${j}" aria-label="${j + 1}"></button>`).join('');
    return `<header class="pl-dh tg-h"><span class="pl-k">${esc(tr('tK', { i: i + 1, n, t: name.toUpperCase() }))}</span>` +
      `<button type="button" class="s3-x tg-x" data-a="tclose" aria-label="${esc(tr('close'))}">×</button></header>` +
      `<div class="tg-b"><div class="tg-img"><img src="/static/tour/${img}.jpg" alt=""></div>` +
      `<div class="tg-tx"><h2>${esc(title)}</h2><ol>${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ol>${extra}` +
      (i === n - 1 ? `<div class="tg-sup">${CUP}<div><span>${esc(tr('tSup'))}</span><button type="button" class="tg-sup-a" data-a="tsup">${esc(tr('tSupLink'))}</button></div></div>` +
        '<p class="tg-credit">PRODUCED AND DESIGNED BY <b>MATTIA COLOMBO</b></p>' : '') + `</div></div>` +
      `<footer class="pl-df"><button type="button" class="pl-link" data-a="tclose">${esc(tr('tSkip'))}</button><div class="tg-dots">${dots}</div>` +
      `<div class="pl-acts"><button type="button" class="pl-btn big" data-tg="${i - 1}"${i ? '' : ' disabled'}>◀ ${esc(tr('tPrev'))}</button>` +
      (i < n - 1 ? `<button type="button" class="pl-btn pri big" data-tg="${i + 1}">${esc(tr('tNext'))} ▶</button>`
                 : `<button type="button" class="pl-btn pri big" data-a="tclose">${esc(tr('tEnd'))} ✓</button>`) + '</div></footer>';
  }
  function paintTour() {
    const w = $('tgWel'); if (!w) return;
    const dlg = w.querySelector('.pl-dlg');                 // stessa finestra: niente animazione tra le schede
    const focusNext = document.activeElement && document.activeElement.closest && document.activeElement.closest('#tgWel');
    dlg.innerHTML = slideHTML();
    if (focusNext) { const b = dlg.querySelector('.pl-btn.pri'); if (b) b.focus({ preventScroll: true }); }
  }
  function openTour(i) {
    lsSet('cr_tour_seen', '1');
    const tb = $('tourBtn'); if (tb) tb.classList.remove('blink');
    if ($('tgWel')) return;
    T.i = i || 0;
    const w = document.createElement('div');
    w.id = 'tgWel'; w.className = 'pl-wel';
    w.innerHTML = `<section class="pl-dlg tg" role="dialog" aria-modal="true" aria-label="${esc(tr('tHelp'))}"></section>`;
    document.body.appendChild(w);
    paintTour();
    const b = w.querySelector('.pl-btn.pri'); if (b) b.focus({ preventScroll: true });
    w.addEventListener('mousedown', ev => { if (ev.target === w) closeTour(); });
    w.addEventListener('click', ev => {
      const el = ev.target.closest('[data-tg],[data-a]'); if (!el || el.disabled) return;
      if (el.dataset.a === 'tclose') closeTour();
      else if (el.dataset.a === 'tsup') { closeTour(); openSupport(); }
      else if (el.dataset.tg != null) { T.i = +el.dataset.tg; paintTour(); }
    });
  }
  function closeTour() { const w = $('tgWel'); if (w) w.remove(); const tb = $('tourBtn'); if (tb) tb.focus({ preventScroll: true }); }

  // ── finestra "Supporta Tessera" (si apre solo dal menu o dalla guida) ──
  function supHTML() {
    const logo = document.querySelector('.brand-ic svg');
    const card = (href, ic, t, d, pri) => `<a class="sp-card${pri ? ' pri' : ''}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">` +
      `<span class="sp-ct">${ic}${esc(t)}</span><span class="sp-cd">${esc(d)}</span><span class="sp-co">${esc(tr('supOpen'))}</span></a>`;
    return `<header class="pl-dh tg-h"><span class="pl-k">${esc(tr('supK'))}</span>` +
      `<button type="button" class="s3-x tg-x" data-a="sclose" aria-label="${esc(tr('close'))}">×</button></header>` +
      `<div class="pl-db"><div class="sp-hero">${logo ? logo.outerHTML.replace(/width="\d+" height="\d+"/, 'width="64" height="75"') : ''}` +
      `<div><h2>${esc(tr('supH'))}</h2><p class="pl-p">${esc(tr('supP'))}</p></div></div>` +
      `<div class="sp-cards${SUPPORT.github ? '' : ' one'}">` +
      card(SUPPORT.paypal, CUP, tr('supCoffee'), 'PayPal · ' + SUPPORT.paypal.replace(/^https?:\/\/(www\.)?/, ''), true) +
      (SUPPORT.github ? card(SUPPORT.github, STAR, tr('supStar'), tr('supStarD'), false) : '') + `</div>` +
      `<p class="pl-note">${esc(tr('supNote'))}</p></div>` +
      `<footer class="pl-df"><button type="button" class="pl-link" data-a="sclose">${esc(tr('close'))}</button>` +
      `<span class="sp-thx">${esc(tr('supThanks'))} · <b>MATTIA COLOMBO</b></span></footer>`;
  }
  function openSupport() {
    if ($('spWel')) return;
    const w = document.createElement('div');
    w.id = 'spWel'; w.className = 'pl-wel';
    w.innerHTML = `<section class="pl-dlg sp" role="dialog" aria-modal="true" aria-label="${esc(tr('supK'))}">${supHTML()}</section>`;
    document.body.appendChild(w);
    const c = w.querySelector('.sp-card'); if (c) c.focus({ preventScroll: true });
    w.addEventListener('mousedown', ev => { if (ev.target === w) closeSupport(); });
    w.addEventListener('click', ev => { if (ev.target.closest('[data-a="sclose"]')) closeSupport(); });
  }
  function closeSupport() { const w = $('spWel'); if (w) w.remove(); const b = $('supBtn'); if (b) b.focus({ preventScroll: true }); }
  window.addEventListener('keydown', ev => {
    if (!$('spWel') || ev.key !== 'Escape') return;
    ev.preventDefault(); ev.stopImmediatePropagation(); closeSupport();
  }, true);
  PL.openSupport = openSupport;
  window.addEventListener('keydown', ev => {
    if (!$('tgWel')) return;
    const n = tr('slides').length;
    // con la guida aperta i tasti non arrivano all'app (niente mosse sulla scacchiera sotto)
    if (['Escape', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(ev.key)) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    if (ev.key === 'Escape') closeTour();
    else if (ev.key === 'ArrowRight' && T.i < n - 1) { T.i++; paintTour(); }
    else if (ev.key === 'ArrowLeft' && T.i > 0) { T.i--; paintTour(); }
  }, true);
  PL.openTour = openTour;

  // ── avvio ───────────────────────────────────────────────────────────
  async function init() {
    const b = $('plChip'); if (!b) return;
    b.addEventListener('click', ev => { ev.stopPropagation(); openPop(); });
    const tb = $('tourBtn');
    if (tb) {
      tb.title = tr('tHelp'); tb.setAttribute('aria-label', tr('tHelp'));
      if (!lsGet('cr_tour_seen')) tb.classList.add('blink');      // primo avvio: il ? lampeggia finché non lo apri
      tb.addEventListener('click', () => openTour(0));
    }
    const sb = $('supBtn'); if (sb) sb.addEventListener('click', openSupport);
    document.addEventListener('mousedown', ev => { if (PL.open && !ev.target.closest('#plPop, #plChip')) closePop(); });
    const s = await loadName();
    // primo avvio: nessun username impostato e nessuna partita in archivio
    if (!s.chesscom_username && !s.suggested_username && !lsGet('cr_welcome_later')) openWelcome();
  }
  PL.translate = () => {
    paintChip(); paintWelcome(); paintTour();
    const sp = document.querySelector('#spWel .pl-dlg'); if (sp) sp.innerHTML = supHTML();
    const tb = $('tourBtn'); if (tb) { tb.title = tr('tHelp'); tb.setAttribute('aria-label', tr('tHelp')); }
  };
  PL.openWelcome = openWelcome;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
