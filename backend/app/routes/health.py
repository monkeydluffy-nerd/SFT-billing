from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.excel.workbook import WORKBOOK_PATH
from app.excel.constants import ALL_SHEETS
from app.excel.workbook import load_workbook_safely

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health_check() -> dict:
    try:
        wb = load_workbook_safely()
        sheets_ok = all(name in wb.sheetnames for name in ALL_SHEETS)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Workbook unavailable: {exc}") from exc
    return {
        "status": "ok",
        "workbook": str(WORKBOOK_PATH),
        "workbookExists": WORKBOOK_PATH.exists(),
        "sheets": ALL_SHEETS,
        "sheetsOk": sheets_ok,
    }
