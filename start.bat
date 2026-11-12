@echo off
title Tessera
echo.
echo  ==========================================
echo   Tessera - Avvio
echo  ==========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo  ERRORE: Python non trovato.
    echo  Installa Python da https://python.org
    pause
    exit /b 1
)

echo  Installazione dipendenze...
pip install -r requirements.txt -q --disable-pip-version-check
if errorlevel 1 (
    echo  ERRORE: Impossibile installare le dipendenze.
    pause
    exit /b 1
)

echo  Apertura browser...
timeout /t 2 /nobreak >nul
start http://localhost:5000

echo  Server in esecuzione su http://localhost:5000
echo  Premi Ctrl+C per fermare.
echo.
python server.py
pause
