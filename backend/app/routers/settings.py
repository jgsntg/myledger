from __future__ import annotations

from typing import Optional

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.alpaca import trading_get
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
    risk_level: Optional[int] = None
    allow_short_selling: Optional[bool] = None


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
    data.setdefault("risk_level", "5")
    data.setdefault("allow_short_selling", "false")
    for key in ("default_trade_usd", "tax_short_term_rate", "tax_long_term_rate"):
        try:
            data[key] = float(data[key])
        except (ValueError, TypeError):
            pass
    try:
        data["tax_long_term_days"] = int(float(data["tax_long_term_days"]))
    except (ValueError, TypeError):
        pass
    try:
        data["risk_level"] = max(1, min(10, int(float(data["risk_level"]))))
    except (ValueError, TypeError):
        data["risk_level"] = 5
    data["allow_short_selling"] = data["allow_short_selling"].lower() == "true"
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

    if body.risk_level is not None:
        level = max(1, min(10, body.risk_level))
        await db.execute(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('risk_level', ?)",
            (str(level),),
        )

    if body.allow_short_selling is not None:
        await db.execute(
            "INSERT OR REPLACE INTO system_settings (key, value) VALUES ('allow_short_selling', ?)",
            ("true" if body.allow_short_selling else "false",),
        )

    await db.commit()

    result = await _read_settings(db)
    await db.close()
    return result


class BackfillRequest(BaseModel):
    order_id: str


@router.post("/auto-trades/backfill")
async def backfill_auto_trade(
    body: BackfillRequest,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict:
    """Retroactively mark an Alpaca order as an auto-trade.

    Looks up the order from Alpaca, inserts a record into auto_trade_log so the
    order shows as AUTO in the UI.  Used to correct entries that were submitted
    by the auto-trader but not logged due to a mid-flight process restart.
    """
    # Guard: don't double-insert
    async with db.execute(
        "SELECT id FROM auto_trade_log WHERE order_id = ?", (body.order_id,)
    ) as cur:
        existing = await cur.fetchone()
    if existing:
        await db.close()
        raise HTTPException(status_code=409, detail="order already exists in auto_trade_log")

    try:
        order = await trading_get(f"/v2/orders/{body.order_id}")
    except Exception as exc:
        await db.close()
        raise HTTPException(status_code=502, detail=f"Alpaca order lookup failed: {exc}")

    symbol = order.get("symbol", "")
    side = order.get("side", "")
    qty = order.get("qty") or order.get("filled_qty") or "1"
    alpaca_status = order.get("status", "filled")
    status = "submitted" if alpaca_status not in ("canceled", "rejected", "expired") else "failed"

    await db.execute(
        "INSERT INTO auto_trade_log "
        "(symbol, side, qty, source, source_ref, order_id, status, error, recommendation, reasoning) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            symbol, side, qty,
            "signal", "retroactive",
            body.order_id, status,
            None, None,
            "Retroactively marked as auto-trade — order was submitted by the auto-trader "
            "but not logged due to a process restart before the DB write completed.",
        ),
    )
    await db.commit()
    await db.close()
    return {"ok": True, "order_id": body.order_id, "symbol": symbol, "side": side}


@router.get("/auto-trades")
async def list_auto_trades(
    limit: int = 50,
    db: aiosqlite.Connection = Depends(get_db),
) -> list[dict]:
    async with db.execute(
        "SELECT id, symbol, side, qty, source, source_ref, order_id, status, error, "
        "recommendation, reasoning, created_at "
        "FROM auto_trade_log ORDER BY created_at DESC LIMIT ?",
        (limit,),
    ) as cur:
        rows = await cur.fetchall()
    await db.close()
    return [dict(r) for r in rows]
