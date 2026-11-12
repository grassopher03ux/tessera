# Credits and third-party licenses

**Tessera** — chess game review, openings and puzzles from your own games.
Copyright © 2026 Mattia Colombo.

Tessera is free software: you can redistribute it and/or modify it under the terms of the
GNU General Public License as published by the Free Software Foundation, either version 3
of the License, or (at your option) any later version. See [`LICENSE`](LICENSE).

The Tessera name, logo, move icons and interface design are by Mattia Colombo.

---

## Chess engine

**Stockfish 18** — GPL-3.0 — © The Stockfish developers
<https://stockfishchess.org> · source code: <https://github.com/official-stockfish/Stockfish> (tag `sf_18`)

Tessera talks to Stockfish as a separate program through the UCI protocol. The release
packages include the official, unmodified Windows builds
(`stockfish-windows-x86-64-avx2.exe` and `stockfish-windows-x86-64.exe`). Their
complete corresponding source code is available at the link above, and the license is the
same GPL-3.0 found in `LICENSE`.

## Libraries

| Component | Use in Tessera | License | Author |
| --- | --- | --- | --- |
| [python-chess](https://github.com/niklasf/python-chess) | rules, PGN, engine communication | GPL-3.0-or-later | Niklas Fiekas |
| [chess.js](https://github.com/jhlywa/chess.js) 0.10.3 (`static/chess-0.10.3.js`) | rules in the browser | BSD-2-Clause | Jeff Hlywa |
| [Flask](https://flask.palletsprojects.com) | local web server | BSD-3-Clause | Pallets |
| [Flask-CORS](https://github.com/corydolphin/flask-cors) | local web server | MIT | Cory Dolphin |
| [Requests](https://requests.readthedocs.io) | game download | Apache-2.0 | Kenneth Reitz and contributors |
| [OpenAI Python](https://github.com/openai/openai-python) | optional AI comments | Apache-2.0 | OpenAI |
| [python-dotenv](https://github.com/theskumar/python-dotenv) | reads the optional `.env` key | BSD-3-Clause | Saurabh Kumar |
| [PyInstaller](https://pyinstaller.org) | builds `Tessera.exe` | GPL-2.0 with bootloader exception | PyInstaller team |

## Data

- **Opening names** (`a.tsv` … `e.tsv`, `openings_cache.json`): from
  [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), dedicated to
  the public domain under **CC0-1.0**.
- **Your games** are downloaded from the public
  [chess.com Published-Data API](https://www.chess.com/news/view/published-data-api) and
  stay on your computer, in `chess_reviewer.db`.

## Graphics and fonts

- **Chess pieces** (`static/pieces/`): the *cburnett* set by Colin M. L. Burnett,
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces),
  **CC BY-SA 3.0**, recolored with the Tessera palette.
- **IBM Plex Mono** and **IBM Plex Sans Condensed** (`static/fonts/`): © IBM Corp.,
  **SIL Open Font License 1.1** (`static/fonts/OFL.txt`).
- **Cinzel** (`static/fonts/`): © The Cinzel Project Authors,
  **SIL Open Font License 1.1** (`static/fonts/OFL-Cinzel.txt`).

## Trademarks

Tessera is an independent project. It is not affiliated with, endorsed by or sponsored by
Chess.com, Lichess, the Stockfish project or OpenAI. Their names are used only to describe
compatibility.
