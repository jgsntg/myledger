from __future__ import annotations

import aiosqlite
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.auth import require_token
from app.database import get_db
from app.evaluator import EvaluationResult, evaluate_trade

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


class EvaluateRequest(BaseModel):
    symbol: str
    side: str
    qty: str = "1"


@router.post("/evaluate")
async def evaluate(
    body: EvaluateRequest,
    db: aiosqlite.Connection = Depends(get_db),
) -> EvaluationResult:
    short_term_rate, long_term_rate, long_term_days = 0.37, 0.20, 365
    async with db.execute(
        "SELECT key, value FROM system_settings "
        "WHERE key IN ('tax_short_term_rate', 'tax_long_term_rate', 'tax_long_term_days')"
    ) as cur:
        for row in await cur.fetchall():
            try:
                if row["key"] == "tax_short_term_rate":
                    short_term_rate = float(row["value"])
                elif row["key"] == "tax_long_term_rate":
                    long_term_rate = float(row["value"])
                elif row["key"] == "tax_long_term_days":
                    long_term_days = int(float(row["value"]))
            except (ValueError, TypeError):
                pass
    await db.close()
    return await evaluate_trade(
        body.symbol, body.side, body.qty,
        short_term_rate=short_term_rate,
        long_term_rate=long_term_rate,
        long_term_days=long_term_days,
    )
