@echo off
title Tessera - Build EXE
color 0A
echo.
echo  ================================================
echo   Tessera - Creazione Eseguibile Windows
echo  ================================================
echo.

cd /d "%~dp0"

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERRORE] Python non trovato.
    echo  Installa Python da https://python.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo  Python trovato: %PYVER%
echo.

:: Install/upgrade pip tools
echo  [1/4] Aggiornamento pip e strumenti...
python -m pip install --upgrade pip setuptools wheel -q

:: Install all requirements
echo  [2/4] Installazione dipendenze...
pip install -r requirements.txt -q
if errorlevel 1 (
    echo  [ERRORE] Impossibile installare le dipendenze.
    pause
    exit /b 1
)

:: Install PyInstaller
echo  [3/4] Installazione PyInstaller...
pip install pyinstaller -q
if errorlevel 1 (
    echo  [ERRORE] Impossibile installare PyInstaller.
    pause
    exit /b 1
)

:: Clean previous build
echo  [4/4] Compilazione eseguibile (puo' richiedere 2-5 minuti)...
if exist "dist\Tessera.exe" del /f "dist\Tessera.exe"
if exist "build" rmdir /s /q "build"

python -m PyInstaller chess_reviewer.spec --clean --noconfirm
if errorlevel 1 (
    echo.
    echo  [ERRORE] Build fallita. Controlla i messaggi sopra.
    pause
    exit /b 1
)

:: Verify output
if not exist "dist\Tessera.exe" (
    echo  [ERRORE] File exe non trovato dopo la build.
    pause
    exit /b 1
)

:: Get file size
for %%A in ("dist\Tessera.exe") do set FILESIZE=%%~zA
set /a SIZEMB=%FILESIZE% / 1048576

echo.
echo  ================================================
echo   BUILD COMPLETATA CON SUCCESSO!
echo  ================================================
echo.
echo   File: dist\Tessera.exe
echo   Dimensione: ~%SIZEMB% MB
echo.
echo   ISTRUZIONI:
echo   1. Copia dist\Tessera.exe dove vuoi
echo   2. Doppio clic per avviare
echo   3. Il browser si apre automaticamente
echo   4. Configura il percorso Stockfish dal menu Impostazioni
echo.
echo   NOTA: La prima volta che esegui potrebbe comparire
echo   un avviso di Windows SmartScreen - clicca
echo   "Ulteriori informazioni" poi "Esegui comunque".
echo.

set /p OPEN="Aprire la cartella dist? (s/n): "
if /i "%OPEN%"=="s" explorer dist

pause
