"""Snapshots, bars, and clock — all read-only market data endpoints."""

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone

import asyncpg
from fastapi import APIRouter, Depends, Query

from app.alpaca import data_get, trading_get
from app.auth import require_token
from app.config import settings
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])

# In-memory snapshot cache: symbol -> (data, expires_at)
_snapshot_cache: dict[str, tuple[dict, float]] = {}
_snapshot_lock = asyncio.Lock()
_SNAPSHOT_TTL = 5.0  # seconds

# In-memory bar cache TTL (DB is the persistent store; this avoids redundant DB reads)
_bar_cache: dict[str, tuple[list[dict], float]] = {}
_bar_lock = asyncio.Lock()
_BAR_TTL_OPEN = 3600.0    # 1 hour during market hours
_BAR_TTL_CLOSED = 43200.0  # 12 hours when market is closed


@router.get("/clock")
async def get_clock() -> dict:
    return await trading_get("/v2/clock")


@router.get("/snapshots")
async def get_snapshots(symbols: str = Query(..., description="Comma-separated tickers")) -> dict:
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not symbol_list:
        return {}

    now = time.monotonic()
    result: dict = {}
    missing: list[str] = []

    async with _snapshot_lock:
        for sym in symbol_list:
            entry = _snapshot_cache.get(sym)
            if entry and now < entry[1]:
                result[sym] = entry[0]
            else:
                missing.append(sym)

    if missing:
        fresh = await data_get(
            "/v2/stocks/snapshots",
            symbols=",".join(missing),
            feed=settings.alpaca_feed,
        )
        expires = time.monotonic() + _SNAPSHOT_TTL
        async with _snapshot_lock:
            for sym in missing:
                if sym in fresh:
                    _snapshot_cache[sym] = (fresh[sym], expires)
                    result[sym] = fresh[sym]

    return result


@router.get("/bars/{symbol}")
async def get_bars(
    symbol: str,
    timeframe: str = "1Day",
    days: int = 365,
    db: asyncpg.Connection = Depends(get_db),
) -> list[dict]:
    symbol = symbol.upper()
    now = time.monotonic()

    async with _bar_lock:
        cached = _bar_cache.get(symbol)
        if cached and now < cached[1]:
            return cached[0]

    bars = await _fetch_bars_with_cache(symbol, days, db, timeframe)

    clock = await trading_get("/v2/clock")
    ttl = _BAR_TTL_OPEN if clock.get("is_open") else _BAR_TTL_CLOSED

    async with _bar_lock:
        _bar_cache[symbol] = (bars, time.monotonic() + ttl)

    return bars


async def _fetch_bars_with_cache(
    symbol: str, days: int, db: asyncpg.Connection, timeframe: str = "1Day"
) -> list[dict]:
    end_dt = datetime.now(timezone.utc) - timedelta(minutes=16)
    start_dt = end_dt - timedelta(days=days)

    rows = await db.fetch(
        "SELECT bar_date, open, high, low, close, volume FROM bar_cache "
        "WHERE symbol = $1 AND bar_date >= $2 ORDER BY bar_date ASC",
        symbol, start_dt.date(),
    )

    cached_dates = {str(row["bar_date"]) for row in rows}
    cached_bars = [
        {"t": str(row["bar_date"]), "o": row["open"], "h": row["high"],
         "l": row["low"], "c": row["close"], "v": row["volume"]}
        for row in rows
    ]

    if cached_dates:
        last_cached = max(cached_dates)
        fetch_start = (
            datetime.fromisoformat(last_cached).replace(tzinfo=timezone.utc)
            + timedelta(days=1)
        )
    else:
        fetch_start = start_dt

    fresh_bars: list[dict] = []
    if fetch_start < end_dt:
        data = await data_get(
            f"/v2/stocks/{symbol}/bars",
            timeframe=timeframe,
            start=fetch_start.isoformat(),
            end=end_dt.isoformat(),
            limit=1000,
            adjustment="all",
            feed=settings.alpaca_feed,
        )
        fresh_bars = data.get("bars") or []

        if fresh_bars:
            rows_to_insert = [
                (symbol, b["t"][:10], float(b["o"]), float(b["h"]), float(b["l"]), float(b["c"]), int(b["v"]))
                for b in fresh_bars
                if b["t"][:10] not in cached_dates
            ]
            if rows_to_insert:
                try:
                    await db.executemany(
                        "INSERT INTO bar_cache "
                        "(symbol, bar_date, open, high, low, close, volume) VALUES ($1,$2,$3,$4,$5,$6,$7) "
                        "ON CONFLICT (symbol, bar_date) DO UPDATE SET "
                        "open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, "
                        "close = EXCLUDED.close, volume = EXCLUDED.volume, "
                        "fetched_at = CURRENT_TIMESTAMP",
                        rows_to_insert,
                    )
                except Exception as exc:
                    logger.error("bar_cache write failed for %s: %s", symbol, exc)

    all_bars = cached_bars + [
        {"t": b["t"], "o": b["o"], "h": b["h"], "l": b["l"], "c": b["c"], "v": b["v"]}
        for b in fresh_bars
        if b["t"][:10] not in cached_dates
    ]
    return sorted(all_bars, key=lambda b: b["t"])
