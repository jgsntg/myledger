from fastapi import APIRouter, Depends, HTTPException

import aiosqlite

from app.auth import require_token
from app.database import get_db
from app.indicators import compute_signals
from app.routers.market import _fetch_bars_with_cache

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


@router.get("/indicators/{symbol}")
async def get_indicators(
    symbol: str,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict:
    symbol = symbol.upper()
    bars = await _fetch_bars_with_cache(symbol, days=365, db=db)
    await db.close()

    if not bars:
        raise HTTPException(status_code=404, detail=f"No bar data available for {symbol}")

    closes = [b["c"] for b in bars]
    return compute_signals(closes)
