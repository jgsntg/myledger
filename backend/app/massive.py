"""Massive (Polygon.io) API client for enriched market data.

Provides ticker details (sector, industry, market cap, description),
recent news per symbol, and earnings/financials data.

Auth: Bearer token via Authorization header.
Base: https://api.polygon.io
"""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_client: Optional[httpx.AsyncClient] = None

_BASE_URL = "https://api.polygon.io"


async def startup() -> None:
    global _client
    headers = {}
    if settings.massive_api_key:
        headers["Authorization"] = f"Bearer {settings.massive_api_key}"
    _client = httpx.AsyncClient(
        base_url=_BASE_URL,
        headers=headers,
        timeout=15.0,
    )


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
    """Fetch recent financial statements for a symbol.

    Returns quarterly/annual income statement, balance sheet, cash flow data.
    Polygon endpoint: GET /vX/reference/financials
    """
    client = _require_client()
    try:
        r = await client.get(
            "/vX/reference/financials",
            params={"ticker": symbol.upper(), "limit": 4, "sort": "period_of_report_date", "order": "desc"},
        )
        r.raise_for_status()
        return r.json().get("results", [])
    except Exception as e:
        logger.exception("Massive financials fetch failed for %s", symbol)
        raise RuntimeError(f"Massive API error: {e}") from e
