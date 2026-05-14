"""Minimal EDGAR 13F interface.

Full XML parsing is intentionally deferred. This stub keeps the backend API
shape stable while returning metadata and no holdings for institutional filers.
"""

from __future__ import annotations

from typing import Any


async def fetch_13f_holdings(source_id: str) -> dict[str, Any]:
    """Return placeholder 13F metadata for a CIK or EDGAR source id."""
    return {
        "source_id": source_id,
        "holdings": [],
        "message": "13F XML parsing is not implemented yet.",
    }
