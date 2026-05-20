# Ledger — Claude Handoff

Last updated: 2026-05-19 (Bug fix: AUTO order reasoning always visible; Glossary evaluator verdict cards).

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
| 3.5 | Market Insights / Discover (top performers, 50-stock universe + extras) | ✅ Done |
| 4 | Tabbed UI shell + settings drawer + inline row sparkline | ✅ Done |
| 5 | Massive (Polygon.io) integration — client, news tab, earnings calendar | ✅ Done |
| 5.5 | Local symbol name lookup (NASDAQ/NYSE directory, 12k+ symbols) | ✅ Done |
| 6 | Sector metadata — Polygon SIC grouping, concentration strip, grouped positions | ✅ Done |
| 7 | AI Narratives — on-demand briefing + risk narrative via Claude (manual trigger) | ✅ Done |
| 8 | Glossary tab — 28 terms across 4 sections | ✅ Done |
| 9 | Auto-trade reasoning, Risk Dial, short-selling guard, two-phase commit | ✅ Done |
| 10 | AUTO order reasoning fix + evaluator verdict glossary cards | ✅ Done |

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
MASSIVE_API_KEY=<Polygon.io API key — filled in>
ANTHROPIC_API_KEY=<filled in — powers AI Narratives>
```

**`frontend/.env.local`:**
```env
VITE_API_TOKEN=<same value as backend API_TOKEN>
```

Never expose Alpaca keys, Quiver token, or Massive key to the frontend.

---

## Critical Rules

1. `ALPACA_ENV=paper` is the default. Never switch to `live` without explicit intent.
2. Auto-trading is **blocked** when `ALPACA_ENV=live` — enforced in both `auto_trader.py` and the settings API.
3. Backend only for Alpaca, Quiver, and Massive credentials.
4. No financial advice copy.
5. Python 3.9 compatibility:
   - All new `.py` files: `from __future__ import annotations` at the top.
   - Pydantic `BaseModel` fields: `Optional[X]` not `X | None`.
   - Regular function annotations: `X | None` is fine under `__future__`.

---

## Backend File Inventory

### Core

- `app/config.py` — Pydantic settings. Fields: alpaca keys, `alpaca_env`, `alpaca_feed`, `api_token`, `database_url`, `quiver_api_token`, `massive_api_key`, `anthropic_api_key`.
- `app/database.py` — SQLite DDL + `init_db()`. Tables: `watchlist`, `signal_events`, `alerts`, `bar_cache`, `notifications_log`, `tracked_filers`, `filer_transactions`, `filer_holdings`, `system_settings`, `auto_trade_log`.
- `app/alpaca.py` — Two httpx clients (trading + data).
- `app/quiver.py` — Quiver Quant client. `fetch_congress_trades()`.
- `app/massive.py` — Polygon.io client. Rate-limited with `asyncio.Semaphore(3)`.
- `app/symbols.py` — Local NASDAQ/NYSE name lookup (~12k symbols). Registers `GET /api/symbols/names`.
- `app/edgar.py` — **Stub only.** Returns empty holdings.
- `app/indicators.py` — RSI, EMA, SMA, MACD, Bollinger, `compute_signals()`.
- `app/scanner.py` — `signal_scanner_loop()` (60s), `alert_scanner_loop()` (30s).
- `app/auto_trader.py` — See Phase 9 notes below.
- `app/evaluator.py` — `evaluate_trade()` → `EvaluationResult`.
- `app/ai.py` — Claude API client. `generate_briefing()` and `generate_risk_narrative()`. On-demand only.
- `app/auth.py` — Bearer token middleware.
- `app/main.py` — FastAPI app, lifespan, scanners.

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
| `filers.py` | Filer CRUD + refresh + transactions + holdings |
| `settings.py` | `GET/PATCH /api/settings`, `GET /api/auto-trades`, `POST /api/auto-trades/backfill` |
| `evaluate.py` | `POST /api/evaluate` |
| `insights.py` | `GET /api/insights/top-performers?refresh=` |
| `massive.py` | ticker, news, financials, earnings-calendar, sectors, names |
| `ai.py` | `POST /api/ai/briefing`, `POST /api/ai/risk-narrative` |

---

## Phase 9 — Auto-Trade Intelligence

### Auto-Trade Reasoning

Every auto-trade stores a `reasoning TEXT` column in `auto_trade_log`. Built by `_build_reasoning()` in `auto_trader.py` — deterministic, no API call. Maps each signal label / alert condition / filer source to a plain-English explanation (why + potential benefit), appends evaluator verdict and risk level context.

**Signal copy map** in `_SIGNAL_COPY` dict (8 entries): RSI Oversold/Overbought, Golden/Death Cross, MACD Bull/Bear, Below/Above Lower/Upper BB.

Displayed in:
- **Auto-Trade Log** (FilersTab) — click ▼ on any row to expand
- **Recent Orders** (PositionsTab) — same expandable pattern, AUTO rows only; looks up entry via `order_id → AutoTradeEntry` map

### Risk Dial (1–10)

Stored in `system_settings` key `risk_level` (default 5). Read on every auto-trade.

| Range | Label | Evaluator gate | Size multiplier |
|-------|-------|----------------|-----------------|
| 1–3 | Conservative | Hard gate — skip if not "proceed" | 50–80% |
| 4–6 | Balanced | Soft gate — log but proceed | 90–120% |
| 7–10 | Aggressive | Bypassed entirely | 140–200% |

`_RISK_SIZE_MULTIPLIER` dict (10 entries) in `auto_trader.py`.

UI: slider with color-coded label (green → amber → red), live description, size hint. In Settings drawer.

### Two-Phase Commit

1. `INSERT` with `status='pending', order_id=NULL` → `commit`
2. Call Alpaca
3. `UPDATE` same row with `order_id`, `status='submitted'/'failed'`

Frontend handles `'pending'` status with a "? pending" indicator + tooltip.

### Backfill Endpoint

`POST /api/auto-trades/backfill` — retroactively marks an existing Alpaca order as auto. Looks up the order from Alpaca, inserts a row into `auto_trade_log` with `reasoning = "Retroactively marked as auto-trade…"`. Guards against double-insert (409). Used via `→ auto` button on manual rows in Recent Orders.

### Short-Selling Guard

`allow_short_selling` setting (boolean, default `false`). When off, `maybe_auto_trade()` calls `GET /v2/positions/{symbol}` before any sell — if no long position exists, the trade is skipped. Toggle in Settings drawer.

---

## Phase 10 — AUTO Order Reasoning Fix + Glossary Evaluator Cards (2026-05-19)

### Bug Fix: AUTO Orders Without Reasoning

**Root cause:** `hasReasoning` in `OrdersTable.tsx` was `isAuto && !!tradeEntry?.reasoning`. Auto trades logged before the `reasoning` column was added via `ALTER TABLE` migration had `reasoning = NULL`, so the expand arrow (▼) never appeared even though the order correctly showed the AUTO badge.

**Fix (`OrdersTable.tsx:160`):**
```ts
// Before:
const hasReasoning = isAuto && !!tradeEntry?.reasoning
// After:
const hasReasoning = isAuto && tradeEntry !== undefined
```

**Expand panel fallback:** When `tradeEntry.reasoning` is null, the panel now shows:
```
Auto-trade triggered by {source} · {source_ref}
```
(e.g. `"Auto-trade triggered by signal · rsi_divergence"`)

Manually backfilled orders were unaffected — the backfill endpoint always injects reasoning text.

### Glossary: Evaluator Verdict Cards

Replaced the single vague "Evaluator Recommendation" card in the **Evaluation & Tax** section with three dedicated cards:

| Term | Badge | When it appears |
|------|-------|-----------------|
| **Evaluator: Proceed** | green | No concerns — clean trade |
| **Evaluator: Caution** | amber | Short-term gain, wash-sale risk, no position on sell, oversized sell, recent buy before a prior sale |
| **Evaluator: Hold** | red | Within 30 days of long-term threshold (waiting saves 17% tax rate) |

A new `warn` badge type (amber, `#fbbf24`) was added to `GlossaryTab.tsx` to match the existing amber styling used in Recent Orders and Auto-Trade Log. `BADGE_STYLES` and `BADGE_LABELS` both updated.

Glossary section count: now 28 terms across 4 sections (Signals, Indicators, Trading, Evaluation & Tax).

---

## system_settings Keys (full list)

| Key | Default | Type | Description |
|-----|---------|------|-------------|
| `trading_mode` | `manual` | string | `auto` or `manual` |
| `default_trade_usd` | `500` | float | Base trade size for signal/alert auto-trades |
| `tax_short_term_rate` | `0.37` | float | Short-term cap gains rate (0–1) |
| `tax_long_term_rate` | `0.20` | float | Long-term cap gains rate (0–1) |
| `tax_long_term_days` | `365` | int | Days threshold for long-term treatment |
| `insights_extra_symbols` | `` | string | Comma-separated extra symbols for Market Insights |
| `risk_level` | `5` | int | 1–10 risk dial |
| `allow_short_selling` | `false` | bool string | Whether auto-trader can open short positions |

---

## auto_trade_log Schema

```sql
id             INTEGER PRIMARY KEY AUTOINCREMENT
symbol         TEXT NOT NULL
side           TEXT NOT NULL
qty            TEXT NOT NULL
source         TEXT NOT NULL        -- 'signal', 'alert', 'filer', 'retroactive'
source_ref     TEXT NOT NULL        -- e.g. 'RSI Oversold', 'price_below=150'
order_id       TEXT                 -- NULL until phase 2 of two-phase commit
status         TEXT NOT NULL        -- 'pending', 'submitted', 'failed'
error          TEXT
recommendation TEXT                 -- evaluator result: 'proceed', 'caution', 'hold'
reasoning      TEXT                 -- plain-English explanation; NULL on pre-migration rows
created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

---

## Frontend File Inventory

### App shell

- `src/App.tsx` — Bootstrap + periodic polls. `autoTrades` state polled every 30s. `autoOrderIds` Set + `handleMarkAuto()` defined here. Passes `autoTrades` to `PositionsTab`.
- `src/api/client.ts` — All typed API methods. Includes `backfillAutoTrade(orderId)`.
- `src/types/index.ts` — All types. `AutoTradeEntry` has `recommendation`, `reasoning`, `status: 'pending' | 'submitted' | 'failed'`. `AppSettings` has `risk_level` and `allow_short_selling`.

### Tabbed shell layout

| File | Description |
|------|-------------|
| `AppHeader.tsx` | Sticky shell — tab bar + `Header`. |
| `Header.tsx` | Top row (logo, status dot, clock, AUTO/MANUAL pill, settings). |
| `PortfolioStrip.tsx` | Persistent 4-cell portfolio summary above tab content. |
| `SettingsDrawer.tsx` | Right-side slide-in drawer wrapping `SettingsPanel`. |
| `tabs/WatchlistTab.tsx` | 2-col grid. Passes `symbolNames` to `Watchlist`. |
| `tabs/PositionsTab.tsx` | Sector strip → `PositionsTable` + `AiNarratives` + `OrdersTable`. Receives `autoTrades` from App, passes to `OrdersTable`. |
| `tabs/FilersTab.tsx` | `TrackedFilersSection` + `AutoTradeLog`. |
| `tabs/DiscoverTab.tsx` | `MarketInsights` + `EarningsCalendar`. |
| `tabs/GlossaryTab.tsx` | 28 terms in 4 sections. `warn` badge type added (amber). |

### Leaf components

| File | Description |
|------|-------------|
| `StockRow.tsx` | Accepts `companyName?: string`. Fraunces italic subtitle. |
| `StockDetail.tsx` | 4 tabs: Indicators, Signal History, Alerts, News. |
| `MarketInsights.tsx` | Top performers table. Hover → lazy name fetch. |
| `EarningsCalendar.tsx` | Below Market Insights in Discover tab. |
| `Watchlist.tsx` | Passes `companyName` to each `StockRow`. |
| `PositionsTable.tsx` | Grouped by sector. QTY shows `N [LONG\|SHORT]` badge. Close button uses BUY for shorts. Hover → lazy company name. |
| `AiNarratives.tsx` | Two manual-trigger cards: Portfolio Briefing + Risk Analysis. |
| `OrdersTable.tsx` | Recent orders. AUTO rows show ▼ expand for reasoning (or source/source_ref fallback). `→ auto` backfill button on manual rows. Hover → lazy company name. |
| `AutoTradeLog.tsx` | Auto-trade history. Click ▼ to expand reasoning. `pending` status shown as "? pending". |
| `TradeModal.tsx` | Order entry modal with `TradeEvaluation`. |
| `TrackedFilersSection.tsx` | Filer tracking UI. |
| `SettingsPanel.tsx` | Risk Dial (1–10 slider), Allow Short Selling toggle, trade size, tax rates. |

---

## PositionsTable — Long/Short Display

QTY column: absolute value + inline `[LONG]` (green) or `[SHORT]` (red) badge.
Market value: `Math.abs(market_value)` — removes confusing negative sign for shorts.
Close button: `isLong ? 'sell' : 'buy'` with `Math.abs(qty)` — correctly closes both directions.

---

## Massive (Polygon.io) Integration

Rate limit guard: `asyncio.Semaphore(3)`. Polygon free tier = 5 req/min.

---

## Deployment Plan (decided 2026-05-15, unchanged)

- **Frontend** → Vercel
- **Backend** → Render Starter ($7/mo) or Railway Hobby ($5/mo)
- **Database** → SQLite on persistent volume

**What needs to change before deploy:**
1. Add `VITE_API_BASE_URL` env var to frontend (currently hardcoded to `localhost:8000`)
2. Add CORS origin for the Vercel frontend URL in FastAPI
3. Write a `render.yaml` or `railway.json` build config
4. Ensure `DATABASE_URL` points to persistent volume path on Render/Railway
5. Copy all secrets from `backend/.env` into the host's env var dashboard

---

## What Changed This Session (2026-05-19)

### Bug Fixes

1. **AUTO orders without reasoning now show expand arrow** — `hasReasoning` condition in `OrdersTable.tsx` changed from `isAuto && !!tradeEntry?.reasoning` to `isAuto && tradeEntry !== undefined`. Pre-migration rows (where `reasoning = NULL`) were silently hiding the ▼ button despite being valid AUTO orders.
2. **Reasoning fallback for null entries** — expand panel now shows `"Auto-trade triggered by {source} · {source_ref}"` when `reasoning` is null, so all AUTO orders surface useful context.

### New Features

3. **Glossary evaluator verdict cards** — "Evaluator Recommendation" generic card replaced with three specific cards: Proceed (green), Caution (amber), Hold (red), each with exact trigger conditions.
4. **`warn` badge type in Glossary** — new amber badge (`#fbbf24`) matching the evaluator badge color already used in Recent Orders and Auto-Trade Log.

### Files Modified

**Frontend:**
- `src/components/OrdersTable.tsx` — `hasReasoning` logic, fallback reasoning text in expand panel
- `src/components/tabs/GlossaryTab.tsx` — `warn` badge type, three evaluator verdict cards replacing one generic card

---

## Next Recommended Tasks

### Immediate — Production Deploy

1. **Deploy backend to Render/Railway** — wire up env vars, CORS, build config. Backend first so the URL is known before deploying frontend.
2. **Deploy frontend to Vercel** — set `VITE_API_BASE_URL` to the Railway/Render backend URL, `VITE_API_TOKEN` to match backend `API_TOKEN`.

### Next in Feature Build Sequence

3. **QUIVER_API_TOKEN** — Add real token to `backend/.env`, restart, test filer Sync for `nancy-pelosi`. Still the only blocker for the full Phase 2b copy-trading flow.
4. **AI Narrative enhancements** — Current narratives use positions data only. Could add Polygon news per symbol to the briefing. Also: "Why did I buy this?" trade journal (note on each manual trade → Claude synthesis).

### Low Priority / Future

5. **EDGAR 13F XML parsing** — `edgar.py` is a stub. Full 13F XML support deferred.
6. **Notifications delivery** — `notifications_log` entries written but never sent. Resend (email) was the preferred provider.
7. **Portfolio analytics** — P&L over time, gain/loss breakdown, benchmark vs S&P.
8. **Mobile / responsive** — Desktop-only. Below ~1100px the layout breaks.
9. **Delete `PortfolioSummary.tsx`** — Unreferenced since the tab refactor; safe to delete.
