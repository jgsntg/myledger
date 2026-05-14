"""Quiver Quant API client for congressional trading data.

Quiver slugs are lowercase hyphenated last names, e.g. "nancy-pelosi", "ro-khanna".
Free tier endpoint: GET /beta/live/congresstrading/{slug}
"""

from __future__ import annotations

import re
import logging
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_client: Optional[httpx.AsyncClient] = None

_BASE_URL = "https://api.quiverquant.com"
_AMOUNT_RE = re.compile(r'\$([\d,]+)(?:\s*[-–]\s*\$([\d,]+))?')


async def startup() -> None:
    global _client
    _client = httpx.AsyncClient(
        base_url=_BASE_URL,
        headers={"Authorization": f"Token {settings.quiver_api_token}"},
        timeout=15.0,
    )


async def shutdown() -> None:
    if _client:
        await _client.aclose()


def parse_amount_range(range_str: str | None) -> tuple[Optional[float], Optional[float]]:
    """Parse Quiver's disclosed amount string into (low, high) floats.

    Examples:
        "$15,001 - $50,000"  → (15001.0, 50000.0)
        "$1,001"             → (1001.0, 1001.0)
        "Over $1,000,000"    → (1000000.0, None)
        None / ""            → (None, None)
    """
    if not range_str:
        return (None, None)
    m = _AMOUNT_RE.search(range_str)
    if not m:
        return (None, None)
    low = float(m.group(1).replace(",", ""))
    high = float(m.group(2).replace(",", "")) if m.group(2) else None
    if high is None and "over" not in range_str.lower():
        high = low  # single-value disclosure
    return (low, high)


async def fetch_congress_trades(slug: str) -> list[dict[str, Any]]:
    """Fetch all disclosed trades for a congressional member by Quiver slug."""
    assert _client, "Quiver client not initialized"
    try:
        r = await _client.get(f"/beta/live/congresstrading/{slug}")
        if r.status_code == 401:
            raise httpx.HTTPStatusError(
                "Quiver 401 — check QUIVER_API_TOKEN in your .env",
                request=r.request,
                response=r,
            )
        if r.status_code == 404:
            raise httpx.HTTPStatusError(
                f"Quiver 404 — slug '{slug}' not found. Try e.g. nancy-pelosi",
                request=r.request,
                response=r,
            )
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError:
        raise
    except Exception as e:
        logger.exception("Quiver fetch failed for %s", slug)
        raise RuntimeError(f"Quiver API error: {e}") from e
