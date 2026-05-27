# Ledger — Claude Handoff

Last updated: 2026-05-27 — Production stabilization: Supabase pooler fix, asyncpg type coercion fix, DB health endpoint.

## Current State

FastAPI + React/TypeScript trading dashboard using Alpaca paper trading. **Database is Supabase PostgreSQL** (asyncpg via session-mode connection pooler) — data persists across Render deploys permanently.

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
| 17 | Production stabilization — pooler URL fix, asyncpg type coercion, health endpoint | ✅ Done |

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

**Local dev note:** `DATABASE_URL` must be a PostgreSQL connection string. Add to `backend/.env`:
```
DATABASE_URL=<Supabase session-mode pooler URL>
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
DATABASE_URL=<Supabase session-mode pooler URL>
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
- Render: `DATABASE_URL=<Supabase session-mode pooler URL>` ✅
- Render: `ALLOWED_ORIGINS=https://myledger-wheat.vercel.app` ✅
- Render: `ALPACA_API_KEY`, `ALPACA_API_SECRET`, `API_TOKEN`, `MASSIVE_API_KEY`, `ANTHROPIC_API_KEY` ✅
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
7. **asyncpg type strictness:** Always cast bar data explicitly — `float(b["o/h/l/c"])`, `int(b["v"])` — before passing to `executemany`. asyncpg rejects Python floats for INTEGER columns unlike SQLite.
8. **Supabase connection:** Use the **session-mode pooler URL** (host: `*.pooler.supabase.com`, port `5432`, username prefixed with project ref). The direct connection (`db.*.supabase.co:5432`) is unreachable from Render's Docker containers (IPv6 routing issue).

---

## Backend File Inventory

### Core

- `app/config.py` — Pydantic settings. Fields: alpaca keys, `alpaca_env`, `alpaca_feed`, `api_token`, `database_url` (default `postgresql://localhost/ledger`), `quiver_api_token`, `massive_api_key`, `anthropic_api_key`.
- `app/database.py` — asyncpg pool. `init_db()` creates pool + runs DDL + seeds default settings. Logs masked DB URL and row counts on every startup. Warns loudly if fallback default URL is used. Retries pool creation up to 5× with exponential backoff (1+2+4+8+16s). `get_db()` is an async generator FastAPI dependency. `get_pool()` returns pool directly for background tasks. `_masked_url()` exported for use in health endpoint.
- `app/alpaca.py` — Two httpx clients (trading + data). `trading_get()`, `trading_post()`, `data_get()`. All three log ERROR with status code and response body on any non-2xx from Alpaca.
- `app/quiver.py` — Quiver Quant client. `fetch_congress_trades()`.
- `app/massive.py` — Polygon.io client. Rate-limited with `asyncio.Semaphore(3)`. Functions: `fetch_ticker_details`, `fetch_news`, `fetch_market_news` (no ticker), `fetch_financials`, `fetch_earnings_calendar`, `fetch_sector_map`, `fetch_ticker_names`.
- `app/symbols.py` — Local NASDAQ/NYSE name lookup (~12k symbols). Registers `GET /api/symbols/names`.
- `app/edgar.py` — **Stub only.** Returns empty holdings.
- `app/indicators.py` — RSI, EMA, SMA, MACD, Bollinger, `compute_signals()`.
- `app/scanner.py` — `signal_scanner_loop()` (60s), `alert_scanner_loop()` (30s). Uses `get_pool().acquire()` directly. Calls `reconcile_pending_trades()` at the top of every signal scan.
- `app/auto_trader.py` — `maybe_auto_trade()`, `reconcile_pending_trades()`, `_build_reasoning()`, `_compute_qty()`. Two-phase commit with `RETURNING id`.
- `app/evaluator.py` — `evaluate_trade()` → `EvaluationResult`.
- `app/ai.py` — Claude API client. `generate_briefing()` and `generate_risk_narrative()`. On-demand only.
- `app/auth.py` — Bearer token middleware.
- `app/main.py` — FastAPI app, lifespan, scanners. Includes unauthenticated `GET /api/health` that returns masked DB URL + watchlist/settings row counts.

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

## Phase 17 — Production Stabilization (2026-05-27)

### Root causes diagnosed and fixed

**1. Data loss on every deploy (watchlist + settings resetting)**
- Root cause: Render's Docker container cannot reach Supabase's direct connection endpoint (`db.*.supabase.co:5432`) — IPv6 routing failure (errno 101 "Network unreachable").
- Fix: Switch `DATABASE_URL` in Render dashboard to the **Supabase session-mode pooler URL** (`*.pooler.supabase.com:5432`, username prefixed with project ref like `postgres.zzkriinnegqxxgnqjdef`).
- Note: `ON CONFLICT DO NOTHING` in `init_db()` correctly prevents seed data from overwriting existing rows — the real issue was the connection never reaching Supabase at all.

**2. Watchlist loads but price/indicator data shows "Failed to fetch"**
- Root cause: `asyncpg` strict type checking rejects Python `float` values for `INTEGER NOT NULL` columns. Alpaca's JSON response returns `volume` as a float (e.g., `25000000.0`). The SQLite version (aiosqlite) accepted this silently; asyncpg does not.
- Fix: Explicit casts in `_fetch_bars_with_cache`: `float(b["o/h/l/c"])` and `int(b["v"])` before `executemany`.
- The `executemany` call is now guarded with a try/except that logs but doesn't crash the request, so a cache write failure doesn't take down the bars endpoint.

### Diagnostics added (permanent, useful for future issues)

- `GET /api/health` (no auth required) — returns `{"status": "ok", "database": "...(masked)...", "watchlist_rows": N, "settings_rows": N}`. Quick production sanity check.
- `init_db()` startup log — logs the masked DB URL and row counts after every startup. If DATABASE_URL is the fallback default, logs a loud WARNING.
- Alpaca client error logging — all non-2xx responses from Alpaca now log `ERROR` with the status code and first 200 chars of the response body.
- Indicators endpoint logging — logs `ERROR` if `_fetch_bars_with_cache` throws, `WARNING` if it returns empty bars.
- `_fetch_bars_with_cache` now logs `ERROR` if the bar_cache DB write fails (but continues — bars still return from the live Alpaca response).

### asyncpg retry on startup

`init_db()` retries pool creation up to 5 times with exponential backoff (1, 2, 4, 8, 16 seconds) before failing. This handles transient connectivity issues during Render cold starts.

---

## Phase 15 — SQLite → PostgreSQL/asyncpg Migration

### What changed

**`requirements.txt`:** `aiosqlite` → `asyncpg>=0.29.0`

**DDL changes:** `INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL PRIMARY KEY`, `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`, `?` → `$1,$2,...`, `last_insert_rowid()` → `RETURNING id`, datetime strings → Python `datetime` objects.

**All routers + auto_trader + scanner:** `aiosqlite.Connection` → `asyncpg.Connection`, `db.fetch()` / `db.fetchrow()` / `db.fetchval()` instead of cursor pattern.

**`render.yaml`:** Removed `disk` section and `mountPath`. `DATABASE_URL` → `sync: false` (user provides pooler URL in Render dashboard).

### Production DB

- **Supabase project:** `zzkriinnegqxxgnqjdef` ("MyPlayground" / PicoPaco workspace)
- **Connection:** Session-mode pooler URL (set in Render dashboard — not committed to code)
- Tables created automatically on first startup via `init_db()`.

---

## Phase 16 — Catch Me Up 2×2 Grid Layout

`CatchMeUpTab.tsx` renders differently based on viewport width:

- **≥768px (tablet/desktop):** CSS Grid `grid-template-columns: 1fr 1fr`, `gap: 32px`. Order: Today's Orders | Yesterday's Orders (top row), Top Market News | Watchlist News (bottom row).
- **<768px (mobile):** Original single-column flex stack, same section order.

Breakpoint detection uses `useState(() => window.innerWidth >= 768)` + a `resize` event listener.

---

## Phase 9 — Auto-Trade Intelligence

### Risk Dial (1–10)

Stored in `system_settings` key `risk_level` (default 5). Read on every auto-trade.

| Range | Label | Evaluator gate | Size multiplier |
|-------|-------|----------------|-----------------|
| 1–3 | Conservative | Hard gate — skip if not "proceed" | 50–80% |
| 4–6 | Balanced | Soft gate — log but proceed | 90–120% |
| 7–10 | Aggressive | Bypassed entirely | 140–200% |

### Two-Phase Commit

1. `INSERT` with `status='pending', order_id=NULL`
2. Call Alpaca
3. `UPDATE` same row with `order_id`, `status='submitted'/'failed'`

### Short-Selling Guard

`allow_short_selling` setting (boolean, default `false`). When off, `maybe_auto_trade()` calls `GET /v2/positions/{symbol}` before any sell — skips if no long position.

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
source_ref     TEXT NOT NULL
order_id       TEXT
status         TEXT NOT NULL        -- 'pending', 'submitted', 'failed'
error          TEXT
recommendation TEXT
reasoning      TEXT
created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
```

---

## Frontend File Inventory

### App shell

- `src/App.tsx` — Bootstrap + periodic polls. `PortfolioChart` hidden on `catch-up` tab. `TaxImpactStrip` only on `positions` tab. `autoTrades` polled every 30s.
- `src/api/client.ts` — All typed API methods. `BASE` constant prepended to every fetch.
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

Auto-deploys on push to `main`. Data lives in Supabase — survives all Render redeployments.

**Quick production health check (no auth required):**
```
https://myledger-awc8.onrender.com/api/health
```

### ⚠️ Render Free Plan Spin-Down

Render free services sleep after ~15 min of inactivity. First request after sleep takes 30–60s. The scanner loops keep the backend active during market hours. Weekends/nights it will sleep. Upgrade to Starter ($7/mo) to eliminate cold starts.

### ⚠️ Supabase Free Plan

Free tier Supabase projects pause after **7 days of no database activity**. As long as Render's scanner loops are running (they query the DB every 30–60s), the project stays active. If the production app is idle for 7+ days, the Supabase project will pause and require manual restoration from the Supabase dashboard.

---

## What Changed This Session (2026-05-27)

### Bug Fixes

1. **Watchlist/settings data loss** — Root cause: Render's Docker containers cannot reach Supabase's direct connection endpoint due to IPv6 routing failure (errno 101). Fixed by switching DATABASE_URL to the Supabase session-mode connection pooler URL.
2. **"Failed to fetch" for all watchlist symbols** — Root cause: asyncpg strict type checking rejected Alpaca's float volume values for `INTEGER NOT NULL` bar_cache column. Fixed with explicit `int(b["v"])` and `float(b["o/h/l/c"])` casts in `_fetch_bars_with_cache`.

### New Diagnostics (permanent)

3. **`GET /api/health`** — Public endpoint, no auth needed. Returns masked DB URL + row counts. Use to instantly verify production DB connectivity.
4. **Startup logging** — `init_db()` logs masked DB URL + watchlist/settings row counts after connecting. Warns if fallback default URL detected.
5. **Alpaca error logging** — All non-2xx Alpaca responses now log status + body.
6. **asyncpg retry** — Pool creation retries up to 5× on startup (exponential backoff).

### Files Modified

**Backend:**
- `app/database.py` — logging, `_masked_url()`, startup retry (5×), row count logging after init
- `app/main.py` — `GET /api/health` endpoint
- `app/alpaca.py` — error logging on non-2xx responses
- `app/routers/market.py` — explicit type casts for bar_cache inserts, try/except around executemany, error logging
- `app/routers/indicators.py` — error + warning logging around bar fetch

---

## Next Recommended Tasks

### Immediate — High Value

1. **QUIVER_API_TOKEN** — Add real token to `backend/.env` AND Render env dashboard. Still the only blocker for Filer sync (Phase 2b copy-trading flow).

### Next in Feature Build Sequence

2. **Realized P&L tracking** — No running tally of closed-trade gains/losses for the tax year. Alpaca doesn't return cost basis on closed orders; would need to track entry price at buy time and record fills.
3. **Bundle splitting** — Production build is ~591 KB / 171 KB gzipped (one chunk). Vite warns above 500 KB. Consider lazy-loading recharts.
4. **Render free tier spin-down** — Upgrade to Starter ($7/mo) if the 30–60s cold start becomes annoying. Data safety is no longer a concern.

### Low Priority / Future

5. **AI Narrative enhancements** — Could incorporate Polygon news per symbol.
6. **EDGAR 13F XML parsing** — `edgar.py` is a stub. Full 13F XML support deferred.
7. **Notifications delivery** — `notifications_log` entries written but never sent. Resend (email) was the preferred provider.
8. **Mobile / responsive** — Desktop-only. Below ~768px the layout is partially handled (Catch Me Up), but overall layout below ~1100px breaks.
