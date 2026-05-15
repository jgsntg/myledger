"""On-demand AI narrative endpoints."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import ai
from app.auth import require_token

router = APIRouter(prefix="/api/ai", tags=["ai"], dependencies=[Depends(require_token)])


class PositionItem(BaseModel):
    symbol: str
    qty: str
    market_value: str
    unrealized_pl: str
    unrealized_plpc: str


class BriefingRequest(BaseModel):
    positions: List[PositionItem]


class RiskRequest(BaseModel):
    positions: List[PositionItem]
    sector_map: Optional[Dict[str, str]] = None


@router.post("/briefing")
async def briefing(body: BriefingRequest) -> dict:
    if not body.positions:
        raise HTTPException(status_code=400, detail="No positions provided")
    try:
        text = await ai.generate_briefing([p.model_dump() for p in body.positions])
        return {"narrative": text}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {e}")


@router.post("/risk-narrative")
async def risk_narrative(body: RiskRequest) -> dict:
    if not body.positions:
        raise HTTPException(status_code=400, detail="No positions provided")
    try:
        text = await ai.generate_risk_narrative(
            [p.model_dump() for p in body.positions],
            body.sector_map or {},
        )
        return {"narrative": text}
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {e}")
