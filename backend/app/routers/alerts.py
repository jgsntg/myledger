from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

import aiosqlite

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
async def list_alerts(db: aiosqlite.Connection = Depends(get_db)) -> list[dict]:
    async with db.execute(
        "SELECT id, symbol, condition, threshold, active, created_at, last_triggered_at "
        "FROM alerts ORDER BY created_at DESC"
    ) as cur:
        rows = await cur.fetchall()
    await db.close()
    return [dict(r) for r in rows]


@router.post("/alerts", status_code=status.HTTP_201_CREATED)
async def create_alert(
    body: AlertCreate,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict:
    if body.condition not in _VALID_CONDITIONS:
        raise HTTPException(status_code=400, detail=f"Invalid condition. Use one of: {_VALID_CONDITIONS}")

    await db.execute(
        "INSERT INTO alerts (symbol, condition, threshold) VALUES (?, ?, ?)",
        (body.symbol.upper(), body.condition, body.threshold),
    )
    await db.commit()
    async with db.execute(
        "SELECT id, symbol, condition, threshold, active, created_at, last_triggered_at "
        "FROM alerts WHERE id = last_insert_rowid()"
    ) as cur:
        row = await cur.fetchone()
    await db.close()
    assert row
    return dict(row)


@router.patch("/alerts/{alert_id}")
async def update_alert(
    alert_id: int,
    body: AlertPatch,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict:
    updates: list[str] = []
    params: list = []
    if body.active is not None:
        updates.append("active = ?")
        params.append(1 if body.active else 0)
    if body.threshold is not None:
        updates.append("threshold = ?")
        params.append(body.threshold)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(alert_id)
    await db.execute(f"UPDATE alerts SET {', '.join(updates)} WHERE id = ?", params)
    await db.commit()

    async with db.execute(
        "SELECT id, symbol, condition, threshold, active, created_at, last_triggered_at "
        "FROM alerts WHERE id = ?",
        (alert_id,),
    ) as cur:
        row = await cur.fetchone()
    await db.close()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return dict(row)


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: int,
    db: aiosqlite.Connection = Depends(get_db),
) -> None:
    await db.execute("DELETE FROM alerts WHERE id = ?", (alert_id,))
    await db.commit()
    await db.close()
