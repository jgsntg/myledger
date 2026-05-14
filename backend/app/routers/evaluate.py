from __future__ import annotations

from pydantic import BaseModel

from fastapi import APIRouter, Depends

from app.auth import require_token
from app.evaluator import EvaluationResult, evaluate_trade

router = APIRouter(prefix="/api", dependencies=[Depends(require_token)])


class EvaluateRequest(BaseModel):
    symbol: str
    side: str
    qty: str = "1"


@router.post("/evaluate")
async def evaluate(body: EvaluateRequest) -> EvaluationResult:
    return await evaluate_trade(body.symbol, body.side, body.qty)
