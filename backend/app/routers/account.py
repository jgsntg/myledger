from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.alpaca import trading_get
from app.auth import require_token

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


@router.get("/account")
async def get_account() -> dict:
    return await trading_get("/v2/account")


@router.get("/portfolio-history")
async def get_portfolio_history(
    period: str = Query(default="1D"),
    timeframe: str = Query(default="1Min"),
) -> dict:
    return await trading_get(
        "/v2/account/portfolio/history",
        period=period,
        timeframe=timeframe,
        extended_hours=True,
    )


async def _fetch_fills() -> list[dict]:
    """Fetch FILL activities from Alpaca, up to 500 (5 pages × 100)."""
    fills: list[dict] = []
    params: dict = {"direction": "asc", "limit": 100}
    for _ in range(5):
        batch = await trading_get("/v2/account/activities/FILL", **params)
        if not isinstance(batch, list) or not batch:
            break
        fills.extend(batch)
        if len(batch) < 100:
            break
        params["page_token"] = batch[-1]["id"]
    return fills


def _fifo_match(fills: list[dict], lt_days: int) -> dict:
    """FIFO-match buy/sell fills per symbol and return realized P&L split by ST/LT."""
    by_symbol: dict[str, list] = defaultdict(list)
    for f in fills:
        by_symbol[f["symbol"]].append(f)

    total_realized = 0.0
    total_st = 0.0
    total_lt = 0.0
    by_symbol_result = []

    for symbol, sym_fills in by_symbol.items():
        buy_queue: deque = deque()
        sym_realized = sym_st = sym_lt = 0.0
        trade_count = 0

        for fill in sym_fills:
            qty = float(fill["qty"])
            price = float(fill["price"])
            dt = datetime.fromisoformat(fill["transaction_time"].replace("Z", "+00:00"))

            if fill["side"] == "buy":
                buy_queue.append({"price": price, "qty": qty, "date": dt})
            elif fill["side"] == "sell" and buy_queue:
                remaining = qty
                while remaining > 0 and buy_queue:
                    lot = buy_queue[0]
                    matched = min(remaining, lot["qty"])
                    pnl = (price - lot["price"]) * matched
                    is_lt = (dt - lot["date"]).days > lt_days

                    sym_realized += pnl
                    if is_lt:
                        sym_lt += pnl
                    else:
                        sym_st += pnl

                    trade_count += 1
                    remaining -= matched
                    lot["qty"] -= matched
                    if lot["qty"] <= 0:
                        buy_queue.popleft()

        if trade_count > 0:
            by_symbol_result.append({
                "symbol": symbol,
                "realized_pl": round(sym_realized, 2),
                "short_term": round(sym_st, 2),
                "long_term": round(sym_lt, 2),
                "trades": trade_count,
            })
            total_realized += sym_realized
            total_st += sym_st
            total_lt += sym_lt

    by_symbol_result.sort(key=lambda x: abs(x["realized_pl"]), reverse=True)

    return {
        "total_realized": round(total_realized, 2),
        "short_term": round(total_st, 2),
        "long_term": round(total_lt, 2),
        "by_symbol": by_symbol_result,
        "fills_analyzed": len(fills),
    }


@router.get("/realized-pnl")
async def get_realized_pnl(lt_days: int = Query(default=365)) -> dict:
    fills = await _fetch_fills()
    return _fifo_match(fills, lt_days)
