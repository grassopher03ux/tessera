"""prepara_pacchetto.py — crea una copia PULITA di Tessera da passare a un amico.

Cosa mette nella cartella  Tessera_amico  (e nello zip):
  • l'app (l'exe creato da build.bat, cartella dist)
  • Stockfish (versione AVX2 + versione compatibile, se presenti)
  • il database delle aperture (openings_cache.json e i file a–e.tsv)
  • un config.json NUOVO: nessun username, Stockfish cercato nella cartella dell'app
  • LEGGIMI.txt

Cosa NON mette mai: il tuo chess_reviewer.db (partite, analisi, puzzle, progressi),
il tuo config.json, .env (chiave OpenAI), backup, .git, cartelle di lavoro.
La tua copia dell'app non viene toccata.
"""
import json
import shutil
import sys
import zipfile
from pathlib import Path

APP = Path(__file__).resolve().parent
DIST = APP / 'dist'
OUT = APP / 'Tessera_amico'
ZIP = APP / 'Tessera_amico.zip'

STOCKFISH = ['stockfish-windows-x86-64-avx2.exe', 'stockfish-windows-x86-64.exe']
OPENINGS = ['openings_cache.json'] + [f'{l}.tsv' for l in 'abcde']
NEVER = {'chess_reviewer.db', 'chess_reviewer.db-wal', 'chess_reviewer.db-shm', 'config.json', '.env'}

CONFIG = {
    'stockfish_path': STOCKFISH[0],          # relativo: l'app lo cerca nella sua cartella
    'depth': 18,
    'openai_model': 'gpt-4.1-mini',
    'brilliant_enabled': True,
    'review_multipv': 2,
    'host': '127.0.0.1',
    'chesscom_username': '',
    'insights_scope': {'time_classes': ['rapid', 'blitz'], 'months': 3},
}

LEGGIMI = """TESSERA
=======

COME SI AVVIA
1. Estrai questa cartella dove vuoi (es. Documenti). Puoi spostarla quando vuoi,
   ma tieni insieme tutti i file: l'app, Stockfish e il resto devono restare
   nella stessa cartella.
2. Doppio clic su {exe}.
   Se Windows mostra "PC protetto da Windows": "Ulteriori informazioni" → "Esegui comunque".
   Si apre una finestra nera (è il motore dell'app): lasciala aperta finché usi l'app.
3. Si apre il browser su http://localhost:5000
   Al primo avvio scrivi il tuo username chess.com: l'app importa le partite
   degli ultimi 3 mesi, le analizza con Stockfish e prepara le aperture.
   Ci vuole qualche minuto, ma puoi già usarla.

COME FUNZIONA
- In alto a destra c'è un ? che lampeggia: aprilo, è una guida di 6 schede.
- "GIOCATORE" in alto: cambi username e l'app importa le partite del nuovo nome.
- Night / Lattice cambia il tema, IT / EN la lingua.

SUPPORTA TESSERA
Tessera è gratuita e open source. Se ti è utile puoi offrirmi un caffè:
   https://paypal.me/MattiaColombo284
(anche dal menu a sinistra, voce "Supporta").
Codice sorgente e aggiornamenti: https://github.com/grassopher03ux/tessera

PER CHIUDERE
Chiudi la scheda del browser e la finestra nera.

COLLEGARE L'AI (facoltativo)
I commenti scritti alle mosse e le spiegazioni delle aperture usano OpenAI,
con una tua chiave API (a pagamento, si crea su platform.openai.com).
1. Apri il Blocco note e scrivi una sola riga, senza spazi e senza virgolette:
       OPENAI_API_KEY=sk-la-tua-chiave
2. File → Salva con nome → scegli QUESTA cartella (dove c'è {exe}),
   "Salva come": Tutti i file (*.*), "Nome file": .env
   (deve chiamarsi esattamente .env, non .env.txt)
3. Chiudi e riapri l'app: nella barra in alto "NO AI" diventa "AI".
La chiave resta solo sul tuo PC. Senza .env l'app funziona lo stesso,
solo senza i commenti scritti dall'AI.

NOTE
- Stockfish è già incluso (due versioni: se il PC è vecchio usa da sola quella compatibile).
- Le tue partite e i tuoi progressi restano in questa cartella, nel file chess_reviewer.db.
  Non cancellarlo se vuoi tenerli.
- Tessera è software libero (GPL-3.0): vedi LICENSE. Crediti e licenze di Stockfish,
  python-chess, font e pezzi sono in CREDITS.md.
"""


def fail(msg):
    print('\n  ERRORE: ' + msg)
    sys.exit(1)


def find_app():
    """L'exe creato da PyInstaller: un file singolo in dist/ oppure una cartella dist/<nome>/."""
    if not DIST.is_dir():
        fail('non trovo la cartella "dist". Prima va creato l\'exe con build.bat.')
    pref = DIST / 'Tessera.exe'
    if pref.is_file():
        return pref, None
    exes = [p for p in DIST.rglob('*.exe') if not p.name.lower().startswith('stockfish')]
    if not exes:
        fail('in "dist" non c\'è nessun exe. Lancia prima build.bat.')
    exe = max(exes, key=lambda p: p.stat().st_mtime)
    return exe, (exe.parent if exe.parent != DIST else None)


def main():
    print('Preparo la copia pulita di Tessera...\n')
    exe, onedir = find_app()

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()

    # 1. l'app
    if onedir:
        for item in onedir.iterdir():
            if item.name in NEVER:
                continue
            dst = OUT / item.name
            shutil.copytree(item, dst) if item.is_dir() else shutil.copy2(item, dst)
    else:
        shutil.copy2(exe, OUT / exe.name)
    print(f'  app            {exe.name}')

    # 2. Stockfish
    found = [n for n in STOCKFISH if (APP / n).is_file()]
    if not found:
        fail('non trovo Stockfish accanto all\'app (' + ' / '.join(STOCKFISH) + ').')
    for n in found:
        shutil.copy2(APP / n, OUT / n)
        print(f'  stockfish      {n}')
    if STOCKFISH[0] not in found:
        CONFIG['stockfish_path'] = found[0]

    # 3. database delle aperture
    for n in OPENINGS:
        if (APP / n).is_file():
            shutil.copy2(APP / n, OUT / n)
    print('  aperture       openings_cache.json + a–e.tsv')

    # 4. config nuovo e istruzioni
    (OUT / 'config.json').write_text(json.dumps(CONFIG, indent=2, ensure_ascii=False), encoding='utf-8')
    (OUT / 'LEGGIMI.txt').write_text(LEGGIMI.format(exe=exe.name), encoding='utf-8')
    print('  config.json    nuovo, senza username')
    for n in ('LICENSE', 'CREDITS.md'):                 # licenza GPL-3.0 e crediti (servono con Stockfish)
        if (APP / n).is_file():
            shutil.copy2(APP / n, OUT / n)
    print('  licenza        LICENSE + CREDITS.md')

    # 5. controllo: niente dati personali
    leaked = [p for p in OUT.rglob('*') if p.name in NEVER - {'config.json'}]
    if leaked:
        fail('nel pacchetto è finito un file personale: ' + ', '.join(str(p) for p in leaked))

    # 6. zip
    if ZIP.exists():
        ZIP.unlink()
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in OUT.rglob('*'):
            if p.is_file():
                z.write(p, Path('Tessera') / p.relative_to(OUT))
    mb = ZIP.stat().st_size / 1e6
    print(f'\nFatto.\n  Cartella: {OUT}\n  Zip:      {ZIP}  ({mb:.0f} MB)\n')
    print('Manda lo zip al tuo amico (es. WeTransfer o Google Drive).')


if __name__ == '__main__':
    main()
