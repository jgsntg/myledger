from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.auth import require_token
from app.database import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])

_VALID_CONDITIONS = {"price_above", "price_below", "rsi_above", "rsi_below"}


class AlertCreate(BaseModel):
    symbol: str
    condition: str
    threshold: float


class AlertPatch(BaseModel):
    active: Optional[bool] = None
    threshold: Optional[float] = None


@router.get("/alerts")
async def list_alerts(db: asyncpg.Connection = Depends(get_db)) -> list[dict]:
    rows = await db.fetch(
        "SELECT id, symbol, condition, threshold, active, created_at, last_triggered_at "
        "FROM alerts ORDER BY created_at DESC"
    )
    return [dict(r) for r in rows]


@router.post("/alerts", status_code=status.HTTP_201_CREATED)
async def create_alert(
    body: AlertCreate,
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    if body.condition not in _VALID_CONDITIONS:
        raise HTTPException(status_code=400, detail=f"Invalid condition. Use one of: {_VALID_CONDITIONS}")

    row = await db.fetchrow(
        "INSERT INTO alerts (symbol, condition, threshold) VALUES ($1, $2, $3) "
        "RETURNING id, symbol, condition, threshold, active, created_at, last_triggered_at",
        body.symbol.upper(), body.condition, body.threshold,
    )
    assert row
    return dict(row)


@router.patch("/alerts/{alert_id}")
async def update_alert(
    alert_id: int,
    body: AlertPatch,
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    updates: list[str] = []
    params: list = []
    idx = 1
    if body.active is not None:
        updates.append(f"active = ${idx}")
        params.append(1 if body.active else 0)
        idx += 1
    if body.threshold is not None:
        updates.append(f"threshold = ${idx}")
        params.append(body.threshold)
        idx += 1

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(alert_id)
    await db.execute(f"UPDATE alerts SET {', '.join(updates)} WHERE id = ${idx}", *params)

    row = await db.fetchrow(
        "SELECT id, symbol, condition, threshold, active, created_at, last_triggered_at "
        "FROM alerts WHERE id = $1",
        alert_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return dict(row)


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: int,
    db: asyncpg.Connection = Depends(get_db),
) -> None:
    await db.execute("DELETE FROM alerts WHERE id = $1", alert_id)
