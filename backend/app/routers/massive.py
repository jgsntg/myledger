"""Massive (Polygon.io) data endpoints."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException, Query

from app import massive

router = APIRouter(prefix="/api/massive", tags=["massive"])


@router.get("/ticker/{symbol}")
async def get_ticker_details(symbol: str):
    """Company metadata: name, sector, industry, market cap, description."""
    try:
        return await massive.fetch_ticker_details(symbol)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/news")
async def get_market_news(limit: int = 10):
    """Market-wide news feed, no ticker filter (max 50)."""
    limit = min(limit, 50)
    try:
        return await massive.fetch_market_news(limit=limit)
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


@router.get("/names")
async def get_ticker_names(symbols: str = Query(..., description="Comma-separated list of tickers")):
    """Map of symbol → company name. Silently omits symbols with no data."""
    syms: List[str] = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not syms:
        raise HTTPException(status_code=422, detail="symbols param required")
    if len(syms) > 100:
        raise HTTPException(status_code=422, detail="Max 100 symbols per request")
    try:
        return await massive.fetch_ticker_names(syms)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/sectors")
async def get_sectors(symbols: str = Query(..., description="Comma-separated list of tickers")):
    """Map of symbol → SIC industry description for a list of symbols."""
    syms: List[str] = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not syms:
        raise HTTPException(status_code=422, detail="symbols param required")
    if len(syms) > 100:
        raise HTTPException(status_code=422, detail="Max 100 symbols per request")
    try:
        return await massive.fetch_sector_map(syms)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/earnings-calendar")
async def get_earnings_calendar(symbols: str = Query(..., description="Comma-separated list of tickers")):
    """Earnings timeline for a list of symbols, sorted by days until estimated next report."""
    syms: List[str] = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if not syms:
        raise HTTPException(status_code=422, detail="symbols param required")
    if len(syms) > 100:
        raise HTTPException(status_code=422, detail="Max 100 symbols per request")
    try:
        return await massive.fetch_earnings_calendar(syms)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
