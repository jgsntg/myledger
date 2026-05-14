"""Auto-trader: submits market orders when trading_mode == 'auto'.

Rules:
- Only fires when system_settings.trading_mode == 'auto'.
- Capped at 1 auto-trade per symbol per calendar day.
- Safety guard: blocked if ALPACA_ENV == 'live' (settings router enforces this too).
- Does NOT close the passed db connection; caller owns the lifecycle.
"""

from __future__ import annotations

import logging
from datetime import date
from typing import Optional

import aiosqlite

from app.alpaca import data_get, trading_post
from app.config import settings as app_settings

logger = logging.getLogger(__name__)

_DAILY_CAP = 1  # max auto-trades per symbol per calendar day


async def maybe_auto_trade(
    symbol: str,
    side: str,
    source: str,
    source_ref: str,
    db: aiosqlite.Connection,
    amount_low: Optional[float] = None,
    amount_high: Optional[float] = None,
) -> None:
    """Submit an auto-trade if conditions are met.

    Args:
        symbol: Ticker symbol.
        side: 'buy' or 'sell'.
        source: Origin of the signal — 'signal', 'alert', or 'filer'.
        source_ref: Human-readable label for logging (e.g. 'RSI Oversold', 'price_below=150').
        db: Open aiosqlite connection — caller must not close it before this returns.
        amount_low: Dollar amount lower bound (filer transactions only); used for qty estimation.
        amount_high: Dollar amount upper bound (filer transactions only).
    """
    if app_settings.alpaca_env == "live":
        return

    async with db.execute(
        "SELECT value FROM system_settings WHERE key = 'trading_mode'"
    ) as cur:
        row = await cur.fetchone()
    if not row or row["value"] != "auto":
        return

    today = date.today().isoformat()
    async with db.execute(
        "SELECT COUNT(*) as cnt FROM auto_trade_log WHERE symbol = ? AND DATE(created_at) = ?",
        (symbol, today),
    ) as cur:
        cap_row = await cur.fetchone()
    if cap_row and cap_row["cnt"] >= _DAILY_CAP:
        logger.info("Auto-trade daily cap reached for %s", symbol)
        return

    qty = await _compute_qty(symbol, amount_low, amount_high)

    order_id: Optional[str] = None
    status = "submitted"
    error: Optional[str] = None

    try:
        result = await trading_post("/v2/orders", {
            "symbol": symbol.upper(),
            "qty": qty,
            "side": side,
            "type": "market",
            "time_in_force": "day",
        })
        order_id = result.get("id")
        logger.info("Auto-trade: %s %s x%s [%s: %s]", side.upper(), symbol, qty, source, source_ref)
    except Exception as exc:
        status = "failed"
        error = str(exc)
        logger.error("Auto-trade failed: %s %s — %s", side, symbol, error)

    await db.execute(
        "INSERT INTO auto_trade_log "
        "(symbol, side, qty, source, source_ref, order_id, status, error) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (symbol, side, qty, source, source_ref, order_id, status, error),
    )
    await db.commit()


async def _compute_qty(
    symbol: str,
    amount_low: Optional[float],
    amount_high: Optional[float],
) -> str:
    if amount_low is None:
        return "1"

    try:
        snap = await data_get(
            "/v2/stocks/snapshots",
            symbols=symbol,
            feed=app_settings.alpaca_feed,
        )
        snap_data = snap.get(symbol, {})
        price: Optional[float] = (
            (snap_data.get("latestTrade") or {}).get("p")
            or (snap_data.get("minuteBar") or {}).get("c")
            or (snap_data.get("dailyBar") or {}).get("c")
        )
        if price and price > 0:
            midpoint = (amount_low + amount_high) / 2 if amount_high else amount_low * 2
            return str(max(1, round(midpoint / price)))
    except Exception:
        logger.warning("Auto-trade: could not fetch price for %s qty estimate, defaulting to 1", symbol)

    return "1"
