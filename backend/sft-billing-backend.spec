# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['app/main.py'],
    pathex=['.'],
    binaries=[],
    datas=[('app', 'app'), ('migrations', 'migrations'), ('alembic.ini', '.')],
    hiddenimports=['uvicorn', 'fastapi', 'openpyxl', 'pydantic', 'pydantic_core', 'email_validator', 'starlette', 'typing_extensions', 'annotated_types', 'watchfiles', 'httptools', 'websockets', 'anyio', 'idna', 'click', 'colorama', 'h11', 'multipart', 'pythoncom', 'pywintypes', 'win32com.client'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'IPython', 'pytest', 'jupyter', 'notebook', 'nbformat', 'ipykernel',
        'sphinx', 'docutils', 'pygments', 'black', 'yapf', 'astroid', 'jedi',
        'parso', 'numpy', 'pandas', 'scipy', 'matplotlib',
    ],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='sft-billing-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)