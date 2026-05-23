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
