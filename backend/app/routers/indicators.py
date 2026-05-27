import logging

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.auth import require_token
from app.database import get_db
from app.indicators import compute_signals
from app.routers.market import _fetch_bars_with_cache

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


@router.get("/indicators/{symbol}")
async def get_indicators(
    symbol: str,
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    symbol = symbol.upper()
    try:
        bars = await _fetch_bars_with_cache(symbol, days=365, db=db)
    except Exception as exc:
        logger.error("indicators/%s: _fetch_bars_with_cache failed: %s", symbol, exc)
        raise

    if not bars:
        logger.warning("indicators/%s: no bar data returned", symbol)
        raise HTTPException(status_code=404, detail=f"No bar data available for {symbol}")

    closes = [b["c"] for b in bars]
    return compute_signals(closes)
