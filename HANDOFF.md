# Ledger — Claude Handoff

Last updated: 2026-05-26 — Production deployed (Vercel + Render live); market-wide news endpoint replacing SPY proxy; Render disk gotcha documented.

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
| 13 | Catch Me Up tab — market news, watchlist news, today's/yesterday's orders | ✅ Done |
| 14 | Production live — Vercel + Render deployed, env wired, market-wide news endpoint | ✅ Done |

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

**Production env vars (already set in host dashboards):**
- Render: `ALLOWED_ORIGINS=https://myledger-wheat.vercel.app` ✅
- Render: `DATABASE_URL=/data/ledger.db` (persistent disk at `/data`) ✅
- Vercel: `VITE_API_BASE_URL=https://myledger-awc8.onrender.com` ✅
- Vercel: `VITE_API_TOKEN=<shared secret>` ✅

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
- `app/massive.py` — Polygon.io client. Rate-limited with `asyncio.Semaphore(3)`. Functions: `fetch_ticker_details`, `fetch_news`, `fetch_market_news` (no ticker), `fetch_financials`, `fetch_earnings_calendar`, `fetch_sector_map`, `fetch_ticker_names`.
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
| `massive.py` | `GET /api/massive/news` (market-wide), `GET /api/massive/news/{symbol}`, ticker, financials, earnings-calendar, sectors, names |
| `ai.py` | `POST /api/ai/briefing`, `POST /api/ai/risk-narrative` |

---

## Phase 13 — Catch Me Up Tab (2026-05-26)

### What it is

A dedicated "Daily Briefing" tab inserted **before** Watchlist in the tab bar. Replaces the cluttered default view with a clean morning-read layout. The portfolio chart and tax strip are **hidden** on this tab.

### Three sections

**1. Top Market News**
- Fetches `GET /api/massive/news?limit=5` (Polygon market-wide feed, no ticker filter) and shows the top 5 articles.
- Previously used SPY as a proxy — replaced in Phase 14 with the real market-wide endpoint.
- Each card: publisher name, time-ago, title, truncated description (160 chars), external link.
- Hover highlights border to `var(--accent)`.

**2. Your Watchlist in the News**
- Fetches `GET /api/massive/news/{sym}?limit=5` for every symbol in the watchlist, in parallel.
- Merges all results, deduplicates by article `id`, sorts by `published_utc` descending, takes top 5.
- Each card has a ticker tag badge (e.g. `AAPL`) identifying which watchlist symbol surfaced the article.
- Empty state varies: "Add symbols to your watchlist…" vs "No recent news for your watchlist".

**3. Today's Orders + Yesterday's Orders**
- Client-side filters on `orders` prop: `submitted_at.toDateString() === today` / `yesterday`.
- Both use the shared `OrderRow` component: time, symbol, side (green/red), shares, fill price, status.
- Empty state: "No orders today yet" / "No orders from yesterday".

### Key implementation details

- **Backend endpoints used:** `GET /api/massive/news` (market-wide, Phase 14) and `GET /api/massive/news/{symbol}` (watchlist news). Orders filtered client-side from `orders` prop.
- **Visibility guards in App.tsx:**
  - `PortfolioChart` hidden when `activeTab === 'catch-up'`
  - `TaxImpactStrip` **only** shown when `activeTab === 'positions'` (scoped this session — was previously all non-catch-up tabs)
- **Tab id:** `'catch-up'` (kebab-case, matches TypeScript `TabId` union auto-derived from `TABS`).
- **Loading states:** `LoadingSkeleton` (3 grey boxes) for both news sections while fetching; orders filter synchronously from already-loaded `orders` prop.

### Component: `CatchMeUpTab.tsx`

Props: `{ symbols: string[], orders: Order[] }`

Internal sub-components (all file-local):
- `NewsCard` — article link card with tag prop for ticker badge
- `SectionHeader` — title + mono sub-label with bottom border
- `EmptyState` — centered italic placeholder
- `LoadingSkeleton` — 3 grey boxes
- `OrderRow` — single order row used by both Today's and Yesterday's sections

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

**Dependencies:** `recharts` + `react-is` (peer dep), installed via `--legacy-peer-deps`.

### Tax Impact Strip (`TaxImpactStrip.tsx`)

**Scoping (updated Phase 13):** Now rendered **only on the Positions tab**. Previously shown on all tabs except Catch Me Up.

**What it shows (2-column layout):**
- **Unrealized P&L**: gross + after-tax at ST rate + after-tax at LT rate + "benefit of waiting" (LT minus ST)
- **Day's P&L**: gross + after ST-rate tax + tax drag amount
- **NIIT Exposure section**: 3.8% of unrealized gains + 3.8% of day's P&L
- **Rate mismatch banner** (amber): shown if configured rates differ from `RECOMMENDED_ST=0.388` / `RECOMMENDED_LT=0.238` by more than 0.5%

**User's tax rates (MFJ, ~$600K income, FL):**
- Short-term: **38.8%** = 35% bracket + 3.8% NIIT
- Long-term: **23.8%** = 20% LTCG + 3.8% NIIT

**Props:** `{ account: AccountData | null, positions: Position[], settings: AppSettings }`

### Auto-Trade Reconciliation Bug Fix

`reconcile_pending_trades(db)` in `auto_trader.py`. Called at top of every `_run_signal_scan()`. Matches `order_id=NULL, status='pending'` records to Alpaca orders by symbol + side + ≤2h timestamp delta. Stale records (>24h) marked `failed`.

### Settings Fixes

- **Risk level not persisting:** `SettingsDrawer` key now includes all 6 mutable fields (incl. `risk_level`, `allow_short_selling`) to force `SettingsPanel` remount on boot.
- **Tax rates rounding:** init uses `Math.round(rate * 1000) / 10`; inputs `step="0.1"`, `max="99.9"`.

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

- `src/App.tsx` — Bootstrap + periodic polls. `PortfolioChart` hidden on `catch-up` tab. `TaxImpactStrip` only on `positions` tab. `autoTrades` polled every 30s. `autoOrderIds` Set + `handleMarkAuto()` defined here.
- `src/api/client.ts` — All typed API methods. `BASE` constant prepended to every fetch (empty locally, Render URL in prod). Includes `getMarketNews(limit)` → `GET /api/massive/news`.
- `src/types/index.ts` — All types. `AutoTradeEntry` has `recommendation`, `reasoning`, `status`. `AppSettings` has `risk_level` and `allow_short_selling`.

### Tab shell

| File | Description |
|------|-------------|
| `AppHeader.tsx` | Sticky shell — tab bar + `Header`. Tabs: **Catch Me Up** → Watchlist → Positions → Filers → Discover → Glossary. |
| `Header.tsx` | Top row (logo, status dot, clock, AUTO/MANUAL pill, settings). |
| `PortfolioChart.tsx` | Portfolio equity area chart + period tabs + 4-cell stats strip. Hidden on Catch Me Up tab. Default period: `1M`. |
| `TaxImpactStrip.tsx` | After-tax P&L estimates. **Positions tab only.** Amber banner if rates differ from recommended (38.8/23.8). |
| `SettingsDrawer.tsx` | Right-side slide-in drawer wrapping `SettingsPanel`. Key includes all 6 mutable fields to force remount on boot. |
| `tabs/CatchMeUpTab.tsx` | **New (Phase 13).** Daily briefing: market news (Polygon market-wide feed, top 5), watchlist news (per-symbol, deduped, top 5), today's orders, yesterday's orders. No PortfolioChart or TaxImpactStrip. |
| `tabs/WatchlistTab.tsx` | 2-col grid. Passes `symbolNames` to `Watchlist`. |
| `tabs/PositionsTab.tsx` | Sector strip → `PositionsTable` + `AiNarratives` + `OrdersTable`. Receives `autoTrades` from App. |
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
| `OrdersTable.tsx` | Recent orders. AUTO rows show ▼ expand for reasoning (or source/source_ref fallback). `→ auto` backfill button on manual rows. |
| `AutoTradeLog.tsx` | Auto-trade history. Click ▼ to expand reasoning. `pending` shown as "? pending". |
| `TradeModal.tsx` | Order entry modal with `TradeEvaluation`. |
| `TrackedFilersSection.tsx` | Filer tracking UI. |
| `SettingsPanel.tsx` | Risk Dial (1–10 slider), Allow Short Selling toggle, trade size, tax rates (`step=0.1`, 1-decimal display). |

---

## PositionsTable — Long/Short Display

QTY column: absolute value + inline `[LONG]` (green) or `[SHORT]` (red) badge.
Market value: `Math.abs(market_value)` — removes confusing negative sign for shorts.
Close button: `isLong ? 'sell' : 'buy'` with `Math.abs(qty)` — correctly closes both directions.

---

## Massive (Polygon.io) Integration

Rate limit guard: `asyncio.Semaphore(3)`. Polygon free tier = 5 req/min.

---

## Production Deployment (LIVE as of 2026-05-26)

- **Frontend** → Vercel: **https://myledger-wheat.vercel.app**
- **Backend** → Render Starter: **https://myledger-awc8.onrender.com**
- **Database** → SQLite on Render persistent disk at `/data/ledger.db`

All env vars wired. CORS configured. Both services live.

### Vercel CLI

Vercel CLI is authenticated (`vercel whoami` → `jgsntg`). Frontend directory is linked to the `myledger` project (`.vercel/` dir exists). To redeploy:

```bash
# from frontend/ dir
vercel --prod --yes
```

### Render CLI / Extension

No Render CLI available. Render VS Code extension is installed but not yet registering MCP tools in Claude (requires a Claude restart to pick up). Once active, Claude can trigger deploys and check service status directly.

Manual redeploy: push to `main` on GitHub — Render auto-deploys on push.

### ⚠️ Render Disk Gotcha

**First deployment lost data.** The initial Render service started without the persistent disk properly attached, so the SQLite DB lived in the container's ephemeral filesystem. When code was pushed and Render rebuilt the container, that data was wiped.

**Current state:** Disk is now mounted at `/data/`, `DATABASE_URL=/data/ledger.db`. Data **persists across redeploys** from this point forward.

**Rule for future sessions:** Before pushing backend changes that trigger a Render redeploy, confirm the user has no critical live data they need to preserve (or that it's already backed up). Do not push backend redeploys without warning the user.

---

## What Changed This Session (2026-05-26 — Phases 13 + 14)

### New Features

1. **Catch Me Up tab** (`CatchMeUpTab.tsx`) — new first tab ("Daily briefing"). Three sections: Top Market News (market-wide feed, top 5), Your Watchlist in the News (per-symbol fetch, deduped, top 5 with ticker tag), Today's Orders + Yesterday's Orders (client-side date filter from existing `orders` prop).
2. **TaxImpactStrip scoped to Positions only** — previously shown on all tabs except Catch Me Up; now only renders when `activeTab === 'positions'`.
3. **PortfolioChart hidden on Catch Me Up** — clean daily briefing view with no chart noise.
4. **Market-wide news endpoint** (`GET /api/massive/news`) — `fetch_market_news()` in `massive.py` calls Polygon `/v2/reference/news` with no ticker param. Replaces the SPY proxy used in the initial CatchMeUpTab implementation. Route added before `/news/{symbol}` to avoid path collision.
5. **Production deployed** — Frontend live on Vercel, backend on Render. `VITE_API_BASE_URL` set to Render URL. `ALLOWED_ORIGINS` set in Render. Full stack connected.

### Files Modified

**Backend:**
- `app/massive.py` — added `fetch_market_news(limit)` function
- `app/routers/massive.py` — added `GET /api/massive/news` route (placed before `GET /api/massive/news/{symbol}`)

**Frontend:**
- `src/api/client.ts` — added `getMarketNews(limit)` → `GET /api/massive/news`
- `src/components/AppHeader.tsx` — added `catch-up` tab as first entry in `TABS`
- `src/App.tsx` — visibility guards for `PortfolioChart` and `TaxImpactStrip`; `CatchMeUpTab` wired
- `src/components/tabs/CatchMeUpTab.tsx` — **new file**; updated to use `getMarketNews()` instead of SPY proxy

---

## What Changed In Prior Sessions

### 2026-05-26 — Phase 12: Production Deploy Wiring

1. `ALLOWED_ORIGINS` env var in `config.py`; CORS in `main.py` reads from it.
2. `VITE_API_BASE_URL` in `client.ts` prepended to every fetch.
3. `backend/render.yaml` — new Render deployment config.
4. `frontend/vercel.json` — new Vercel build config.
5. `frontend/tsconfig.node.json` — added `"DOM"` lib to fix TypeScript build.
6. Deleted dead components `PortfolioStrip.tsx` and `PortfolioSummary.tsx`.
7. Default tax rates in `database.py` corrected: 0.37/0.20 → 0.388/0.238.

### 2026-05-22 — Phase 11: Portfolio Chart + Tax Strip

1. Portfolio equity area chart with period tabs (recharts).
2. Tax exposure strip with after-tax P&L and NIIT breakdown.
3. `reconcile_pending_trades()` — crash-recovery for two-phase commit.
4. Settings fixes: risk level persistence, tax rate decimal rounding.
5. Glossary: 3 new P&L terms (now 31 total).

---

## Next Recommended Tasks

### Immediate — High Value

1. **Re-add watchlist symbols on production** — The first Render deploy used an ephemeral DB; a subsequent redeploy wiped it. The persistent disk is now active — symbols added going forward will survive redeploys. User needs to re-add their symbols at https://myledger-wheat.vercel.app once.
2. **QUIVER_API_TOKEN** — Add real token to `backend/.env` locally AND to Render env dashboard. Still the only blocker for the full Phase 2b copy-trading flow (Filer sync button).
3. **Update tax rates in production DB** — Fresh Render DB initialized with defaults (0.388/0.238) which are correct. Local `ledger.db` may still have 37%/20% if not updated — fix via Settings drawer or SQL: `UPDATE system_settings SET value='0.388' WHERE key='tax_short_term_rate'; UPDATE system_settings SET value='0.238' WHERE key='tax_long_term_rate';`
4. **Restart Claude to pick up Render extension MCP tools** — User installed Render VS Code extension. After restart, Claude should have direct access to Render service status and deploy triggers.

### Next in Feature Build Sequence

5. **Realized P&L tracking** — No running tally of closed-trade gains/losses for the tax year. Alpaca doesn't return cost basis on closed orders; would require tracking entry price at buy time.
6. **Bundle splitting** — Production build is ~591 KB / 171 KB gzipped (one chunk). Vite warns above 500 KB. Consider lazy-loading recharts.

### Low Priority / Future

7. **DB backup / export** — No backup mechanism. If Render disk is lost, all watchlist/settings/auto-trade history is gone. A simple `GET /api/export` endpoint returning the DB contents as JSON would mitigate risk.
8. **AI Narrative enhancements** — Current narratives use positions data only. Could incorporate Polygon news per symbol.
9. **EDGAR 13F XML parsing** — `edgar.py` is a stub. Full 13F XML support deferred.
10. **Notifications delivery** — `notifications_log` entries written but never sent. Resend (email) was the preferred provider.
11. **Mobile / responsive** — Desktop-only. Below ~1100px the layout breaks.
