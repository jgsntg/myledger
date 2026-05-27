# Ledger — Claude Handoff

Last updated: 2026-05-27 — SQLite→PostgreSQL migration (Supabase); Catch Me Up 2×2 desktop grid layout.

## Current State

FastAPI + React/TypeScript trading dashboard using Alpaca paper trading. **Database is now Supabase PostgreSQL** (asyncpg) — data persists across Render deploys permanently.

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
| 15 | SQLite → PostgreSQL/asyncpg migration; Supabase as persistent production DB | ✅ Done |
| 16 | Catch Me Up 2×2 grid layout on desktop/tablet; mobile unchanged | ✅ Done |

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

**Local dev note:** `DATABASE_URL` must now be a PostgreSQL connection string. Add to `backend/.env`:
```
DATABASE_URL=postgresql://postgres:eaeKRuCkqkHABdyC@db.zzkriinnegqxxgnqjdef.supabase.co:5432/postgres
```
The local `ledger.db` SQLite file is no longer used.

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
DATABASE_URL=postgresql://postgres:eaeKRuCkqkHABdyC@db.zzkriinnegqxxgnqjdef.supabase.co:5432/postgres
QUIVER_API_TOKEN=<required for filer sync — currently empty>
MASSIVE_API_KEY=<Polygon.io API key — filled in>
ANTHROPIC_API_KEY=<filled in — powers AI Narratives>
```

**`frontend/.env.local`:**
```env
VITE_API_TOKEN=<same value as backend API_TOKEN>
VITE_API_BASE_URL=          # empty locally — Vite proxy handles /api/*
                             # in Vercel dashboard: https://myledger-awc8.onrender.com
```

**Production env vars (set in host dashboards):**
- Render: `DATABASE_URL=postgresql://postgres:eaeKRuCkqkHABdyC@db.zzkriinnegqxxgnqjdef.supabase.co:5432/postgres` ✅ (set 2026-05-27)
- Render: `ALLOWED_ORIGINS=https://myledger-wheat.vercel.app` ✅
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
6. **Database is PostgreSQL (asyncpg).** Never reintroduce aiosqlite. Use `$1/$2/...` placeholders, `ON CONFLICT DO NOTHING/UPDATE`, `RETURNING id` for inserts. No `db.close()` in routers — pool handles lifecycle via `get_db()` generator dependency.

---

## Backend File Inventory

### Core

- `app/config.py` — Pydantic settings. Fields: alpaca keys, `alpaca_env`, `alpaca_feed`, `api_token`, `database_url` (default `postgresql://localhost/ledger`), `quiver_api_token`, `massive_api_key`, `anthropic_api_key`.
- `app/database.py` — asyncpg pool. `init_db()` creates pool + runs DDL + seeds default settings. `get_db()` is an async generator FastAPI dependency (yields pooled connection, no manual close needed). `get_pool()` returns pool directly for background tasks (scanner, auto_trader). `close_db()` called in lifespan shutdown.
- `app/alpaca.py` — Two httpx clients (trading + data). `trading_get()`, `trading_post()`, `data_get()`.
- `app/quiver.py` — Quiver Quant client. `fetch_congress_trades()`.
- `app/massive.py` — Polygon.io client. Rate-limited with `asyncio.Semaphore(3)`. Functions: `fetch_ticker_details`, `fetch_news`, `fetch_market_news` (no ticker), `fetch_financials`, `fetch_earnings_calendar`, `fetch_sector_map`, `fetch_ticker_names`.
- `app/symbols.py` — Local NASDAQ/NYSE name lookup (~12k symbols). Registers `GET /api/symbols/names`.
- `app/edgar.py` — **Stub only.** Returns empty holdings.
- `app/indicators.py` — RSI, EMA, SMA, MACD, Bollinger, `compute_signals()`.
- `app/scanner.py` — `signal_scanner_loop()` (60s), `alert_scanner_loop()` (30s). Uses `get_pool().acquire()` directly (not `get_db()`) since it's a background task outside FastAPI request context. Calls `reconcile_pending_trades()` at the top of every signal scan. Datetime fields from asyncpg are Python `datetime` objects (not strings) — handled accordingly.
- `app/auto_trader.py` — `maybe_auto_trade()`, `reconcile_pending_trades()`, `_build_reasoning()`, `_compute_qty()`. Accepts `asyncpg.Connection`. Uses `RETURNING id` to get `log_id` from pending INSERT. No `db.commit()` calls — asyncpg auto-commits single statements.
- `app/evaluator.py` — `evaluate_trade()` → `EvaluationResult`.
- `app/ai.py` — Claude API client. `generate_briefing()` and `generate_risk_narrative()`. On-demand only.
- `app/auth.py` — Bearer token middleware.
- `app/main.py` — FastAPI app, lifespan (`init_db` + `close_db`), scanners.

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

## Phase 15 — SQLite → PostgreSQL/asyncpg Migration (2026-05-27)

### Why

Render's free plan doesn't support persistent disks. Every deploy wiped the SQLite container file, losing watchlist + settings. Migrated to Supabase (hosted PostgreSQL) — data now outlives any number of redeploys.

### What changed

**`requirements.txt`:** `aiosqlite` → `asyncpg>=0.29.0`

**`app/database.py`** — complete rewrite:
- `init_db()` now creates an asyncpg connection pool (`min_size=2, max_size=10`) then runs all DDL + seeds defaults in a single transaction.
- `get_db()` is an `AsyncGenerator` that yields a pooled connection. FastAPI auto-releases it after each request. **No `db.close()` anywhere in routers.**
- `get_pool()` returns the pool for background tasks.
- `close_db()` gracefully closes the pool on shutdown.

**DDL changes (SQLite → PostgreSQL):**
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`
- `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`
- `INSERT OR REPLACE` → `INSERT ... ON CONFLICT (...) DO UPDATE SET ...`
- `executescript()` → individual `execute()` calls inside a transaction
- `PRAGMA table_info()` column migration checks → removed (Supabase DB is fresh, columns already in DDL)
- `last_insert_rowid()` → `RETURNING id`

**All routers + auto_trader + scanner:**
- `aiosqlite.Connection` → `asyncpg.Connection`
- `async with db.execute(...) as cur: rows = await cur.fetchall()` → `rows = await db.fetch(...)`
- `async with db.execute(...) as cur: row = await cur.fetchone()` → `row = await db.fetchrow(...)`
- `cur.lastrowid` → `await db.fetchval("INSERT ... RETURNING id", ...)`
- `?` placeholders → `$1, $2, $3, ...`
- `dict(row)` still works — asyncpg Records support it
- `aiosqlite.IntegrityError` → `asyncpg.UniqueViolationError`
- Timestamp fields from asyncpg are Python `datetime` objects, not strings — `fromisoformat()` calls removed

**`render.yaml`:** Removed `disk` section and `mountPath`. `DATABASE_URL` set to `sync: false` (user provides in Render dashboard).

**`app/config.py`:** Default `database_url` changed from `"ledger.db"` to `"postgresql://localhost/ledger"`.

### Production DB

- **Supabase project:** `zzkriinnegqxxgnqjdef` ("MyPlayground" / PicoPaco workspace)
- **Connection:** `postgresql://postgres:eaeKRuCkqkHABdyC@db.zzkriinnegqxxgnqjdef.supabase.co:5432/postgres`
- Tables created automatically on first startup via `init_db()`. On first deploy, watchlist was empty and settings seeded with defaults — user re-added symbols after deploy.

---

## Phase 16 — Catch Me Up 2×2 Grid Layout (2026-05-27)

### What changed

`CatchMeUpTab.tsx` now renders differently based on viewport width:

- **≥768px (tablet/desktop):** CSS Grid `grid-template-columns: 1fr 1fr`, `gap: 32px`. Order: Today's Orders | Yesterday's Orders (top row), Top Market News | Watchlist News (bottom row).
- **<768px (mobile):** Original single-column flex stack, `gap: 48`, same section order.

Breakpoint detection uses `useState(() => window.innerWidth >= 768)` + a `resize` event listener (live-responds to window resize). Sections are extracted into named variables (`todaySection`, `yesterdaySection`, `marketSection`, `watchlistSection`) and reused in both render paths.

**Desktop grid order (top→bottom, left→right):**
1. Today's Orders
2. Yesterday's Orders
3. Top Market News
4. Your Watchlist in the News

---

## Phase 13 — Catch Me Up Tab

### Component: `CatchMeUpTab.tsx`

Props: `{ symbols: string[], orders: Order[] }`

Internal sub-components (all file-local):
- `NewsCard` — article link card with tag prop for ticker badge
- `SectionHeader` — title + mono sub-label with bottom border
- `EmptyState` — centered italic placeholder
- `LoadingSkeleton` — 3 grey boxes
- `OrderRow` — single order row used by both Today's and Yesterday's sections

**Backend endpoints used:** `GET /api/massive/news` (market-wide) and `GET /api/massive/news/{symbol}`. Orders filtered client-side from `orders` prop.

**Visibility guards in App.tsx:**
- `PortfolioChart` hidden when `activeTab === 'catch-up'`
- `TaxImpactStrip` **only** shown when `activeTab === 'positions'`

---

## Phase 9 — Auto-Trade Intelligence

### Auto-Trade Reasoning

Every auto-trade stores a `reasoning TEXT` column in `auto_trade_log`. Built by `_build_reasoning()` in `auto_trader.py` — deterministic, no API call. Maps each signal label / alert condition / filer source to a plain-English explanation (why + potential benefit), appends evaluator verdict and risk level context.

**Signal copy map** in `_SIGNAL_COPY` dict (8 entries): RSI Oversold/Overbought, Golden/Death Cross, MACD Bull/Bear, Below/Above Lower/Upper BB.

Displayed in:
- **Auto-Trade Log** (FilersTab) — click ▼ on any row to expand
- **Recent Orders** (PositionsTab) — same expandable pattern, AUTO rows only

### Risk Dial (1–10)

Stored in `system_settings` key `risk_level` (default 5). Read on every auto-trade.

| Range | Label | Evaluator gate | Size multiplier |
|-------|-------|----------------|-----------------|
| 1–3 | Conservative | Hard gate — skip if not "proceed" | 50–80% |
| 4–6 | Balanced | Soft gate — log but proceed | 90–120% |
| 7–10 | Aggressive | Bypassed entirely | 140–200% |

### Two-Phase Commit

1. `INSERT` with `status='pending', order_id=NULL` (auto-committed by asyncpg)
2. Call Alpaca
3. `UPDATE` same row with `order_id`, `status='submitted'/'failed'`

Frontend handles `'pending'` status with a "? pending" indicator + tooltip.

### Short-Selling Guard

`allow_short_selling` setting (boolean, default `false`). When off, `maybe_auto_trade()` calls `GET /v2/positions/{symbol}` before any sell — if no long position exists, the trade is skipped.

---

## Phase 11 — Portfolio Chart, Tax Strip, Reconciliation Fix

### Portfolio Chart (`PortfolioChart.tsx`)

Period tabs: `1D | 1W | 1M | 1Y | All`. Default: `1M`.

| Period | Alpaca `period` | `timeframe` |
|--------|----------------|-------------|
| 1D | `1D` | `1Min` |
| 1W | `1W` | `1H` |
| 1M | `1M` | `1D` |
| 1Y | `1A` | `1D` |
| All | `5A` | `1D` |

**Backend endpoint:** `GET /api/portfolio-history?period=&timeframe=` in `account.py`.

### Tax Impact Strip (`TaxImpactStrip.tsx`)

**Positions tab only.** Shows: Unrealized P&L (gross + after ST/LT rate + "benefit of waiting"), Day's P&L, NIIT Exposure (3.8%). Amber banner if configured rates differ from recommended (38.8/23.8) by >0.5%.

**User's tax rates:** ST 38.8% (35% bracket + 3.8% NIIT), LT 23.8% (20% LTCG + 3.8% NIIT). MFJ, ~$600K income, FL.

---

## system_settings Keys (full list)

| Key | Default | Type | Description |
|-----|---------|------|-------------|
| `trading_mode` | `manual` | string | `auto` or `manual` |
| `default_trade_usd` | `500` | float | Base trade size for signal/alert auto-trades |
| `tax_short_term_rate` | `0.388` | float | Short-term cap gains rate (0–1) |
| `tax_long_term_rate` | `0.238` | float | Long-term cap gains rate (0–1) |
| `tax_long_term_days` | `365` | int | Days threshold for long-term treatment |
| `insights_extra_symbols` | `` | string | Comma-separated extra symbols for Market Insights |
| `risk_level` | `5` | int | 1–10 risk dial |
| `allow_short_selling` | `false` | bool string | Whether auto-trader can open short positions |

---

## auto_trade_log Schema

```sql
id             SERIAL PRIMARY KEY
symbol         TEXT NOT NULL
side           TEXT NOT NULL
qty            TEXT NOT NULL
source         TEXT NOT NULL        -- 'signal', 'alert', 'filer', 'retroactive'
source_ref     TEXT NOT NULL        -- e.g. 'RSI Oversold', 'price_below=150'
order_id       TEXT                 -- NULL until phase 2 of two-phase commit
status         TEXT NOT NULL        -- 'pending', 'submitted', 'failed'
error          TEXT
recommendation TEXT                 -- evaluator result: 'proceed', 'caution', 'hold'
reasoning      TEXT                 -- plain-English explanation
created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

---

## Frontend File Inventory

### App shell

- `src/App.tsx` — Bootstrap + periodic polls. `PortfolioChart` hidden on `catch-up` tab. `TaxImpactStrip` only on `positions` tab. `autoTrades` polled every 30s.
- `src/api/client.ts` — All typed API methods. `BASE` constant prepended to every fetch. Includes `getMarketNews(limit)` and `getTickerNews(symbol, limit)`.
- `src/types/index.ts` — All types. `AutoTradeEntry` has `recommendation`, `reasoning`, `status`. `AppSettings` has `risk_level` and `allow_short_selling`.

### Tab shell

| File | Description |
|------|-------------|
| `AppHeader.tsx` | Sticky shell — tab bar. Tabs: Catch Me Up → Watchlist → Positions → Filers → Discover → Glossary. |
| `Header.tsx` | Top row (logo, status dot, clock, AUTO/MANUAL pill, settings). |
| `PortfolioChart.tsx` | Portfolio equity area chart + period tabs + 4-cell stats strip. Hidden on Catch Me Up tab. |
| `TaxImpactStrip.tsx` | After-tax P&L estimates. **Positions tab only.** |
| `SettingsDrawer.tsx` | Right-side slide-in drawer wrapping `SettingsPanel`. |
| `tabs/CatchMeUpTab.tsx` | Daily briefing. **Desktop (≥768px): 2×2 grid** — today's orders top-left, yesterday's top-right, market news bottom-left, watchlist news bottom-right. Mobile: single-column stack. |
| `tabs/WatchlistTab.tsx` | 2-col grid. Passes `symbolNames` to `Watchlist`. |
| `tabs/PositionsTab.tsx` | Sector strip → `PositionsTable` + `AiNarratives` + `OrdersTable`. |
| `tabs/FilersTab.tsx` | `TrackedFilersSection` + `AutoTradeLog`. |
| `tabs/DiscoverTab.tsx` | `MarketInsights` + `EarningsCalendar`. |
| `tabs/GlossaryTab.tsx` | 31 terms in 4 sections. `warn` badge type (amber). |

### Leaf components

| File | Description |
|------|-------------|
| `StockRow.tsx` | Accepts `companyName?: string`. |
| `StockDetail.tsx` | 4 tabs: Indicators, Signal History, Alerts, News. |
| `MarketInsights.tsx` | Top performers table. |
| `EarningsCalendar.tsx` | Below Market Insights in Discover tab. |
| `Watchlist.tsx` | Passes `companyName` to each `StockRow`. |
| `PositionsTable.tsx` | Grouped by sector. QTY shows `[LONG|SHORT]` badge. |
| `AiNarratives.tsx` | Two manual-trigger cards: Portfolio Briefing + Risk Analysis. |
| `OrdersTable.tsx` | AUTO rows show ▼ expand for reasoning. `→ auto` backfill button. |
| `AutoTradeLog.tsx` | Auto-trade history. Click ▼ to expand reasoning. |
| `TradeModal.tsx` | Order entry modal with `TradeEvaluation`. |
| `TrackedFilersSection.tsx` | Filer tracking UI. |
| `SettingsPanel.tsx` | Risk Dial (1–10 slider), Allow Short Selling toggle, trade size, tax rates. |

---

## Production Deployment

- **Frontend** → Vercel: **https://myledger-wheat.vercel.app**
- **Backend** → Render (free plan): **https://myledger-awc8.onrender.com**
- **Database** → Supabase PostgreSQL (project `zzkriinnegqxxgnqjdef`)

Auto-deploys on push to `main`. No disk needed — data lives in Supabase.

### ⚠️ Render Free Plan Spin-Down

Render free services sleep after ~15 min of inactivity. First request after sleep takes 30–60s. Upgrade to Starter ($7/mo) if this becomes annoying. Data is safe in Supabase regardless.

---

## What Changed This Session (2026-05-27)

### New Features

1. **SQLite → PostgreSQL migration** — Entire backend ported from aiosqlite/SQLite to asyncpg/PostgreSQL. Supabase is now the production database. Data survives all future Render deploys.
2. **Catch Me Up 2×2 grid** — On desktop/tablet (≥768px), sections render as a 2-column CSS grid (orders on top, news on bottom). Mobile unchanged.

### Bug Fixes

- **Watchlist/settings data loss on every deploy** — Root cause was Render free plan has no persistent disk; SQLite DB was ephemeral. Fixed by migrating to Supabase.

### Files Modified

**Backend:**
- `requirements.txt` — `aiosqlite` → `asyncpg`
- `app/database.py` — full rewrite (asyncpg pool, PostgreSQL DDL)
- `app/main.py` — import `close_db`, call in lifespan shutdown
- `app/config.py` — default `database_url` updated
- `app/auto_trader.py` — asyncpg API, `RETURNING id`, no commit calls
- `app/scanner.py` — `get_pool().acquire()` instead of `get_db()` + close
- `app/routers/watchlist.py` — asyncpg, $N placeholders
- `app/routers/settings.py` — asyncpg, `ON CONFLICT DO UPDATE`
- `app/routers/alerts.py` — asyncpg, `RETURNING` for insert, numbered params in dynamic UPDATE
- `app/routers/filers.py` — asyncpg, `ON CONFLICT DO NOTHING RETURNING id` for rowcount check
- `app/routers/signals.py` — asyncpg, `NOW() - $2 * INTERVAL '1 day'` (replaces SQLite `datetime('now', ?)`)
- `app/routers/indicators.py` — type annotation only
- `app/routers/evaluate.py` — asyncpg
- `app/routers/insights.py` — asyncpg
- `app/routers/market.py` — asyncpg, bar_cache upsert uses `ON CONFLICT DO UPDATE`
- `render.yaml` — removed disk section, `DATABASE_URL` → `sync: false`

**Frontend:**
- `src/components/tabs/CatchMeUpTab.tsx` — `isDesktop` state + resize listener; 2×2 grid render path for desktop

---

## Next Recommended Tasks

### Immediate — High Value

1. **Add watchlist symbols + set risk level on production** — Fresh Supabase DB was seeded with defaults. User needs to re-add watchlist symbols and set risk level at https://myledger-wheat.vercel.app (or already done this session).
2. **QUIVER_API_TOKEN** — Add real token to `backend/.env` AND Render env dashboard. Still the only blocker for Filer sync (Phase 2b copy-trading flow).

### Next in Feature Build Sequence

3. **Realized P&L tracking** — No running tally of closed-trade gains/losses for the tax year. Alpaca doesn't return cost basis on closed orders; would need to track entry price at buy time and record fills.
4. **Bundle splitting** — Production build is ~591 KB / 171 KB gzipped (one chunk). Vite warns above 500 KB. Consider lazy-loading recharts.
5. **Render free tier spin-down** — Upgrade to Starter ($7/mo) if the 30–60s cold start becomes annoying. Data safety is no longer a concern.

### Low Priority / Future

6. **AI Narrative enhancements** — Could incorporate Polygon news per symbol.
7. **EDGAR 13F XML parsing** — `edgar.py` is a stub. Full 13F XML support deferred.
8. **Notifications delivery** — `notifications_log` entries written but never sent. Resend (email) was the preferred provider.
9. **Mobile / responsive** — Desktop-only. Below ~768px the layout is partially handled (Catch Me Up), but overall layout below ~1100px breaks.
