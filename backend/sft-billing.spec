# -*- mode: python ; coding: utf-8 -*-
# Desktop build: launcher + API + bundled web UI + seed database.
ROOT = '..'

a = Analysis(
    ['launcher.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('app', 'app'),
        ('migrations', 'migrations'),
        ('alembic.ini', '.'),
        (ROOT + '/sft-billing-phase2.2-gst/sft-billing/dist', 'web'),
        (ROOT + '/installer/seed/sft_billing.db', 'seed'),
    ],
    hiddenimports=[
        'uvicorn', 'uvicorn.logging', 'uvicorn.loops.auto', 'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets.auto', 'uvicorn.lifespan.on',
        'fastapi', 'openpyxl', 'pydantic', 'pydantic_core', 'email_validator', 'starlette',
        'typing_extensions', 'annotated_types', 'anyio', 'idna', 'click', 'h11', 'multipart',
        'passlib.handlers.bcrypt', 'passlib.handlers.pbkdf2', 'reportlab', 'PIL',
        'app.services.xlsx_pdf_renderer', 'app.services.invoice_pdf_service',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=['IPython', 'pytest', 'jupyter', 'notebook', 'tkinter', 'numpy', 'pandas', 'scipy', 'matplotlib',
              'pythoncom', 'pywintypes', 'win32com'],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='SFT Billing',
    debug=False,
    strip=False,
    upx=False,
    console=False,
    icon=ROOT + '/installer/app.ico',
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='SFT Billing')
