# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['server.py'],
    pathex=[str(Path('.').resolve())],
    binaries=[],
    datas=[
        ('static', 'static'),
    ],
    hiddenimports=[
        # Flask ecosystem
        'flask',
        'flask.helpers',
        'flask.templating',
        'flask_cors',
        'werkzeug',
        'werkzeug.routing',
        'werkzeug.exceptions',
        'werkzeug.middleware',
        'werkzeug.middleware.proxy_fix',
        'werkzeug.serving',
        'jinja2',
        'jinja2.ext',
        'click',
        'itsdangerous',
        # Networking
        'requests',
        'urllib3',
        'certifi',
        'charset_normalizer',
        'idna',
        # Chess / engine
        'stockfish',
        # Anthropic (optional)
        'anthropic',
        'httpx',
        'httpcore',
        'anyio',
        'sniffio',
        'tokenizers',
        # Google Gemini (optional)
        'google.genai',
        'google.genai.types',
        'google.genai.client',
        'google.genai.models',
        'google.genai.chats',
        'google.auth',
        'google.auth.transport',
        'google.auth.transport.requests',
        # Standard lib
        'threading',
        'webbrowser',
        'json',
        'pathlib',
        'shutil',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
        'cv2',
        'PyQt5',
        'PyQt6',
        'wx',
        'test',
        'unittest',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='Tessera',
    icon='tessera.ico',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,       # Keep console: user sees server logs and errors
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
