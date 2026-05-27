import asyncpg
from fastapi import APIRouter, Depends, Query

from app.auth import require_token
from app.database import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


@router.get("/signals/history")
async def get_signal_history(
    symbol: str = Query(...),
    days: int = 30,
    db: asyncpg.Connection = Depends(get_db),
) -> list[dict]:
    rows = await db.fetch(
        """SELECT symbol, signal_type, signal_label, price_at_signal, rsi_at_signal, triggered_at
           FROM signal_events
           WHERE symbol = $1
             AND triggered_at >= NOW() - $2 * INTERVAL '1 day'
           ORDER BY triggered_at DESC""",
        symbol.upper(), days,
    )
    return [dict(r) for r in rows]
