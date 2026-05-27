import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.alpaca import validate_symbol
from app.auth import require_token
from app.database import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


class WatchlistAdd(BaseModel):
    symbol: str


@router.get("/watchlist")
async def get_watchlist(db: asyncpg.Connection = Depends(get_db)) -> list[dict]:
    rows = await db.fetch("SELECT symbol, added_at FROM watchlist ORDER BY added_at ASC")
    return [{"symbol": r["symbol"], "added_at": r["added_at"]} for r in rows]


@router.post("/watchlist", status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    body: WatchlistAdd,
    db: asyncpg.Connection = Depends(get_db),
) -> dict:
    symbol = body.symbol.strip().upper()
    if not symbol or not symbol.isalpha() or len(symbol) > 5:
        raise HTTPException(status_code=400, detail="Invalid symbol format")

    existing = await db.fetchrow("SELECT symbol FROM watchlist WHERE symbol = $1", symbol)
    if existing:
        raise HTTPException(status_code=409, detail=f"{symbol} is already on the watchlist")

    tradable = await validate_symbol(symbol)
    if not tradable:
        raise HTTPException(status_code=422, detail=f"{symbol} is not a tradable asset on Alpaca")

    await db.execute("INSERT INTO watchlist (symbol) VALUES ($1)", symbol)
    row = await db.fetchrow("SELECT symbol, added_at FROM watchlist WHERE symbol = $1", symbol)
    assert row
    return {"symbol": row["symbol"], "added_at": row["added_at"]}


@router.delete("/watchlist/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    symbol: str,
    db: asyncpg.Connection = Depends(get_db),
) -> None:
    symbol = symbol.upper()
    await db.execute("DELETE FROM watchlist WHERE symbol = $1", symbol)
