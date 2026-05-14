from __future__ import annotations

from typing import Optional

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_token
from app.config import settings as app_settings
from app.database import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


class SettingsPatch(BaseModel):
    trading_mode: Optional[str] = None


async def _read_settings(db: aiosqlite.Connection) -> dict:
    async with db.execute("SELECT key, value FROM system_settings") as cur:
        rows = await cur.fetchall()
    data = {r["key"]: r["value"] for r in rows}
    data.setdefault("trading_mode", "manual")
    data["alpaca_env"] = app_settings.alpaca_env
    return data


@router.get("/settings")
async def get_settings(db: aiosqlite.Connection = Depends(get_db)) -> dict:
    result = await _read_settings(db)
    await db.close()
    return result


@router.patch("/settings")
async def update_settings(
    body: SettingsPatch,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict:
    if body.trading_mode is not None:
        mode = body.trading_mode.lower()
        if mode not in ("auto", "manual"):
            raise HTTPException(status_code=400, detail="trading_mode must be 'auto' or 'manual'")
        if mode == "auto" and app_settings.alpaca_env == "live":
            raise HTTPException(
                status_code=403,
                detail="Auto-trading is blocked in live mode. Switch to manual approval first.",
            )
        await db.execute(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('trading_mode', ?)",
            (mode,),
        )
        await db.commit()

    result = await _read_settings(db)
    await db.close()
    return result


@router.get("/auto-trades")
async def list_auto_trades(
    limit: int = 50,
    db: aiosqlite.Connection = Depends(get_db),
) -> list[dict]:
    async with db.execute(
        "SELECT id, symbol, side, qty, source, source_ref, order_id, status, error, created_at "
        "FROM auto_trade_log ORDER BY created_at DESC LIMIT ?",
        (limit,),
    ) as cur:
        rows = await cur.fetchall()
    await db.close()
    return [dict(r) for r in rows]
