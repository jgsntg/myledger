from fastapi import APIRouter, Depends, Query

import aiosqlite

from app.auth import require_token
from app.database import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


@router.get("/signals/history")
async def get_signal_history(
    symbol: str = Query(...),
    days: int = 30,
    db: aiosqlite.Connection = Depends(get_db),
) -> list[dict]:
    async with db.execute(
        """SELECT symbol, signal_type, signal_label, price_at_signal, rsi_at_signal, triggered_at
           FROM signal_events
           WHERE symbol = ?
             AND triggered_at >= datetime('now', ?)
           ORDER BY triggered_at DESC""",
        (symbol.upper(), f"-{days} days"),
    ) as cur:
        rows = await cur.fetchall()
    await db.close()
    return [dict(r) for r in rows]
