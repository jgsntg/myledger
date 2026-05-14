from fastapi import APIRouter, Depends

from app.alpaca import trading_get
from app.auth import require_token

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


@router.get("/account")
async def get_account() -> dict:
    return await trading_get("/v2/account")
