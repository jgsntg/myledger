# Ledger — Claude Handoff

Last updated: 2026-05-14 (Phase 8 — Glossary tab).

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
| 8 | Glossary tab — 23 terms across Signals, Indicators, Trading, Evaluation & Tax with live search | ✅ Done |

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
- `app/massive.py` — Polygon.io client. `fetch_ticker_details()`, `fetch_news()`, `fetch_financials()`, `fetch_earnings_calendar()`, `fetch_ticker_names()`. Uses `asyncio.Semaphore(3)` to cap concurrent Polygon requests and avoid 429s. **Note: Polygon free tier = 5 req/min. Concurrent test calls will exhaust the limit; normal single-user hover/load usage is fine.**
- `app/symbols.py` — Local symbol name lookup. Downloads `nasdaqlisted.txt` + `otherlisted.txt` from NASDAQ trader at startup (~12,634 symbols). No API key. Also contains `GET /api/symbols/names` router. Strips common suffixes ("Common Stock", "Ordinary Shares", etc.) for clean display names.
- `app/edgar.py` — **Stub only.** Returns empty holdings.
- `app/indicators.py` — RSI, EMA, SMA, MACD, Bollinger, `compute_signals()`.
- `app/scanner.py` — `signal_scanner_loop()` (60s), `alert_scanner_loop()` (30s).
- `app/auto_trader.py` — Mode check, daily cap, evaluator pre-flight, order submit.
- `app/evaluator.py` — `evaluate_trade()` → `EvaluationResult`.
- `app/ai.py` — Claude API client (`claude-sonnet-4-6`). `generate_briefing(positions)` and `generate_risk_narrative(positions, sector_map)`. On-demand only — no auto-scheduling. Raises `RuntimeError` if `ANTHROPIC_API_KEY` is missing.
- `app/auth.py` — Bearer token middleware.
- `app/main.py` — FastAPI app, lifespan (init DB, start clients, load symbol names, start scanners).

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
| `settings.py` | `GET/PATCH /api/settings`, `GET /api/auto-trades` |
| `evaluate.py` | `POST /api/evaluate` |
| `insights.py` | `GET /api/insights/top-performers?refresh=` — 50-stock universe, 1-hour cache. Each `InsightEntry` now includes `closes: List[float]` (last 30 daily closes) for sparkline rendering. `top_n=50`, `limit=10000` on bar fetches (was `50` — that was the cause of only 8 results). |
| `massive.py` | `GET /api/massive/ticker/{symbol}`, `GET /api/massive/news/{symbol}`, `GET /api/massive/financials/{symbol}`, `GET /api/massive/earnings-calendar?symbols=`, `GET /api/massive/sectors?symbols=`, `GET /api/massive/names?symbols=` (deprecated — use `/api/symbols/names`) |
| `ai.py` | `POST /api/ai/briefing` — portfolio briefing narrative; `POST /api/ai/risk-narrative` — sector risk summary. Both accept `positions[]` + optional `sector_map`. Return `{"narrative": "..."}`. 503 if key missing, 502 on Claude error. |

`app/symbols.py` also registers `GET /api/symbols/names?symbols=` — this is the preferred name lookup, backed by local data, zero Polygon calls.

---

## Frontend File Inventory

### App shell

- `src/App.tsx` — Bootstrap + periodic polls. State includes `symbolNames: Record<string, string>` fetched non-blocking after watchlist loads and on each `handleAddSymbol`. Passes `symbolNames` to `WatchlistTab` and `positions` to `DiscoverTab`.
- `src/api/client.ts` — All typed API methods. `getTickerNames` hits `/api/symbols/names`. New methods: `getTickerDetails`, `getTickerNews`, `getTickerFinancials`, `getEarningsCalendar`, `getTickerNames`.
- `src/types/index.ts` — All types. New: `TickerDetails`, `NewsArticle`, `NewsPublisher`, `EarningsEntry`, `EarningsCalendar`. `InsightEntry` now has `closes: number[]`.

### Tabbed shell layout

| File | Description |
|------|-------------|
| `AppHeader.tsx` | Sticky shell — tab bar + `Header`. |
| `Header.tsx` | Top row (logo, status dot, clock, AUTO/MANUAL pill, settings). |
| `PortfolioStrip.tsx` | Persistent 4-cell portfolio summary above tab content. |
| `SettingsDrawer.tsx` | Right-side slide-in drawer wrapping `SettingsPanel`. |
| `tabs/WatchlistTab.tsx` | 2-col grid. Accepts `symbolNames`, passes to `Watchlist`. |
| `tabs/PositionsTab.tsx` | Fetches sector map on mount → renders sector concentration strip → `PositionsTable` + `AiNarratives` + `OrdersTable`. |
| `tabs/FilersTab.tsx` | `TrackedFilersSection` + `AutoTradeLog`. |
| `tabs/DiscoverTab.tsx` | `MarketInsights` + `EarningsCalendar`. Accepts `positions` to union with watchlist symbols for earnings. |
| `tabs/GlossaryTab.tsx` | Static educational reference. 23 terms in 4 sections: Signals (8), Indicators (5), Trading (5), Evaluation & Tax (5). Live search filters across term names and descriptions. No backend. |

### Leaf components

| File | Description |
|------|-------------|
| `StockRow.tsx` | Accepts `companyName?: string`. Renders in *Fraunces italic* below ticker. Grid: `1.2fr 1fr 1fr 120px 1.4fr 70px 40px`. |
| `StockDetail.tsx` | 4 tabs: Indicators, Signal History, Alerts, **News**. News tab shows `NewsPanel` with company profile (name, sector tag, market cap, description, website) + news feed (title, publisher, published time, description snippet). Lazy-fetches from Polygon on tab open. |
| `MarketInsights.tsx` | See **Known Issue** below. Includes `InsightSparkline` (80×28 SVG). Hover on symbol triggers lazy name fetch from `/api/symbols/names` (one call per symbol, cached in component state). |
| `EarningsCalendar.tsx` | Below Market Insights in Discover tab. Shows watchlist + position symbols sorted by days until estimated next earnings. Color coding: red ≤7d, amber ≤14d, green ≤30d. Estimates = `last_filing_date + 91 days`. Disclaimer note in footer. |
| `Watchlist.tsx` | Accepts `symbolNames?: Record<string, string>`, passes `companyName` to each `StockRow`. |
| `PositionsTable.tsx` | Open positions grouped by sector (when `sectorMap` provided). Accepts `sectorMap?: Record<string, string>`. |
| `AiNarratives.tsx` | Two manual-trigger cards in Positions tab: Portfolio Briefing + Risk Analysis. Each has Generate/Regenerate button, loading state, narrative text (Fraunces), and generation timestamp. Hidden when no positions. |
| `OrdersTable.tsx` | Recent orders with AUTO/manual source pill. |
| `TradeModal.tsx` | Order entry modal with `TradeEvaluation`. |
| `TrackedFilersSection.tsx` | Filer tracking UI. |
| `AutoTradeLog.tsx` | Auto-trade history table. |
| `SettingsPanel.tsx` | Form inside `SettingsDrawer`. |

---

## Market Insights Table Layout — Fixed (2026-05-14)

Applied the recommended `max-width: 860px` + `margin: 0 auto` approach on the table container. Also updated grid columns from `'36px 1fr 1fr 80px 1fr 160px'` to `'36px 1fr 100px 80px 90px auto'` (Symbol gets flex space; Return=100px, Price=90px fixed; Actions=auto).

If spacing still feels off after user review, next lever is reducing max-width (try 780px) or removing the `gap: 12` between columns.

---

## Massive (Polygon.io) Integration

### Architecture

- `app/massive.py` — async httpx client, initialized at startup. Key: `MASSIVE_API_KEY` in `backend/.env`.
- Rate limit guard: `asyncio.Semaphore(3)` on concurrent calls. Polygon free tier = 5 req/min. Paid tiers have higher limits.
- All Polygon calls are **backend-only**. Frontend never touches Polygon directly.

### Endpoints

| Backend | Purpose |
|---------|---------|
| `GET /api/massive/ticker/{symbol}` | Company metadata (name, sector, market cap, description, exchange, list_date, homepage_url) |
| `GET /api/massive/news/{symbol}?limit=10` | News articles (title, publisher, published_utc, article_url, description, image_url) |
| `GET /api/massive/financials/{symbol}` | Last 4 quarterly financial statements |
| `GET /api/massive/earnings-calendar?symbols=` | Earnings timeline per symbol (last period, filing date, estimated next, days_until) |

### Symbol Name Lookup (preferred)

**Do not use `/api/massive/names` for company name lookups.** Use `/api/symbols/names` instead — it's backed by the local NASDAQ/NYSE directory (no API calls, instant, 12k+ symbols). The Massive names endpoint is still present but deprecated for this use case.

---

## Earnings Calendar

- Backend: `fetch_earnings_calendar(symbols)` in `massive.py` fans out to `fetch_financials` with `asyncio.Semaphore(3)`.
- Estimation: `last_filing_date + 91 days`. If `filing_date` is null, uses `last_end_date + 126 days`.
- Frontend: `EarningsCalendar.tsx` — loads on Discover tab open, passes union of watchlist + position symbols.
- Polygon free tier note: calling this for many symbols in quick succession will 429. Normal page-load usage is fine.

---

## Symbol Name Lookup

- `app/symbols.py` — downloads and parses `nasdaqlisted.txt` + `otherlisted.txt` from NASDAQ trader at startup.
- 12,634 symbols loaded as of 2026-05-15.
- Name cleaning: splits on " - " to strip class/type suffixes. Also strips " Common Stock", " Ordinary Shares", " Class A", " Class B" trailing suffixes.
- **Watchlist:** `App.tsx` fetches names for all watchlist symbols on init + on `handleAddSymbol`. Stored in `symbolNames` state, threaded through `WatchlistTab → Watchlist → StockRow`. Shown as *Fraunces italic* subtitle under each ticker.
- **Market Insights:** Lazy fetch on hover — `handleSymbolHover` calls `getTickerNames([symbol])` the first time a symbol is hovered, then caches in component state. Never fetches all 50 upfront.

---

## Auto-Trading System

*(unchanged — see previous handoff)*

Trigger → Side mapping, daily cap (1/symbol/day), evaluator pre-flight, `ALPACA_ENV=live` blocks auto-trading.

---

## Trade Evaluator

*(unchanged — see previous handoff)*

Recommendation: hold / caution / proceed based on holding period, estimated tax, wash-sale risk.

---

## Verification

All checks pass as of last session:

```bash
# Frontend
cd frontend && npm run type-check   # clean
cd frontend && npm run build        # not run this session — run before deploy

# Backend
.venv/bin/python -c "import ast; ..."  # AST parse all .py files
```

---

## What Changed This Session (2026-05-15)

### Phase 5 — Massive (Polygon.io) Integration

1. **`app/massive.py`** — new Polygon client with `startup`/`shutdown`, `fetch_ticker_details`, `fetch_news`, `fetch_financials`, `fetch_earnings_calendar` (concurrent fan-out with semaphore), `fetch_ticker_names` (deprecated in favor of symbols.py).
2. **`app/routers/massive.py`** — three endpoints: ticker, news, financials, earnings-calendar, names.
3. **`app/config.py`** — added `massive_api_key`.
4. **`app/main.py`** — massive client in lifespan, massive router registered, `symbols_mod.load()` at startup.
5. **`app/symbols.py`** — local NASDAQ/NYSE name directory. Downloads two NASDAQ trader files at startup, parses into `{symbol: name}` dict, registers `GET /api/symbols/names`.
6. **`app/routers/insights.py`** — `InsightEntry` now includes `closes: List[float]` (last 30 closes). Fixed `limit=50` → `limit=10000` on Alpaca bar fetches (was the root cause of only 8 symbols appearing).
7. **`src/components/StockDetail.tsx`** — added **News tab**: `NewsPanel` shows company profile + news feed. Lazy-fetches Polygon ticker details + news on tab open.
8. **`src/components/EarningsCalendar.tsx`** — new component. Renders below Market Insights in Discover tab.
9. **`src/components/tabs/DiscoverTab.tsx`** — added `positions` prop, renders `EarningsCalendar`.
10. **`src/components/MarketInsights.tsx`** — sortable column headers (click to sort by rank/symbol/return/price), `InsightSparkline` column, hover name tooltip (lazy fetch), layout work (ongoing — see Known Issue).
11. **`src/components/StockRow.tsx`** — accepts `companyName?: string`, shows *Fraunces italic* subtitle.
12. **`src/components/Watchlist.tsx`** — accepts `symbolNames`, passes to rows.
13. **`src/components/tabs/WatchlistTab.tsx`** — passes `symbolNames` through.
14. **`src/types/index.ts`** — `TickerDetails`, `NewsArticle`, `NewsPublisher`, `EarningsEntry`, `closes` on `InsightEntry`.
15. **`src/api/client.ts`** — `getTickerNames`, `getTickerDetails`, `getTickerNews`, `getTickerFinancials`, `getEarningsCalendar`.
16. **`src/App.tsx`** — `symbolNames` state, fetched on init and on add.

---

## Next Recommended Tasks

### Next in Build Sequence

1. **AI Narrative enhancements** — Current narratives use positions data only. Could add Polygon news per symbol to the briefing for a richer summary. Also: "Why did I buy this?" trade journal (note on each manual trade → Claude synthesis).
2. **QUIVER_API_TOKEN** — Add real token to `backend/.env`, restart, test filer Sync for `nancy-pelosi`. Still the only blocker for the full Phase 2b copy-trading flow.

### Low Priority / Future

3. **EDGAR 13F XML parsing** — `edgar.py` is a stub. Full 13F XML support deferred.
4. **Notifications delivery** — `notifications_log` entries written but never sent. Resend (email) was the preferred provider.
5. **Portfolio analytics** — P&L over time, gain/loss breakdown, benchmark vs S&P.
6. **Mobile / responsive** — Desktop-only. Below ~1100px the layout breaks.
7. **Delete `PortfolioSummary.tsx`** — Unreferenced since the tab refactor; safe to delete.
