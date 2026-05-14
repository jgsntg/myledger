import httpx
from fastapi import APIRouter, Depends

from app.alpaca import trading_get
from app.auth import require_token

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


@router.get("/positions")
async def get_positions() -> list:
    try:
        result = await trading_get("/v2/positions")
        return result if isinstance(result, list) else []
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return []
        raise
