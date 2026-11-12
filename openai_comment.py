"""
openai_comment.py — commento in linguaggio naturale via OpenAI.

Legge OPENAI_API_KEY dall'ambiente (o da un file .env nella stessa cartella).
Se la chiave manca o la chiamata fallisce, restituisce stringa vuota
senza sollevare eccezioni: l'app continua a funzionare.
"""

from __future__ import annotations
import os
import json
from pathlib import Path

# ── Costanti ───────────────────────────────────────────────────────────────

_SYSTEM_IT = (
    "Sei un commentatore di scacchi. Spieghi in italiano, in 2-3 frasi "
    "chiare, una mossa GIÀ analizzata da un motore. Basati SOLO sui dati "
    "ricevuti: non calcolare varianti tue, non inventare mosse o minacce. "
    "Non citare i centipawn grezzi, traducili in concetti (vantaggio, parità...). "
    "Tono diretto, livello giocatore intermedio."
)

_SYSTEM_EN = (
    "You are a chess commentator. Explain in English, in 2-3 clear sentences, "
    "a move ALREADY analyzed by an engine. Base yourself ONLY on the data provided: "
    "do not calculate your own variations, do not invent moves or threats. "
    "Do not quote raw centipawn values — translate them into concepts "
    "(advantage, equality, winning, etc.). "
    "Direct tone, intermediate player level."
)

_SYSTEMS = {'it': _SYSTEM_IT, 'en': _SYSTEM_EN}

_SYSTEM_OPENING_IT = (
    "Sei un maestro di scacchi. Spiega in 3-4 frasi chiare le idee strategiche "
    "di questa apertura: cosa persegue il giocatore, i piani tipici dei pezzi, "
    "i vantaggi strutturali e cosa dà strategicamente contro l'avversario. "
    "Tono diretto, livello giocatore intermedio."
)

_SYSTEM_OPENING_EN = (
    "You are a chess master. In 3-4 clear sentences, explain the strategic ideas "
    "of this opening: what the player aims for, typical piece plans, structural "
    "advantages, and what it gives strategically against the opponent. "
    "Direct tone, intermediate player level."
)

_SYSTEMS_OPENING = {'it': _SYSTEM_OPENING_IT, 'en': _SYSTEM_OPENING_EN}


def _load_config(app_dir: Path) -> dict:
    cfg_file = app_dir / "config.json"
    if cfg_file.exists():
        try:
            return json.loads(cfg_file.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def _ensure_env(app_dir: Path) -> None:
    """Carica .env se python-dotenv è disponibile."""
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv(app_dir / ".env", override=False)
    except ImportError:
        pass


# ── API pubblica ───────────────────────────────────────────────────────────

def get_comment(
    app_dir: Path,
    fen: str,
    move_san: str,
    eval_before: str,
    eval_after: str,
    classification: str,
    best_move_san: str,
    pv_san: str,
    lang: str = "it",
) -> str:
    """
    Chiama OpenAI e restituisce il commento nella lingua richiesta.
    lang: 'it' (default) oppure 'en'.
    Ritorna '' in caso di chiave mancante o errore.
    """
    _ensure_env(app_dir)

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return ""

    cfg    = _load_config(app_dir)
    model  = cfg.get("openai_model", "gpt-4.1-mini")
    system = _SYSTEMS.get(lang, _SYSTEM_IT)

    if lang == "en":
        user_msg = (
            f"FEN: {fen}\n"
            f"Move played: {move_san}\n"
            f"Evaluation before (White): {eval_before}\n"
            f"Evaluation after (White): {eval_after}\n"
            f"Classification: {classification}\n"
            f"Best move: {best_move_san}\n"
            f"Main line: {pv_san}"
        )
    else:
        user_msg = (
            f"FEN: {fen}\n"
            f"Mossa giocata: {move_san}\n"
            f"Valutazione prima (Bianco): {eval_before}\n"
            f"Valutazione dopo (Bianco): {eval_after}\n"
            f"Classificazione: {classification}\n"
            f"Mossa migliore: {best_move_san}\n"
            f"Linea principale: {pv_san}"
        )

    try:
        import openai  # type: ignore
        client = openai.OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=model,
            temperature=0.3,
            max_tokens=220,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user_msg},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception as ex:
        print(f"[openai_comment] errore: {ex}")
        return ""


def get_opening_explanation(
    app_dir: Path,
    context: str,
    lang: str = "it",
) -> str:
    """
    Spiega le idee strategiche di un'apertura dato il campo context.
    lang: 'it' (default) oppure 'en'.
    Ritorna '' in caso di chiave mancante o errore.
    """
    _ensure_env(app_dir)

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        return ""

    cfg    = _load_config(app_dir)
    model  = cfg.get("openai_model", "gpt-4.1-mini")
    system = _SYSTEMS_OPENING.get(lang, _SYSTEM_OPENING_IT)

    try:
        import openai  # type: ignore
        client = openai.OpenAI(api_key=api_key)
        resp = client.chat.completions.create(
            model=model,
            temperature=0.4,
            max_tokens=300,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": context},
            ],
        )
        return resp.choices[0].message.content.strip()
    except Exception as ex:
        print(f"[openai_comment] errore explain-opening: {ex}")
        return ""
