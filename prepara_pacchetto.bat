@echo off
chcp 65001 >nul
title Tessera - pacchetto per un amico
cd /d "%~dp0"
echo.
echo  ================================================
echo   Tessera - pacchetto pulito per un amico
echo  ================================================
echo.
python --version >nul 2>&1
if errorlevel 1 (
  echo  [ERRORE] Python non trovato.
  pause
  exit /b 1
)
echo  [1/3] Dipendenze e PyInstaller...
pip install -r requirements.txt -q --disable-pip-version-check
pip install pyinstaller -q --disable-pip-version-check
echo  [2/3] Creo l'exe (2-5 minuti)...
if exist "dist\Tessera.exe" del /f "dist\Tessera.exe"
if exist "build" rmdir /s /q "build"
python -m PyInstaller chess_reviewer.spec --clean --noconfirm
if not exist "dist\Tessera.exe" (
  echo.
  echo  [ERRORE] L'exe non e' stato creato: guarda i messaggi sopra.
  pause
  exit /b 1
)
echo  [3/3] Preparo la cartella pulita e lo zip...
python prepara_pacchetto.py
if errorlevel 1 (
  pause
  exit /b 1
)
explorer "Tessera_amico"
pause
