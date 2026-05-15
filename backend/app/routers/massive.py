"""Massive (Polygon.io) data endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import massive

router = APIRouter(prefix="/api/massive", tags=["massive"])


@router.get("/ticker/{symbol}")
async def get_ticker_details(symbol: str):
    """Company metadata: name, sector, industry, market cap, description."""
    try:
        return await massive.fetch_ticker_details(symbol)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/news/{symbol}")
async def get_news(symbol: str, limit: int = 10):
    """Recent news articles for a symbol (max 50)."""
    limit = min(limit, 50)
    try:
        return await massive.fetch_news(symbol, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/financials/{symbol}")
async def get_financials(symbol: str):
    """Last 4 quarters of financial statements for a symbol."""
    try:
        return await massive.fetch_financials(symbol)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
