# Ledger — Claude Handoff

Last updated: 2026-05-14.

## Current State

FastAPI + React/TypeScript trading dashboard using Alpaca paper trading and SQLite.

### Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Watchlist CRUD, Alpaca proxy endpoints, indicator computation | ✅ Done |
| 2a | Signal scanner, alert scanner, SignalsLog UI, TradeModal | ✅ Done |
| 2b | Filer tracking (Quiver/EDGAR), Mirror flow, 13F badge | ✅ Done |
| 2c | Auto-trading toggle, daily cap, auto-trade log | ✅ Done |
| 3 | Trade evaluator (tax estimate, holding period, wash-sale) | ✅ Done |

---

## Servers

```bash
# Backend — from backend/ dir
.venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend — from frontend/ dir
npm run dev -- --host 127.0.0.1
```

- Frontend: http://127.0.0.1:5173/
- Backend:  http://127.0.0.1:8000/
- API docs: http://127.0.0.1:8000/docs

Always check if processes are already running (`lsof -i :8000 -i :5173`) before starting new ones.

---

## Environment Variables

Backend reads from `backend/.env` (not project root).
Frontend reads from `frontend/.env.local`.

**`backend/.env` minimum:**
```env
ALPACA_API_KEY=...
ALPACA_API_SECRET=...
ALPACA_ENV=paper
ALPACA_FEED=iex
API_TOKEN=<shared secret>
DATABASE_URL=ledger.db
QUIVER_API_TOKEN=<required for filer sync — currently empty>
```

**`frontend/.env.local`:**
```env
VITE_API_TOKEN=<same value as backend API_TOKEN>
```

Never expose Alpaca keys or Quiver token to the frontend.

---

## Current Blocker

`QUIVER_API_TOKEN` is empty in `backend/.env`. Filer Sync will fail with a token error until a real key is added and the backend is restarted. All other features work without it.

---

## Critical Rules

1. `ALPACA_ENV=paper` is the default. Never switch to `live` without explicit intent.
2. Auto-trading is **blocked** when `ALPACA_ENV=live` — enforced in both `auto_trader.py` and the settings API.
3. Backend only for Alpaca and Quiver credentials.
4. No financial advice copy.
5. Python 3.9 compatibility:
   - All new `.py` files: `from __future__ import annotations` at the top.
   - Pydantic `BaseModel` fields: `Optional[X]` not `X | None` (Pydantic evaluates at class-definition time).
   - Regular function annotations: `X | None` is fine under `__future__`.

---

## Backend File Inventory

### Core

- `app/config.py` — Pydantic settings; reads `backend/.env`. Fields: alpaca keys, `alpaca_env`, `alpaca_feed`, `api_token`, `database_url`, `quiver_api_token`.
- `app/database.py` — SQLite DDL + `init_db()`. Tables: `watchlist`, `signal_events`, `alerts`, `bar_cache`, `notifications_log`, `tracked_filers`, `filer_transactions`, `filer_holdings`, `system_settings`, `auto_trade_log`. Seeds `trading_mode=manual` on init. Runs safe `PRAGMA`-based migration to add `recommendation` column to `auto_trade_log`.
- `app/alpaca.py` — Two httpx clients (trading + data). `trading_get`, `trading_post`, `data_get`, `validate_symbol`.
- `app/quiver.py` — Quiver Quant httpx client. `fetch_congress_trades()`, `parse_amount_range()`. Missing-token guard.
- `app/edgar.py` — **Stub only.** Returns empty holdings. 13F XML parsing not implemented.
- `app/indicators.py` — RSI, EMA, SMA, MACD, Bollinger, `compute_signals()`.
- `app/scanner.py` — `signal_scanner_loop()` (60s), `alert_scanner_loop()` (30s). Both call `maybe_auto_trade()` after a trigger fires.
- `app/auto_trader.py` — Mode check, daily cap (1/symbol/day), evaluator pre-flight, order submit, log insert. No-op if `ALPACA_ENV=live`.
- `app/evaluator.py` — `evaluate_trade(symbol, side, qty)` → `EvaluationResult`. Fetches positions + filled order history from Alpaca. Computes holding period, short/long-term gain, estimated tax (37%/20%), wash-sale risk.
- `app/auth.py` — Bearer token middleware.
- `app/main.py` — FastAPI app, lifespan (init DB, start/stop Alpaca + Quiver clients, start scanners), CORS, router registration.

### Routers (`app/routers/`)

| File | Endpoints |
|------|-----------|
| `account.py` | `GET /api/account` |
| `positions.py` | `GET /api/positions` |
| `orders.py` | `GET /api/orders`, `GET /api/orders/{id}`, `POST /api/orders` |
| `market.py` | `GET /api/snapshots`, `GET /api/bars/{symbol}`, `GET /api/clock` |
| `watchlist.py` | `GET/POST /api/watchlist`, `DELETE /api/watchlist/{symbol}` |
| `indicators.py` | `GET /api/indicators/{symbol}` |
| `signals.py` | `GET /api/signals/history` |
| `alerts.py` | `GET/POST /api/alerts`, `PATCH/DELETE /api/alerts/{id}` |
| `filers.py` | `GET/POST /api/filers`, `DELETE /api/filers/{id}`, `GET /api/filers/{id}/transactions`, `GET /api/filers/{id}/holdings`, `POST /api/filers/{id}/refresh` |
| `settings.py` | `GET/PATCH /api/settings`, `GET /api/auto-trades` |
| `evaluate.py` | `POST /api/evaluate` |

### Tests

- `backend/tests/test_filers.py` — tests for `parse_amount_range` and ASGI refresh flow with mocked Quiver.
- `pytest` and `ruff` are **not installed** in `backend/.venv`. Install before running.

---

## Frontend File Inventory

### App shell

- `src/App.tsx` — Bootstrap: loads watchlist, clock, settings, stock data, auto-trade log. Periodic polls: clock 30s, stocks 30s, account 20s, auto-trades 30s. Manages `tradingMode`, `autoTrades`, `heldSymbols`, `tradeTarget`.
- `src/api/client.ts` — All typed API methods including `evaluateTrade`, `getSettings`, `updateSettings`, `getAutoTrades`.
- `src/types/index.ts` — All TypeScript types including `AppSettings`, `EvaluationResult`, `AutoTradeEntry`.

### Components

| File | Description |
|------|-------------|
| `Header.tsx` | Sticky header. Shows MANUAL/AUTO mode toggle pill (green + pulsing when auto, greyed out in live mode), market status, clock. |
| `PortfolioSummary.tsx` | Equity, P&L, buying power summary cards. |
| `Watchlist.tsx` | Stock list with add/remove. Passes `heldSymbols` for 13F badge. |
| `StockRow.tsx` | Expanded stock row with price, indicators, signal history, alerts. Blue `13F` badge if held by a tracked filer. |
| `StockDetail.tsx` | Chart and indicator detail panel. |
| `SignalsLog.tsx` | Live feed of new signal events (buy/sell/warn). |
| `PositionsTable.tsx` | Open positions with Trade button. |
| `OrdersTable.tsx` | Recent orders. **Source column** shows green `AUTO` pill or muted `manual` label based on cross-reference with auto-trade log. |
| `TradeModal.tsx` | Order entry modal. Fetches `TradeEvaluation` on open and on side change (symbol+side trigger, not qty). Submit always available — evaluation is advisory only. |
| `TradeEvaluation.tsx` | Evaluation panel inside TradeModal. Green PROCEED / amber CAUTION / red HOLD. Shows reasons, holding period, estimated gain, tax, wash-sale flag. |
| `TrackedFilersSection.tsx` | Filer tracking UI: Track form, Sync, Remove, expand row, Mirror button. Auto-mirrors on Sync if mode=auto. |
| `AutoTradeLog.tsx` | Table of all auto-trade attempts: symbol, side, qty, source, trigger, order ID, status (✓/✗). Shows evaluator recommendation per row. |

---

## Auto-Trading System

### Toggle

Header pill: **MANUAL** (default) ↔ **AUTO** (green, pulsing dot). Greyed out and disabled when `ALPACA_ENV=live`.

API: `PATCH /api/settings` with `{ "trading_mode": "auto" }`. Returns 403 if `ALPACA_ENV=live`.

### Trigger → Side mapping

| Source | Condition | Side |
|--------|-----------|------|
| Signal scanner | Buy signal (RSI oversold, MACD bull cross, etc.) | buy |
| Signal scanner | Sell signal (RSI overbought, MACD bear cross, etc.) | sell |
| Alert scanner | `price_below` or `rsi_below` | buy |
| Alert scanner | `price_above` or `rsi_above` | sell |
| Filer refresh | New transaction starting with "Sale" | sell |
| Filer refresh | Any other new transaction | buy |

### Rules

- Hard cap: **1 auto-trade per symbol per calendar day**.
- All auto-trades are market orders, `time_in_force=day`.
- Qty: `1` for signals/alerts. For filer trades: fetches snapshot price, computes `round(midpoint / price)` where midpoint = `(low + high) / 2` or `low * 2` if no upper bound.
- Evaluator runs as a soft pre-flight gate: logs recommendation to `auto_trade_log.recommendation` but always executes.

---

## Trade Evaluator

Called from both TradeModal (UI) and auto_trader (pre-flight). Never blocks — returns `proceed` with empty reasons on any data failure.

### Recommendation logic

| Condition | Recommendation |
|-----------|---------------|
| Sell, gain > 0, ≤ 30 days to long-term threshold | **hold** — shows tax savings estimate |
| Sell, gain > 0, > 30 days to long-term threshold | **caution** — shows days to qualify, estimated tax |
| Sell, gain < 0 | **caution** — wash-sale warning |
| Buy, sold same symbol at a loss within 30 days | **caution** — wash-sale risk |
| All other cases | **proceed** |

Tax rate assumptions: short-term 37%, long-term 20%, threshold 365 days. Rates are hardcoded constants in `evaluator.py`.

Data sources: Alpaca `/v2/positions` + `/v2/orders?status=filled` (2-year window, filtered by symbol).

---

## Verification

All checks pass as of last session:

```bash
# Frontend
cd frontend && npm run type-check   # clean
cd frontend && npm run build        # clean

# Backend
.venv/bin/python -c "import ast; ..."  # AST parse all .py files — all OK
```

---

## Next Recommended Tasks

### High priority

1. **QUIVER_API_TOKEN** — Add real token to `backend/.env`, restart backend, test Sync for `nancy-pelosi`. This is the only thing blocking the full filer flow.
2. **Sync error display** — `TrackedFilersSection` currently shows the full `502: {"detail": ...}` string. Should extract and show only the `detail` field.

### Medium priority

3. **Backend dev deps** — Install `pytest`, `pytest-asyncio`, `ruff` into `backend/.venv` and run tests.
4. **Auto-trade qty for signals** — Currently hardcoded to `1` share. Could add a configurable default trade size in `system_settings` (e.g. `default_trade_usd=500`) so auto-trades size themselves by dollar amount.
5. **Evaluator tax rates** — Currently hardcoded at 37%/20%. Could expose as user-configurable settings.

### Low priority / future

6. **EDGAR 13F XML parsing** — `edgar.py` is a stub. Full implementation would parse SEC EDGAR XML for institutional 13F holdings.
7. **Live mode workflow** — When `ALPACA_ENV=live`: auto-trading is blocked by design, but a review queue (trades proposed but pending approval) would be the natural next step.
8. **Notifications delivery** — `notifications_log` entries are written but never sent. Resend (email) was the preferred provider noted in earlier sessions.
9. **Portfolio analytics** — P&L over time, gain/loss breakdown, benchmark comparison vs S&P.
