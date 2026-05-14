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
    default_trade_usd: Optional[float] = None
    tax_short_term_rate: Optional[float] = None
    tax_long_term_rate: Optional[float] = None
    tax_long_term_days: Optional[int] = None
    insights_extra_symbols: Optional[str] = None


async def _read_settings(db: aiosqlite.Connection) -> dict:
    async with db.execute("SELECT key, value FROM system_settings") as cur:
        rows = await cur.fetchall()
    data: dict = {r["key"]: r["value"] for r in rows}
    data.setdefault("trading_mode", "manual")
    data.setdefault("default_trade_usd", "500")
    data.setdefault("tax_short_term_rate", "0.37")
    data.setdefault("tax_long_term_rate", "0.20")
    data.setdefault("tax_long_term_days", "365")
    data.setdefault("insights_extra_symbols", "")
    for key in ("default_trade_usd", "tax_short_term_rate", "tax_long_term_rate"):
        try:
            data[key] = float(data[key])
        except (ValueError, TypeError):
            pass
    try:
        data["tax_long_term_days"] = int(float(data["tax_long_term_days"]))
    except (ValueError, TypeError):
        pass
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

    if body.default_trade_usd is not None:
        if body.default_trade_usd <= 0:
            raise HTTPException(status_code=400, detail="default_trade_usd must be greater than 0")
        await db.execute(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('default_trade_usd', ?)",
            (str(body.default_trade_usd),),
        )

    for key, value in [
        ("tax_short_term_rate", body.tax_short_term_rate),
        ("tax_long_term_rate", body.tax_long_term_rate),
    ]:
        if value is not None:
            if not (0 < value <= 1):
                raise HTTPException(status_code=400, detail=f"{key} must be between 0 and 1")
            await db.execute(
                "INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)",
                (key, str(value)),
            )

    if body.tax_long_term_days is not None:
        if body.tax_long_term_days <= 0:
            raise HTTPException(status_code=400, detail="tax_long_term_days must be greater than 0")
        await db.execute(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('tax_long_term_days', ?)",
            (str(body.tax_long_term_days),),
        )

    if body.insights_extra_symbols is not None:
        await db.execute(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('insights_extra_symbols', ?)",
            (body.insights_extra_symbols,),
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
