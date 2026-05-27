"""Two httpx clients: one for the trading API, one for market data.
Both APIs share the same key pair but use different base URLs."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_trading_client: httpx.AsyncClient | None = None
_data_client: httpx.AsyncClient | None = None


def _auth_headers() -> dict[str, str]:
    return {
        "APCA-API-KEY-ID": settings.alpaca_api_key,
        "APCA-API-SECRET-KEY": settings.alpaca_api_secret,
    }


async def startup() -> None:
    global _trading_client, _data_client
    _trading_client = httpx.AsyncClient(
        base_url=settings.trading_base_url,
        headers=_auth_headers(),
        timeout=15.0,
    )
    _data_client = httpx.AsyncClient(
        base_url=settings.data_base_url,
        headers=_auth_headers(),
        timeout=15.0,
    )


async def shutdown() -> None:
    if _trading_client:
        await _trading_client.aclose()
    if _data_client:
        await _data_client.aclose()


async def trading_get(path: str, **params: Any) -> Any:
    assert _trading_client, "Alpaca client not initialized"
    r = await _trading_client.get(path, params=params)
    if r.is_error:
        logger.error("Alpaca trading GET %s → %s: %s", path, r.status_code, r.text[:200])
    r.raise_for_status()
    return r.json()


async def trading_post(path: str, body: dict[str, Any]) -> Any:
    assert _trading_client, "Alpaca client not initialized"
    r = await _trading_client.post(path, json=body)
    if r.is_error:
        logger.error("Alpaca trading POST %s → %s: %s", path, r.status_code, r.text[:200])
    r.raise_for_status()
    return r.json()


async def data_get(path: str, **params: Any) -> Any:
    assert _data_client, "Alpaca data client not initialized"
    r = await _data_client.get(path, params=params)
    if r.is_error:
        logger.error("Alpaca data GET %s → %s: %s", path, r.status_code, r.text[:200])
    r.raise_for_status()
    return r.json()


async def validate_symbol(symbol: str) -> bool:
    """Check that a symbol exists and is tradable on Alpaca."""
    try:
        asset = await trading_get(f"/v2/assets/{symbol.upper()}")
        return asset.get("tradable", False)
    except httpx.HTTPStatusError:
        return False
