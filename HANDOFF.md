# Ledger — Claude Handoff

Last updated: 2026-05-26 (Production deploy wiring: CORS env var, API base URL, render.yaml, vercel.json; dead component cleanup; default tax rates corrected).

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
| 8 | Glossary tab — 31 terms across 4 sections | ✅ Done |
| 9 | Auto-trade reasoning, Risk Dial, short-selling guard, two-phase commit | ✅ Done |
| 10 | AUTO order reasoning fix + evaluator verdict glossary cards | ✅ Done |
| 11 | Portfolio chart, tax exposure strip, reconciliation fix, settings UX | ✅ Done |
| 12 | Production deploy wiring (CORS env var, API base URL, render.yaml, vercel.json) | ✅ Done |

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
VITE_API_BASE_URL=          # empty locally — Vite proxy handles /api/*
                             # in Vercel dashboard: https://ledger-backend.onrender.com
```

**Production-only env vars (set in host dashboards, not in .env files):**
- Render: `ALLOWED_ORIGINS=https://your-app.vercel.app` (add after Vercel URL is known)
- Render: `DATABASE_URL=/data/ledger.db` (persistent disk)
- Vercel: `VITE_API_BASE_URL=https://your-backend.onrender.com`

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
- `app/alpaca.py` — Two httpx clients (trading + data). `trading_get()`, `trading_post()`, `data_get()`.
- `app/quiver.py` — Quiver Quant client. `fetch_congress_trades()`.
- `app/massive.py` — Polygon.io client. Rate-limited with `asyncio.Semaphore(3)`.
- `app/symbols.py` — Local NASDAQ/NYSE name lookup (~12k symbols). Registers `GET /api/symbols/names`.
- `app/edgar.py` — **Stub only.** Returns empty holdings.
- `app/indicators.py` — RSI, EMA, SMA, MACD, Bollinger, `compute_signals()`.
- `app/scanner.py` — `signal_scanner_loop()` (60s), `alert_scanner_loop()` (30s). Calls `reconcile_pending_trades()` at the top of every signal scan.
- `app/auto_trader.py` — `maybe_auto_trade()`, `reconcile_pending_trades()`, `_build_reasoning()`, `_compute_qty()`. See Phase 9 + 11 notes.
- `app/evaluator.py` — `evaluate_trade()` → `EvaluationResult`.
- `app/ai.py` — Claude API client. `generate_briefing()` and `generate_risk_narrative()`. On-demand only.
- `app/auth.py` — Bearer token middleware.
- `app/main.py` — FastAPI app, lifespan, scanners.

### Routers (`app/routers/`)

| File | Endpoints |
|------|-----------|
| `account.py` | `GET /api/account`, `GET /api/portfolio-history?period=&timeframe=` |
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

### Glossary: Evaluator Verdict Cards

Replaced the single vague "Evaluator Recommendation" card in the **Evaluation & Tax** section with three dedicated cards:

| Term | Badge | When it appears |
|------|-------|-----------------|
| **Evaluator: Proceed** | green | No concerns — clean trade |
| **Evaluator: Caution** | amber | Short-term gain, wash-sale risk, no position on sell, oversized sell, recent buy before a prior sale |
| **Evaluator: Hold** | red | Within 30 days of long-term threshold (waiting saves 17% tax rate) |

A `warn` badge type (amber, `#fbbf24`) was added to `GlossaryTab.tsx`.

---

## Phase 11 — Portfolio Chart, Tax Strip, Reconciliation Fix (2026-05-22)

### Portfolio Chart (`PortfolioChart.tsx`)

Replaces `PortfolioStrip.tsx` as the top-of-page component (App.tsx renders `<PortfolioChart>` in its place; `PortfolioStrip.tsx` is now dead code, safe to delete).

**Layout:**
- Header row: "Your Portfolio" label + equity value + % change + timestamp + period tabs + refresh button
- Area chart (recharts `AreaChart`, 180px height, gold `#d4a574` stroke + gradient fill)
- 4-cell stats strip attached below chart (equity, buying power, day P&L, open positions)

**Period tabs:** `1D | 1W | 1M | 1Y | All`. Default: **`1M`**.

| Period | Alpaca `period` param | `timeframe` param |
|--------|----------------------|-------------------|
| 1D | `1D` | `1Min` |
| 1W | `1W` | `1H` |
| 1M | `1M` | `1D` |
| 1Y | `1A` | `1D` |
| All | `5A` | `1D` |

**Backend endpoint:** `GET /api/portfolio-history?period=&timeframe=` in `account.py`. Proxies Alpaca's `GET /v2/account/portfolio/history` with `extended_hours=True`. Returns `{ timestamp: number[], equity: (number|null)[], profit_loss: (number|null)[], profit_loss_pct: (number|null)[], base_value: number, timeframe: string }`.

**Dependencies:** `recharts` (npm, installed with `--legacy-peer-deps`), `react-is` (peer dep of recharts, also installed).

**X-axis tick formatting:**
- `1D`: `h:mm AM/PM`
- `1W`: `Weekday Mon DD`
- `1M / 1Y / All`: `Mon DD`

**Tooltip:** `CustomTooltip` component, shows date/time + `fmtMoney(equity)`.

### Tax Impact Strip (`TaxImpactStrip.tsx`)

Shown below `PortfolioChart` on all tabs. Uses `AppSettings` rates for calculations.

**User's tax situation (MFJ, ~$600K income, FL):**
- Short-term rate: **38.8%** = 35% marginal bracket + 3.8% NIIT
- Long-term rate: **23.8%** = 20% LTCG + 3.8% NIIT
- Florida: no state income tax
- NIIT ($250K MFJ threshold): applies — MAGI well above threshold
- Child tax credit: fully phased out above $400K MFJ

**What it shows (2-column layout):**
- **Unrealized P&L** (sum of `position.unrealized_pl`): gross + after-tax at ST rate + after-tax at LT rate + "benefit of waiting" (LT minus ST)
- **Day's P&L** (`equity - last_equity`): gross + after ST-rate tax + tax drag amount
- **NIIT Exposure section**: 3.8% of unrealized gains + 3.8% of day's P&L, shown as separate line items
- **Rate mismatch banner** (amber): shown if configured rates differ from `RECOMMENDED_ST=0.388` / `RECOMMENDED_LT=0.238` by more than 0.5%. Tells user what to set in Settings.

**After-tax formula:** `gross_pl * (1 - rate)` — applies symmetrically to gains (taxes owed) and losses (tax savings from deduction).

**Props:** `{ account: AccountData | null, positions: Position[], settings: AppSettings }`

### Auto-Trade Reconciliation Bug Fix

**Root cause:** When the server process crashes between submitting an Alpaca order (phase 2) and writing the `order_id` back to `auto_trade_log` (phase 3), the record stays as `status='pending', order_id=NULL`. The frontend's `autoOrderIds` set is built by `.filter(Boolean)` on order_ids, so `NULL` entries are excluded — the Alpaca order appeared as "manual" in the Orders table.

**Fix:** `reconcile_pending_trades(db)` in `auto_trader.py`. Called at the top of every `_run_signal_scan()` cycle (every ~60s).

**Algorithm:**
1. Query `auto_trade_log WHERE order_id IS NULL AND status = 'pending'`
2. If none, return immediately (cheap path — one SELECT)
3. Fetch last 100 Alpaca orders (`GET /v2/orders?status=all&limit=100&direction=desc`)
4. For each pending record: find an Alpaca order with matching symbol + side where `abs(order.created_at - record.created_at) <= 7200s` (2-hour window)
5. If matched: `UPDATE auto_trade_log SET order_id=?, status='submitted'`
6. If unmatched AND record is older than 24h: `UPDATE ... SET status='failed', error='Unresolved after 24h…'`
7. `commit()` if any rows updated

### Settings Fixes This Session

**Risk level not persisting across page refresh:**
- Root cause: `SettingsDrawer` keyed `SettingsPanel` on only 4 fields (`default_trade_usd`, `tax_short_term_rate`, `tax_long_term_rate`, `tax_long_term_days`). When the API returned real settings on boot, the key string didn't change, so `SettingsPanel` never remounted — `riskLevel` state stuck at the default `5`.
- Fix: key now includes all 6 mutable fields: `…-${settings.risk_level}-${settings.allow_short_selling}`.

**Tax rates rounding to integers:**
- Root cause: `useState(String(Math.round(settings.tax_short_term_rate * 100)))` truncated decimals — 38.8% stored as 0.388 became `Math.round(38.8) = 39`.
- Fix: `String(Math.round(settings.tax_short_term_rate * 1000) / 10)` — rounds to 1 decimal place. Inputs updated to `step="0.1"`, `max="99.9"`, `min="0.1"`, width widened to 62px.

### Glossary Additions

Three new terms added in the Trading Basics section (after "Unrealized P&L"):
- **Realized P&L** — locked-in gain/loss after a position closes; taxable event
- **P&L % (Return)** — `(current value − cost basis) / cost basis × 100`; normalizes across position sizes
- **Day's P&L** — portfolio equity change since yesterday's close; always short-term for tax purposes

Glossary is now **31 terms** across 4 sections.

---

## system_settings Keys (full list)

| Key | Default | Type | Description |
|-----|---------|------|-------------|
| `trading_mode` | `manual` | string | `auto` or `manual` |
| `default_trade_usd` | `500` | float | Base trade size for signal/alert auto-trades |
| `tax_short_term_rate` | `0.388` | float | Short-term cap gains rate (0–1). MFJ/$600K/FL: 35% bracket + 3.8% NIIT |
| `tax_long_term_rate` | `0.238` | float | Long-term cap gains rate (0–1). MFJ/$600K/FL: 20% LTCG + 3.8% NIIT |
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
order_id       TEXT                 -- NULL until phase 2 of two-phase commit; reconciled by reconcile_pending_trades()
status         TEXT NOT NULL        -- 'pending', 'submitted', 'failed'
error          TEXT
recommendation TEXT                 -- evaluator result: 'proceed', 'caution', 'hold'
reasoning      TEXT                 -- plain-English explanation; NULL on pre-migration rows
created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

---

## Frontend File Inventory

### App shell

- `src/App.tsx` — Bootstrap + periodic polls. Renders `PortfolioChart` + `TaxImpactStrip` above tab content. `autoTrades` state polled every 30s. `autoOrderIds` Set + `handleMarkAuto()` defined here. Passes `autoTrades` to `PositionsTab`.
- `src/api/client.ts` — All typed API methods. Includes `backfillAutoTrade(orderId)`, `getPortfolioHistory(period, timeframe)`.
- `src/types/index.ts` — All types. `AutoTradeEntry` has `recommendation`, `reasoning`, `status`. `AppSettings` has `risk_level` and `allow_short_selling`.

### Tabbed shell layout

| File | Description |
|------|-------------|
| `AppHeader.tsx` | Sticky shell — tab bar + `Header`. |
| `Header.tsx` | Top row (logo, status dot, clock, AUTO/MANUAL pill, settings). |
| `PortfolioChart.tsx` | **New (Phase 11).** Portfolio equity area chart + period tabs + 4-cell stats strip. Replaces `PortfolioStrip`. Default period: `1M`. |
| `TaxImpactStrip.tsx` | **New (Phase 11).** After-tax P&L estimates. Reads `settings.tax_*_rate`. Amber banner if rates don't match recommended (38.8/23.8). |
| ~~`PortfolioStrip.tsx`~~ | **Deleted (2026-05-26).** Was superseded by `PortfolioChart`. |
| `SettingsDrawer.tsx` | Right-side slide-in drawer wrapping `SettingsPanel`. Key now includes `risk_level` + `allow_short_selling` to force remount on settings load. |
| `tabs/WatchlistTab.tsx` | 2-col grid. Passes `symbolNames` to `Watchlist`. |
| `tabs/PositionsTab.tsx` | Sector strip → `PositionsTable` + `AiNarratives` + `OrdersTable`. Receives `autoTrades` from App, passes to `OrdersTable`. |
| `tabs/FilersTab.tsx` | `TrackedFilersSection` + `AutoTradeLog`. |
| `tabs/DiscoverTab.tsx` | `MarketInsights` + `EarningsCalendar`. |
| `tabs/GlossaryTab.tsx` | 31 terms in 4 sections. `warn` badge type (amber). |

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
| `SettingsPanel.tsx` | Risk Dial (1–10 slider), Allow Short Selling toggle, trade size, tax rates (now `step=0.1`, 1-decimal display). |
| ~~`PortfolioSummary.tsx`~~ | **Deleted (2026-05-26).** Predated tabbed refactor. |

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

**Code changes done (Phase 12):** CORS env var, API base URL in client, render.yaml, vercel.json, TypeScript build fix.

**Remaining steps (secrets/config only — no more code needed):**
1. Deploy backend to Render: connect repo, select `backend/` as root, Render reads `render.yaml` automatically. Fill in all `sync: false` secrets in the Render dashboard.
2. Note the Render backend URL (e.g. `https://ledger-backend.onrender.com`).
3. Deploy frontend to Vercel: connect repo, set root to `frontend/`, Vercel reads `vercel.json`. Set two env vars in Vercel dashboard:
   - `VITE_API_TOKEN` = same value as backend `API_TOKEN`
   - `VITE_API_BASE_URL` = the Render backend URL from step 2
4. Note the Vercel URL (e.g. `https://ledger.vercel.app`).
5. Set `ALLOWED_ORIGINS=https://ledger.vercel.app` in the Render backend env dashboard, then redeploy backend.

---

## What Changed This Session (2026-05-26)

### Phase 12 — Production Deploy Wiring

1. **`ALLOWED_ORIGINS` env var** (`config.py`) — CORS origins now read from `ALLOWED_ORIGINS` env var (comma-separated). Default: `http://localhost:5173`. On Render, set to the Vercel frontend URL.
2. **Dynamic CORS in `main.py`** — `allow_origins` now parsed from `settings.allowed_origins.split(",")`. Local dev unchanged; production just needs the env var.
3. **`VITE_API_BASE_URL` in `client.ts`** — `const BASE = import.meta.env.VITE_API_BASE_URL ?? ''` prepended to every `fetch` call. Empty in local dev (Vite proxy still handles `/api/*`). Set to the Render backend URL in Vercel's env dashboard.
4. **`backend/render.yaml`** — Render deployment config: Docker runtime, Starter plan, 1 GB persistent disk mounted at `/data`, `DATABASE_URL=/data/ledger.db`, all secrets listed as `sync: false` (fill in dashboard).
5. **`frontend/vercel.json`** — Vercel build config: `buildCommand`, `outputDirectory: dist`, `framework: vite`.
6. **`tsconfig.node.json`** — Added `"DOM"` to `lib` to fix pre-existing TypeScript error (`URL` and `import.meta.url` not recognized). Build now passes cleanly.

### Cleanup

7. **Deleted dead components** — `PortfolioStrip.tsx` and `PortfolioSummary.tsx` removed.
8. **Default tax rates corrected** — `database.py` defaults changed from 0.37/0.20 → **0.388/0.238**.

### Files Modified

- `backend/app/config.py` — added `allowed_origins` field
- `backend/app/main.py` — CORS reads from `settings.allowed_origins`; added `from app.config import settings`
- `backend/render.yaml` — **new file**
- `frontend/src/api/client.ts` — `BASE` constant + `fetch(BASE + path, ...)`
- `frontend/vercel.json` — **new file**
- `frontend/tsconfig.node.json` — `"lib"` now includes `"DOM"`
- `backend/app/database.py` — default `tax_short_term_rate` 0.37 → 0.388; `tax_long_term_rate` 0.20 → 0.238
- `frontend/src/components/PortfolioStrip.tsx` — **deleted**
- `frontend/src/components/PortfolioSummary.tsx` — **deleted**

---

## What Changed This Session (2026-05-22)

### New Features

1. **Portfolio equity chart** (`PortfolioChart.tsx`) — recharts `AreaChart` with 1D/1W/1M/1Y/All period toggle. Default `1M`. Gold area fill. Custom tooltip. Refresh button with spin animation. Replaces static `PortfolioStrip`.
2. **Backend portfolio history endpoint** — `GET /api/portfolio-history?period=&timeframe=` proxies Alpaca's `/v2/account/portfolio/history`.
3. **Tax Exposure strip** (`TaxImpactStrip.tsx`) — shows unrealized P&L and day's P&L with after-tax amounts at both ST and LT rates, NIIT breakdown, and amber banner when configured rates differ from recommended (38.8%/23.8% for user's MFJ/$600K/FL situation).
4. **Glossary additions** — Realized P&L, P&L % (Return), Day's P&L. Now 31 terms.
5. **Chart 1W period** — added between 1D and 1M, uses hourly bars (`timeframe=1H`).

### Bug Fixes

6. **Risk level not persisting** — `SettingsDrawer` key now includes `risk_level` and `allow_short_selling`, forcing `SettingsPanel` to remount when real settings load from API on boot.
7. **Tax rates rounding to integers** — initializer changed from `Math.round(rate * 100)` to `Math.round(rate * 1000) / 10`. Inputs use `step="0.1"`, `max="99.9"`.
8. **AUTO orders not marked after process crash** — `reconcile_pending_trades()` added to `auto_trader.py`. Runs at top of every signal scan. Matches `order_id=NULL, status='pending'` records to Alpaca orders by symbol + side + ≤2h timestamp delta. Stale records (>24h unresolved) marked `failed`.

### Files Modified

**Backend:**
- `app/routers/account.py` — added `GET /api/portfolio-history`
- `app/auto_trader.py` — added `reconcile_pending_trades()`, added `datetime/timezone` import
- `app/scanner.py` — imports + calls `reconcile_pending_trades(db)` at top of `_run_signal_scan()`

**Frontend:**
- `src/App.tsx` — swapped `PortfolioStrip` → `PortfolioChart` + `TaxImpactStrip`; added imports
- `src/api/client.ts` — added `getPortfolioHistory(period, timeframe)`
- `src/components/PortfolioChart.tsx` — **new file**
- `src/components/TaxImpactStrip.tsx` — **new file**
- `src/components/SettingsDrawer.tsx` — key includes `risk_level` + `allow_short_selling`
- `src/components/SettingsPanel.tsx` — tax rate init fixed (1 decimal); inputs `step=0.1`, `max=99.9`, `width=62px`
- `src/components/tabs/GlossaryTab.tsx` — 3 new P&L terms
- `frontend/package.json` — added `recharts`, `react-is` (peer dep)

---

## Next Recommended Tasks

### Immediate — High Value

1. **Deploy to production** — All code is ready. Follow the 5-step sequence in the Deployment Plan section above (secrets only, no more code needed).
2. **QUIVER_API_TOKEN** — Add real token to `backend/.env` locally and to Render env dashboard. Still the only blocker for the full Phase 2b copy-trading flow.
3. **Update tax rates in existing DB** — The `INSERT OR IGNORE` defaults now use 38.8%/23.8% for fresh databases. If your local `ledger.db` still has 37%/20%, run: `UPDATE system_settings SET value='0.388' WHERE key='tax_short_term_rate'; UPDATE system_settings SET value='0.238' WHERE key='tax_long_term_rate';` or update via Settings drawer.

### Next in Feature Build Sequence

4. **Realized P&L tracking** — No running tally of closed-trade gains/losses for the tax year. Alpaca doesn't return cost basis on closed orders; would require tracking entry price at buy time.
5. **Bundle splitting** — Production build is 582 KB / 170 KB gzipped (one chunk). Vite warns above 500 KB. Low priority — app is single-user, but worth splitting recharts into a lazy chunk.

### Low Priority / Future

7. **AI Narrative enhancements** — Current narratives use positions data only. Could add Polygon news per symbol to the briefing.
8. **EDGAR 13F XML parsing** — `edgar.py` is a stub. Full 13F XML support deferred.
9. **Notifications delivery** — `notifications_log` entries written but never sent. Resend (email) was the preferred provider.
10. **Mobile / responsive** — Desktop-only. Below ~1100px the layout breaks.
