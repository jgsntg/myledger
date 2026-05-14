# Ledger — Claude Handoff

Last updated: 2026-05-14.

## Current State

The app is a FastAPI + React/TypeScript trading dashboard using Alpaca paper trading and SQLite.

Phase 1 and Phase 2a are complete:
- Watchlist CRUD
- Alpaca account, positions, orders, snapshots, bars, and clock proxy endpoints
- RSI/MACD/SMA/Bollinger indicator computation
- Signal scanner and alert scanner background tasks
- Signal history and alert UI in expanded stock rows
- Manual TradeModal with order submission and polling

Phase 2b is now mostly implemented:
- Congressional/institutional filer tracking tables exist in SQLite.
- Quiver congressional-trade client exists.
- Filer API endpoints exist.
- Tracked Filers UI exists.
- Manual mirror flow opens TradeModal prefilled with side/qty/source note.
- Watchlist rows can show a blue `13F` badge for symbols held by tracked 13F filers.
- EDGAR 13F is intentionally still a stub; XML parsing has not been implemented.

## Important Recent Fixes

1. `frontend/vite.config.ts`
   - Proxy target was changed from `http://localhost:8000` to `http://127.0.0.1:8000`.
   - This fixed intermittent Vite proxy `ECONNREFUSED` caused by localhost resolving differently than the backend bind address.

2. `frontend/src/components/TrackedFilersSection.tsx`
   - Track form is forgiving now.
   - User can type `nancy-pelosi` directly into the left field and click **Track**.
   - If the Source field is empty and the Name field looks like a slug, the component treats Name as `source_id` and derives display name `Nancy Pelosi`.

3. `backend/app/quiver.py`
   - Fixed missing token handling.
   - It no longer sends illegal blank header `Authorization: Token `.
   - Missing Quiver token now surfaces as the intended `Check QUIVER_API_TOKEN in your .env` error.

## Current Blocker

`backend/.env` currently has:

```env
QUIVER_API_TOKEN=
```

Sync for `nancy-pelosi` will not fetch real Quiver data until the user adds a real Quiver token and restarts the backend.

Expected behavior without token:
- Track works.
- Sync returns a token-related error.

Expected behavior with token:
- Track `nancy-pelosi`.
- Click Sync.
- Backend calls `GET /beta/live/congresstrading/nancy-pelosi`.
- New transactions are inserted into `filer_transactions`.
- Expanding the filer shows transactions.
- Clicking Mirror opens TradeModal with prefilled symbol, side, estimated qty, and source note.

## Servers

During the previous session these were started:

```bash
# Backend
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm run dev -- --host 127.0.0.1
```

Frontend URL:

```text
http://127.0.0.1:5173/
```

Backend URL:

```text
http://127.0.0.1:8000/
```

If continuing in a new shell, check whether those processes are still running before starting new ones.

## Environment Variables

Backend reads from `backend/.env`, not the project-root `.env`.
Frontend reads from `frontend/.env.local`.

Backend minimum:

```env
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
ALPACA_ENV=paper
ALPACA_FEED=iex
API_TOKEN=<shared secret>
DATABASE_URL=ledger.db
QUIVER_API_TOKEN=<required for filer sync>
```

Frontend:

```env
VITE_API_TOKEN=<same value as backend API_TOKEN>
```

Do not expose Alpaca keys or Quiver token to the frontend.

## Implemented Backend Files

- `backend/app/config.py`
  - Has `quiver_api_token: str = ""`.

- `backend/app/database.py`
  - Has `tracked_filers`, `filer_transactions`, and `filer_holdings` tables.

- `backend/app/quiver.py`
  - Async httpx client for Quiver.
  - `parse_amount_range()`.
  - Missing-token guard.
  - Quiver 401/404/error handling path.

- `backend/app/edgar.py`
  - Stub only.
  - Returns metadata and empty holdings.
  - Full 13F XML parsing deferred.

- `backend/app/main.py`
  - Starts/shuts down Alpaca and Quiver clients.
  - Registers `filers.router`.

- `backend/app/routers/filers.py`
  - `GET /api/filers`
  - `POST /api/filers`
  - `DELETE /api/filers/{filer_id}`
  - `GET /api/filers/{filer_id}/transactions`
  - `GET /api/filers/{filer_id}/holdings`
  - `POST /api/filers/{filer_id}/refresh`

- `backend/tests/test_filers.py`
  - Added tests for `parse_amount_range`.
  - Added ASGI-style refresh test with mocked Quiver fetch.
  - Note: `pytest` is not installed in the venv unless the user has added it since.

## Implemented Frontend Files

- `frontend/src/types/index.ts`
  - Added `TrackedFiler`, `FilerTransaction`, `FilerHolding`, `FilerRefreshResult`.
  - Removed duplicate conflicting `SignalEvent` declaration.

- `frontend/src/api/client.ts`
  - Added typed filer API methods.
  - Tightened some existing API return types.

- `frontend/src/components/TrackedFilersSection.tsx`
  - New section placed after Orders.
  - Self-manages filer list, refresh state, expanded details, transactions, holdings.
  - Provides:
    - Track form
    - Sync button
    - Remove button
    - Expand row
    - Mirror button for congressional trades
  - Computes suggested mirror qty in frontend:
    - midpoint = `(amount_low + amount_high) / 2`
    - if `amount_high` is null, midpoint = `amount_low * 2`
    - if amount/price unavailable, qty = `1`

- `frontend/src/components/TradeModal.tsx`
  - Added optional `sourceNote`.
  - Displays source note above order controls.
  - Still requires manual Submit. No auto-trading.

- `frontend/src/components/StockRow.tsx`
  - Added optional `heldByFiler`.
  - Shows blue `13F` badge.

- `frontend/src/components/Watchlist.tsx`
  - Accepts `heldSymbols?: Set<string>`.
  - Passes badge state to StockRow.

- `frontend/src/App.tsx`
  - Wires `TrackedFilersSection`.
  - Tracks `heldSymbols`.
  - Extends `openTrade()` with `sourceNote`.

- `frontend/src/vite-env.d.ts`
  - Added Vite import meta typings.

## Verification Already Done

Successful:

```bash
cd frontend
npm run type-check
npm run build
```

Also successful:
- Python AST parse for backend app/tests.
- Direct ASGI smoke test:
  - create filer
  - refresh filer with mocked Quiver data
  - list inserted transactions

Not available unless dependencies are installed:

```bash
cd backend
.venv/bin/python -m pytest
.venv/bin/python -m ruff check .
```

Both failed previously because `pytest` and `ruff` were not installed in `backend/.venv`.

## Manual Smoke Test

1. Start backend and frontend.
2. Open `http://127.0.0.1:5173/`.
3. In Tracked Filers, type:

```text
nancy-pelosi
```

4. Click **Track**.
5. A `Nancy Pelosi` filer row should appear.
6. Add a real `QUIVER_API_TOKEN` to `backend/.env`.
7. Restart backend.
8. Click **Sync**.
9. Transactions should load if Quiver token and API access are valid.
10. Expand the filer row.
11. Click **Mirror** on a transaction.
12. TradeModal should open with prefilled:
    - symbol
    - buy/sell side
    - estimated quantity
    - source note
13. User must still click Submit manually.

## Critical Rules

1. No auto-trading. Mirror only pre-fills TradeModal.
2. Keep `ALPACA_ENV=paper` as default.
3. Backend only for Alpaca and Quiver credentials.
4. No financial advice copy.
5. Python 3.9 compatibility:
   - New Python files should include `from __future__ import annotations`.
   - In Pydantic `BaseModel` subclasses, use `Optional[X]`, not `X | None`.

## Next Recommended Tasks

1. Add real `QUIVER_API_TOKEN` and test live Sync.
2. Improve Sync error display in `TrackedFilersSection` so backend JSON errors show only `detail`, not the full `502: {"detail": ...}` string.
3. Install backend dev dependencies or add them to requirements:
   - `pytest`
   - `pytest-asyncio`
   - `ruff`
4. Run full backend tests.
5. Implement EDGAR 13F XML parsing later.

