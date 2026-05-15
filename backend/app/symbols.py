"""Local symbol name lookup backed by NASDAQ trader public files.

Downloads nasdaqlisted.txt and otherlisted.txt at startup (~5400 + ~9000 symbols).
No API key required. Updated daily by NASDAQ.
"""

from __future__ import annotations

import logging
from typing import List

import httpx
from fastapi import APIRouter, Query

logger = logging.getLogger(__name__)

_SOURCES = [
    "https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt",
    "https://www.nasdaqtrader.com/dynamic/symdir/otherlisted.txt",
]

_names: dict[str, str] = {}

router = APIRouter(prefix="/api/symbols", tags=["symbols"])


def _parse(text: str) -> dict[str, str]:
    result: dict[str, str] = {}
    lines = text.strip().splitlines()
    for line in lines[1:]:  # skip header row
        parts = line.split("|")
        if len(parts) < 2:
            continue
        symbol = parts[0].strip()
        raw_name = parts[1].strip()
        if not symbol or symbol.startswith("File Creation"):
            continue
        # "Apple Inc. - Common Stock" → "Apple Inc."
        name = raw_name.split(" - ")[0].strip() if " - " in raw_name else raw_name
        # "JP Morgan Chase & Co. Common Stock" → "JP Morgan Chase & Co."
        for suffix in (" Common Stock", " Ordinary Shares", " Class A", " Class B"):
            if name.endswith(suffix):
                name = name[: -len(suffix)].strip()
        if name:
            result[symbol] = name
    return result


async def load() -> None:
    """Fetch both NASDAQ trader files and populate the in-memory name map."""
    global _names
    combined: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=20.0) as client:
        for url in _SOURCES:
            try:
                r = await client.get(url)
                r.raise_for_status()
                combined.update(_parse(r.text))
            except Exception as e:
                logger.warning("Symbol list fetch failed (%s): %s", url, e)
    _names = combined
    logger.info("Symbol names loaded: %d symbols", len(_names))


@router.get("/names")
async def get_names(symbols: str = Query(..., description="Comma-separated tickers")):
    """Resolve company names from the local NASDAQ/NYSE symbol directory."""
    syms: List[str] = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    return {s: _names[s] for s in syms if s in _names}
