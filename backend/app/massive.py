"""Massive (Polygon.io) API client for enriched market data.

Provides ticker details (sector, industry, market cap, description),
recent news per symbol, and earnings/financials data.

Auth: Bearer token via Authorization header.
Base: https://api.polygon.io
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, timedelta
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_client: Optional[httpx.AsyncClient] = None
_financials_sem: Optional[asyncio.Semaphore] = None

_BASE_URL = "https://api.polygon.io"


async def startup() -> None:
    global _client, _financials_sem
    headers = {}
    if settings.massive_api_key:
        headers["Authorization"] = f"Bearer {settings.massive_api_key}"
    _client = httpx.AsyncClient(
        base_url=_BASE_URL,
        headers=headers,
        timeout=15.0,
    )
    _financials_sem = asyncio.Semaphore(3)


async def shutdown() -> None:
    if _client:
        await _client.aclose()


def _require_client() -> httpx.AsyncClient:
    if not _client:
        raise RuntimeError("Massive client not initialized")
    if not settings.massive_api_key:
        raise httpx.HTTPStatusError(
            "Massive API key missing — add MASSIVE_API_KEY to backend/.env",
            request=httpx.Request("GET", _BASE_URL),
            response=httpx.Response(401),
        )
    return _client


async def fetch_ticker_details(symbol: str) -> dict[str, Any]:
    """Fetch company metadata for a symbol.

    Returns name, sector, industry, market cap, description, homepage_url,
    list_date, and branding (logo/icon URLs if available).
    Polygon endpoint: GET /v3/reference/tickers/{ticker}
    """
    client = _require_client()
    try:
        r = await client.get(f"/v3/reference/tickers/{symbol.upper()}")
        r.raise_for_status()
        return r.json().get("results", {})
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise httpx.HTTPStatusError(
                f"Ticker '{symbol}' not found on Massive",
                request=e.request,
                response=e.response,
            )
        raise
    except Exception as e:
        logger.exception("Massive ticker details failed for %s", symbol)
        raise RuntimeError(f"Massive API error: {e}") from e


async def fetch_news(symbol: str, limit: int = 10) -> list[dict[str, Any]]:
    """Fetch recent news articles for a symbol.

    Returns articles with title, published_utc, article_url, description,
    publisher name/logo, and image_url.
    Polygon endpoint: GET /v2/reference/news
    """
    client = _require_client()
    try:
        r = await client.get(
            "/v2/reference/news",
            params={
                "ticker": symbol.upper(),
                "limit": limit,
                "sort": "published_utc",
                "order": "desc",
            },
        )
        r.raise_for_status()
        return r.json().get("results", [])
    except Exception as e:
        logger.exception("Massive news fetch failed for %s", symbol)
        raise RuntimeError(f"Massive API error: {e}") from e


async def fetch_financials(symbol: str) -> list[dict[str, Any]]:
    """Fetch last 4 quarterly financial statements for a symbol.

    Returns records with start_date, end_date, filing_date, fiscal_period.
    Polygon endpoint: GET /vX/reference/financials
    """
    client = _require_client()
    try:
        r = await client.get(
            "/vX/reference/financials",
            params={
                "ticker": symbol.upper(),
                "limit": 4,
                "timeframe": "quarterly",
                "sort": "filing_date",
                "order": "desc",
            },
        )
        r.raise_for_status()
        return r.json().get("results", [])
    except Exception as e:
        logger.exception("Massive financials fetch failed for %s", symbol)
        raise RuntimeError(f"Massive API error: {e}") from e


async def _earnings_for_symbol(symbol: str) -> Optional[dict[str, Any]]:
    """Derive last + estimated-next earnings dates for a single symbol."""
    sem = _financials_sem or asyncio.Semaphore(1)
    async with sem:
        try:
            records = await fetch_financials(symbol)
        except Exception:
            return None

    # Find most recent record with at least an end_date
    latest = next((r for r in records if r.get("end_date")), None)
    if not latest:
        return None

    last_end_date: str = latest["end_date"]
    last_filing_date: Optional[str] = latest.get("filing_date")
    fiscal_period: str = latest.get("fiscal_period", "")

    # Estimate next earnings: prefer filing_date + 91d, else end_date + 126d
    if last_filing_date:
        base = date.fromisoformat(last_filing_date)
        estimated_next = (base + timedelta(days=91)).isoformat()
    else:
        base = date.fromisoformat(last_end_date)
        estimated_next = (base + timedelta(days=126)).isoformat()

    days_until = (date.fromisoformat(estimated_next) - date.today()).days

    return {
        "symbol": symbol.upper(),
        "last_period": fiscal_period,
        "last_end_date": last_end_date,
        "last_filing_date": last_filing_date,
        "estimated_next": estimated_next,
        "days_until": days_until,
    }


async def fetch_earnings_calendar(symbols: list[str]) -> list[dict[str, Any]]:
    """Return earnings timeline for each symbol, sorted by days_until ascending."""
    tasks = [_earnings_for_symbol(s) for s in symbols]
    results = await asyncio.gather(*tasks)
    entries = [r for r in results if r is not None]
    return sorted(entries, key=lambda e: e["days_until"])


async def fetch_ticker_names(symbols: list[str]) -> dict[str, str]:
    """Return {symbol: company_name} for each symbol. Silently omits failures."""
    sem = asyncio.Semaphore(3)

    async def _one(symbol: str) -> tuple[str, Optional[str]]:
        async with sem:
            try:
                details = await fetch_ticker_details(symbol)
                return (symbol.upper(), details.get("name"))
            except Exception:
                return (symbol.upper(), None)

    results = await asyncio.gather(*[_one(s) for s in symbols])
    return {sym: name for sym, name in results if name is not None}
