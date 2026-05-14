from __future__ import annotations

from datetime import datetime
from typing import Optional

import aiosqlite
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app import edgar, quiver
from app.auth import require_token
from app.auto_trader import maybe_auto_trade
from app.database import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])

_FILER_TYPES = {"congress", "institution"}


class FilerCreate(BaseModel):
    name: str
    filer_type: str
    source_id: str


def _normalize_filer_type(filer_type: str) -> str:
    normalized = filer_type.strip().lower()
    if normalized not in _FILER_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid filer_type. Use 'congress' or 'institution'.",
        )
    return normalized


def _row_to_dict(row: aiosqlite.Row) -> dict:
    return dict(row)


@router.get("/filers")
async def list_filers(db: aiosqlite.Connection = Depends(get_db)) -> list[dict]:
    async with db.execute(
        "SELECT id, name, filer_type, source_id, added_at "
        "FROM tracked_filers ORDER BY added_at DESC"
    ) as cur:
        rows = await cur.fetchall()
    await db.close()
    return [_row_to_dict(row) for row in rows]


@router.post("/filers", status_code=status.HTTP_201_CREATED)
async def create_filer(
    body: FilerCreate,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict:
    name = body.name.strip()
    filer_type = _normalize_filer_type(body.filer_type)
    source_id = body.source_id.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="Filer name is required")
    if not source_id:
        raise HTTPException(status_code=400, detail="source_id is required")

    try:
        await db.execute(
            "INSERT INTO tracked_filers (name, filer_type, source_id) VALUES (?, ?, ?)",
            (name, filer_type, source_id),
        )
        await db.commit()
    except aiosqlite.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Filer is already tracked") from exc

    async with db.execute(
        "SELECT id, name, filer_type, source_id, added_at "
        "FROM tracked_filers WHERE id = last_insert_rowid()"
    ) as cur:
        row = await cur.fetchone()
    await db.close()
    assert row
    return _row_to_dict(row)


@router.delete("/filers/{filer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_filer(
    filer_id: int,
    db: aiosqlite.Connection = Depends(get_db),
) -> None:
    await db.execute("DELETE FROM tracked_filers WHERE id = ?", (filer_id,))
    await db.commit()
    await db.close()


@router.get("/filers/{filer_id}/transactions")
async def list_transactions(
    filer_id: int,
    db: aiosqlite.Connection = Depends(get_db),
) -> list[dict]:
    async with db.execute(
        "SELECT id, filer_id, symbol, transaction_type, amount_low, amount_high, "
        "trade_date, filed_at, fetched_at "
        "FROM filer_transactions WHERE filer_id = ? ORDER BY trade_date DESC, id DESC",
        (filer_id,),
    ) as cur:
        rows = await cur.fetchall()
    await db.close()
    return [_row_to_dict(row) for row in rows]


@router.get("/filers/{filer_id}/holdings")
async def list_holdings(
    filer_id: int,
    db: aiosqlite.Connection = Depends(get_db),
) -> list[dict]:
    async with db.execute(
        "SELECT id, filer_id, symbol, shares, value_usd, report_date, fetched_at "
        "FROM filer_holdings WHERE filer_id = ? ORDER BY report_date DESC, symbol ASC",
        (filer_id,),
    ) as cur:
        rows = await cur.fetchall()
    await db.close()
    return [_row_to_dict(row) for row in rows]


@router.post("/filers/{filer_id}/refresh")
async def refresh_filer(
    filer_id: int,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict:
    async with db.execute(
        "SELECT id, name, filer_type, source_id, added_at FROM tracked_filers WHERE id = ?",
        (filer_id,),
    ) as cur:
        filer = await cur.fetchone()
    if not filer:
        await db.close()
        raise HTTPException(status_code=404, detail="Filer not found")

    if filer["filer_type"] == "congress":
        result = await _refresh_congress_filer(db, filer)
    else:
        result = await _refresh_institution_filer(db, filer)

    await db.close()
    return result


async def _refresh_congress_filer(db: aiosqlite.Connection, filer: aiosqlite.Row) -> dict:
    try:
        trades = await quiver.fetch_congress_trades(filer["source_id"])
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code
        if status_code == 401:
            raise HTTPException(
                status_code=502,
                detail="Check QUIVER_API_TOKEN in your .env",
            ) from exc
        if status_code == 404:
            raise HTTPException(
                status_code=422,
                detail="Slug not found. Try e.g. nancy-pelosi",
            ) from exc
        raise HTTPException(status_code=502, detail="Quiver API error") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    inserted = 0
    for trade in trades:
        symbol = str(trade.get("Ticker") or "").strip().upper()
        transaction_type = str(trade.get("Transaction") or "").strip()
        trade_date = str(trade.get("TransactionDate") or "").strip()
        if not symbol or not transaction_type or not trade_date:
            continue

        amount_low, amount_high = quiver.parse_amount_range(trade.get("Range"))
        filed_at = _parse_optional_date(trade.get("FilingDate"))
        cur = await db.execute(
            "INSERT OR IGNORE INTO filer_transactions "
            "(filer_id, symbol, transaction_type, amount_low, amount_high, trade_date, filed_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                filer["id"],
                symbol,
                transaction_type,
                amount_low,
                amount_high,
                trade_date[:10],
                filed_at,
            ),
        )
        row_inserted = cur.rowcount and cur.rowcount > 0
        inserted += 1 if row_inserted else 0

        if row_inserted:
            side = "sell" if transaction_type.lower().startswith("sale") else "buy"
            await maybe_auto_trade(
                symbol=symbol,
                side=side,
                source="filer",
                source_ref=filer["source_id"],
                db=db,
                amount_low=amount_low,
                amount_high=amount_high,
            )

    await db.commit()
    return {
        "filer": _row_to_dict(filer),
        "transactions_seen": len(trades),
        "transactions_inserted": inserted,
        "holdings_seen": 0,
        "holdings_inserted": 0,
    }


async def _refresh_institution_filer(
    db: aiosqlite.Connection,
    filer: aiosqlite.Row,
) -> dict:
    data = await edgar.fetch_13f_holdings(filer["source_id"])
    holdings = data.get("holdings", [])
    inserted = 0
    for holding in holdings:
        symbol = str(holding.get("symbol") or "").strip().upper()
        report_date = str(holding.get("report_date") or "").strip()
        if not symbol or not report_date:
            continue
        cur = await db.execute(
            "INSERT OR IGNORE INTO filer_holdings "
            "(filer_id, symbol, shares, value_usd, report_date) VALUES (?, ?, ?, ?, ?)",
            (
                filer["id"],
                symbol,
                holding.get("shares"),
                holding.get("value_usd"),
                report_date[:10],
            ),
        )
        inserted += cur.rowcount if cur.rowcount and cur.rowcount > 0 else 0
    await db.commit()
    return {
        "filer": _row_to_dict(filer),
        "transactions_seen": 0,
        "transactions_inserted": 0,
        "holdings_seen": len(holdings),
        "holdings_inserted": inserted,
        "message": data.get("message"),
    }


def _parse_optional_date(value: object) -> Optional[str]:
    if not value:
        return None
    text = str(value)
    try:
        return datetime.fromisoformat(text[:10]).date().isoformat()
    except ValueError:
        return text
