from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import httpx

from app.alpaca import trading_get, trading_post
from app.auth import require_token

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


class OrderRequest(BaseModel):
    symbol: str
    qty: str
    side: str
    type: str
    time_in_force: str = "day"
    limit_price: str | None = None


@router.get("/orders")
async def get_orders(limit: int = 20, status: str = "all") -> list:
    return await trading_get("/v2/orders", status=status, limit=limit, direction="desc")


@router.get("/orders/{order_id}")
async def get_order(order_id: str) -> dict:
    return await trading_get(f"/v2/orders/{order_id}")


@router.post("/orders")
async def submit_order(body: OrderRequest) -> dict:
    payload: dict = {
        "symbol": body.symbol.upper(),
        "qty": body.qty,
        "side": body.side,
        "type": body.type,
        "time_in_force": body.time_in_force,
    }
    if body.limit_price is not None:
        payload["limit_price"] = body.limit_price

    try:
        return await trading_post("/v2/orders", payload)
    except httpx.HTTPStatusError as e:
        # Pass Alpaca's error through verbatim — don't re-implement their validation
        raise HTTPException(
            status_code=e.response.status_code,
            detail=e.response.text,
        )
