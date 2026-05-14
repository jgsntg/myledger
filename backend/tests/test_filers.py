from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI

from app.config import settings
from app.database import init_db
from app.quiver import parse_amount_range
from app.routers import filers


def test_parse_amount_range_range():
    assert parse_amount_range("$15,001 - $50,000") == (15001.0, 50000.0)


def test_parse_amount_range_single_value():
    assert parse_amount_range("$1,001") == (1001.0, 1001.0)


def test_parse_amount_range_over_value():
    assert parse_amount_range("Over $1,000,000") == (1000000.0, None)


def test_parse_amount_range_empty():
    assert parse_amount_range(None) == (None, None)
    assert parse_amount_range("") == (None, None)


@pytest.mark.asyncio
async def test_refresh_congress_filer_inserts_transactions(tmp_path, monkeypatch):
    db_path = tmp_path / "ledger-test.db"
    monkeypatch.setattr(settings, "database_url", str(db_path))
    monkeypatch.setattr(settings, "api_token", "test-token")
    await init_db()

    async def fake_fetch_congress_trades(slug: str) -> list[dict]:
        assert slug == "nancy-pelosi"
        return [
            {
                "Ticker": "AAPL",
                "Transaction": "Purchase",
                "Range": "$15,001 - $50,000",
                "TransactionDate": "2025-01-15",
                "FilingDate": "2025-01-28",
                "Name": "Nancy Pelosi",
            }
        ]

    monkeypatch.setattr(filers.quiver, "fetch_congress_trades", fake_fetch_congress_trades)

    app = FastAPI()
    app.include_router(filers.router)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": "Bearer test-token"}
        created = await client.post(
            "/api/filers",
            headers=headers,
            json={
                "name": "Nancy Pelosi",
                "filer_type": "congress",
                "source_id": "nancy-pelosi",
            },
        )
        assert created.status_code == 201
        filer_id = created.json()["id"]

        refreshed = await client.post(f"/api/filers/{filer_id}/refresh", headers=headers)
        assert refreshed.status_code == 200
        assert refreshed.json()["transactions_inserted"] == 1

        transactions = await client.get(
            f"/api/filers/{filer_id}/transactions",
            headers=headers,
        )
        assert transactions.status_code == 200
        rows = transactions.json()
        assert len(rows) == 1
        assert rows[0]["symbol"] == "AAPL"
        assert rows[0]["transaction_type"] == "Purchase"
        assert rows[0]["amount_low"] == 15001.0
        assert rows[0]["amount_high"] == 50000.0
