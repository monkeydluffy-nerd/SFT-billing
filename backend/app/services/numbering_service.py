"""Invoice numbering: always derives the next number from what's actually
on disk, never from an in-memory counter that could drift after a
restart. Numbers are only ever handed out, never reused or overwritten —
see invoice_service.create_invoice for the corresponding uniqueness check.
"""
from __future__ import annotations

import re

from openpyxl.workbook import Workbook

from app.excel.constants import SHEET_INVOICES
from app.excel.rows import read_rows

INVOICE_PREFIX = "INV-"
_NUMBER_PATTERN = re.compile(rf"^{re.escape(INVOICE_PREFIX)}(\d+)$")

# Starting point when the workbook has no invoices yet at all — matches
# the numbering already visible in the existing frontend demo data
# (INV-1035, INV-1036, ...), so real and demo numbers stay in the same
# range instead of jumping to INV-1.
DEFAULT_START = 1034


def next_invoice_number(wb: Workbook) -> str:
    ws = wb[SHEET_INVOICES]
    rows = read_rows(ws, SHEET_INVOICES)

    highest = DEFAULT_START
    for row in rows:
        number = row.get("number") or row.get("id")
        match = _NUMBER_PATTERN.match(str(row.get("number", "")))
        if match:
            highest = max(highest, int(match.group(1)))

    return f"{INVOICE_PREFIX}{highest + 1}"


def is_invoice_number_taken(wb: Workbook, number: str) -> bool:
    ws = wb[SHEET_INVOICES]
    rows = read_rows(ws, SHEET_INVOICES)
    return any(row.get("number") == number for row in rows)
