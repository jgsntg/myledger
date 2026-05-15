from __future__ import annotations

import logging
import time
from datetime import date, timedelta
from typing import List, Optional

import aiosqlite
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.alpaca import data_get
from app.auth import require_token
from app.config import settings as app_settings
from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])

_DEFAULT_UNIVERSE = [
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "JPM", "LLY", "V",
    "UNH", "XOM", "MA", "AVGO", "JNJ", "PG", "HD", "COST", "MRK", "ABBV",
    "CVX", "BAC", "PEP", "KO", "NFLX", "AMD", "CSCO", "TMO", "ACN", "CRM",
    "MCD", "QCOM", "GE", "ABT", "WMT", "TXN", "NKE", "CAT", "INTU", "HON",
    "AMGN", "GS", "DE", "BLK", "BKNG", "SPGI", "AXP", "ISRG", "NOW", "ADI",
]

_BATCH_SIZE = 15
_CACHE_TTL = 3600  # 1 hour

_cache: dict = {"data": None, "ts": 0.0, "universe_hash": ""}


class InsightEntry(BaseModel):
    symbol: str
    return_pct: float
    current_price: float
    closes: List[float] = []


class TopPerformersResponse(BaseModel):
    d7: List[InsightEntry]
    d14: List[InsightEntry]
    d30: List[InsightEntry]
    refreshed_at: str
    universe_size: int


@router.get("/insights/top-performers")
async def top_performers(
    refresh: bool = False,
    db: aiosqlite.Connection = Depends(get_db),
) -> TopPerformersResponse:
    extra: List[str] = []
    async with db.execute(
        "SELECT value FROM system_settings WHERE key = 'insights_extra_symbols'"
    ) as cur:
        row = await cur.fetchone()
    if row and row["value"]:
        extra = [s.strip().upper() for s in row["value"].split(",") if s.strip()]
    await db.close()

    universe = list(dict.fromkeys(_DEFAULT_UNIVERSE + extra))
    universe_hash = ",".join(sorted(universe))

    now = time.time()
    if (
        not refresh
        and _cache["data"] is not None
        and now - _cache["ts"] < _CACHE_TTL
        and _cache["universe_hash"] == universe_hash
    ):
        return _cache["data"]

    result = await _fetch_and_rank(universe)
    _cache["data"] = result
    _cache["ts"] = now
    _cache["universe_hash"] = universe_hash
    return result


async def _fetch_and_rank(universe: List[str]) -> TopPerformersResponse:
    today = date.today()
    start = (today - timedelta(days=42)).isoformat()
    end = today.isoformat()

    all_bars: dict = {}
    for i in range(0, len(universe), _BATCH_SIZE):
        batch = universe[i : i + _BATCH_SIZE]
        try:
            resp = await data_get(
                "/v2/stocks/bars",
                symbols=",".join(batch),
                timeframe="1Day",
                start=start,
                end=end,
                feed=app_settings.alpaca_feed,
                limit=10000,
                adjustment="split",
            )
            bars_chunk = resp.get("bars") if isinstance(resp, dict) else None
            if isinstance(bars_chunk, dict):
                all_bars.update(bars_chunk)
        except Exception as exc:
            logger.warning("Insights: bars fetch failed for batch %s: %s", batch, exc)

    results: dict = {7: [], 14: [], 30: []}
    for symbol, bars in all_bars.items():
        if not bars:
            continue
        sorted_bars = sorted(bars, key=lambda b: b["t"])
        if len(sorted_bars) < 2:
            continue
        current_close: Optional[float] = sorted_bars[-1].get("c")
        if not current_close or current_close <= 0:
            continue

        closes_30 = [round(b["c"], 2) for b in sorted_bars[-30:]]

        for days in (7, 14, 30):
            target = (today - timedelta(days=days)).isoformat()
            past_close: Optional[float] = None
            for bar in sorted_bars:
                if bar["t"][:10] <= target:
                    past_close = bar.get("c")
            if not past_close or past_close <= 0:
                continue
            ret = (current_close - past_close) / past_close * 100
            results[days].append(
                InsightEntry(
                    symbol=symbol,
                    return_pct=round(ret, 2),
                    current_price=round(current_close, 2),
                    closes=closes_30,
                )
            )

    top_n = 50
    d7 = sorted(results[7], key=lambda e: e.return_pct, reverse=True)[:top_n]
    d14 = sorted(results[14], key=lambda e: e.return_pct, reverse=True)[:top_n]
    d30 = sorted(results[30], key=lambda e: e.return_pct, reverse=True)[:top_n]

    return TopPerformersResponse(
        d7=d7,
        d14=d14,
        d30=d30,
        refreshed_at=today.isoformat(),
        universe_size=len(universe),
    )
