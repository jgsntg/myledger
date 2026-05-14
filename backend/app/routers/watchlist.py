import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.alpaca import validate_symbol
from app.auth import require_token
from app.database import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


class WatchlistAdd(BaseModel):
    symbol: str


@router.get("/watchlist")
async def get_watchlist(db: aiosqlite.Connection = Depends(get_db)) -> list[dict]:
    async with db.execute(
        "SELECT symbol, added_at FROM watchlist ORDER BY added_at ASC"
    ) as cur:
        rows = await cur.fetchall()
    await db.close()
    return [{"symbol": r["symbol"], "added_at": r["added_at"]} for r in rows]


@router.post("/watchlist", status_code=status.HTTP_201_CREATED)
async def add_to_watchlist(
    body: WatchlistAdd,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict:
    symbol = body.symbol.strip().upper()
    if not symbol or not symbol.isalpha() or len(symbol) > 5:
        raise HTTPException(status_code=400, detail="Invalid symbol format")

    async with db.execute(
        "SELECT symbol FROM watchlist WHERE symbol = ?", (symbol,)
    ) as cur:
        if await cur.fetchone():
            raise HTTPException(status_code=409, detail=f"{symbol} is already on the watchlist")

    tradable = await validate_symbol(symbol)
    if not tradable:
        raise HTTPException(status_code=422, detail=f"{symbol} is not a tradable asset on Alpaca")

    await db.execute("INSERT INTO watchlist (symbol) VALUES (?)", (symbol,))
    await db.commit()
    async with db.execute(
        "SELECT symbol, added_at FROM watchlist WHERE symbol = ?", (symbol,)
    ) as cur:
        row = await cur.fetchone()
    await db.close()
    assert row
    return {"symbol": row["symbol"], "added_at": row["added_at"]}


@router.delete("/watchlist/{symbol}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    symbol: str,
    db: aiosqlite.Connection = Depends(get_db),
) -> None:
    symbol = symbol.upper()
    await db.execute("DELETE FROM watchlist WHERE symbol = ?", (symbol,))
    await db.commit()
    await db.close()
