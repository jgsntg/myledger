# Ledger — Claude Handoff

Last updated: 2026-05-14 (post tabbed-UI refactor + sparkline + insights fix).

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
| 4 | Tabbed UI shell + settings drawer + inline row sparkline | ✅ Done (this session) |

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
| `insights.py` | `GET /api/insights/top-performers?refresh=` — 50-stock default universe + `insights_extra_symbols`, 1-hour in-memory cache, returns top 50 each for 7d/14d/30d windows sorted by return_pct desc. |

### Tests

- `backend/tests/test_filers.py` — tests for `parse_amount_range` and ASGI refresh flow with mocked Quiver.
- `pytest` and `ruff` are **not installed** in `backend/.venv`. Install before running.

---

## Frontend File Inventory

### App shell

- `src/App.tsx` — Bootstrap: loads watchlist, clock, settings, stock data, auto-trade log. Periodic polls: clock 30s, stocks 30s, account 20s, auto-trades 30s. Manages `tradingMode`, `autoTrades`, `heldSymbols`, `tradeTarget`, `activeTab` (persisted to URL hash `#watchlist|#positions|#filers|#discover`).
- `src/api/client.ts` — All typed API methods including `evaluateTrade`, `getSettings`, `updateSettings`, `getAutoTrades`, `getInsightsTopPerformers`.
- `src/types/index.ts` — All TypeScript types including `AppSettings`, `EvaluationResult`, `AutoTradeEntry`, `InsightEntry`, `TopPerformers`.

### Tabbed shell layout

The UI is reorganized into a persistent shell + 4 tabs (`Watchlist` / `Positions` / `Filers` / `Discover`). Settings opens in a right-side drawer instead of inline. Design tokens unchanged.

| File | Description |
|------|-------------|
| `AppHeader.tsx` | Sticky shell — composes `Header` on top + tab bar below. Exports `TABS` and `TabId`. Tab bar uses `role="tablist"` with `aria-selected`. Active tab gets accent underline + Fraunces italic label. |
| `Header.tsx` | Top row only (logo, status dot, market clock, AUTO/MANUAL pill, ⚙ Settings button). Prop is `onOpenSettings` (renamed from `onConnect`). The sticky `<header>` wrapper now lives in `AppHeader`. |
| `PortfolioStrip.tsx` | Persistent 4-cell portfolio summary above tab content. Drops the section title — used as anchor strip, not a section. Cell padding 22×26, value font 30px. |
| `SettingsDrawer.tsx` | Right-side slide-in (420px, scrim, Esc to close, focus management). Wraps existing `SettingsPanel` unchanged. |
| `tabs/WatchlistTab.tsx` | 2-col grid (`1fr 380px`, gap 32). `Watchlist` left, `SignalsLog` sticky at `top: 140` right. |
| `tabs/PositionsTab.tsx` | Vertical stack (gap 44) of `PositionsTable` + `OrdersTable`. |
| `tabs/FilersTab.tsx` | Vertical stack (gap 44) of `TrackedFilersSection` + `AutoTradeLog`. |
| `tabs/DiscoverTab.tsx` | Passthrough wrapper around `MarketInsights`. |

### Leaf components

| File | Description |
|------|-------------|
| `PortfolioSummary.tsx` | **Superseded by `PortfolioStrip.tsx`.** File still exists but is no longer imported anywhere — safe to delete in a future cleanup. |
| `Watchlist.tsx` | Stock list with add/remove. Passes `heldSymbols` for 13F badge. Rendered inside `WatchlistTab`. |
| `StockRow.tsx` | Watchlist row. 7-column grid: symbol, price, change, **inline 30-day sparkline**, signals, Trade, ✕. Blue `13F` badge if held by a tracked filer. Click expands `StockDetail` below. `MiniSparkline` component is local to this file (120×32 SVG, last 30 closes, green/red filled area). |
| `StockDetail.tsx` | Expanded chart + indicator panel. Has 3 internal tabs: Indicators (full 60-day Sparkline + RSI/MA/MACD/BB cards), Signal History, Alerts. |
| `SignalsLog.tsx` | Live feed of new signal events (buy/sell/warn). Rendered sticky in Watchlist tab. |
| `PositionsTable.tsx` | Open positions with Trade button. |
| `OrdersTable.tsx` | Recent orders. **Source column** shows green `AUTO` pill or muted `manual` label based on cross-reference with auto-trade log. |
| `TradeModal.tsx` | Order entry modal. Fetches `TradeEvaluation` on open and on side change. Submit always available — evaluation is advisory only. Global overlay; not inside any tab. |
| `TradeEvaluation.tsx` | Evaluation panel inside TradeModal. Green PROCEED / amber CAUTION / red HOLD. |
| `TrackedFilersSection.tsx` | Filer tracking UI: Track form, Sync, Remove, expand row, Mirror button. Auto-mirrors on Sync if mode=auto. |
| `AutoTradeLog.tsx` | Table of all auto-trade attempts. Section head upgraded to Fraunces italic 26px (matches Positions / Orders section heads). |
| `MarketInsights.tsx` | Discover tab content. Top 50 performers across 7/14/30-day windows. Defensive descending sort by `return_pct` applied client-side regardless of payload order. Universe = 50-stock default + user extras (`insights_extra_symbols` in settings). |
| `SettingsPanel.tsx` | Form fields for trade size + tax rates. Now rendered inside `SettingsDrawer`. |

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

## What changed this session (2026-05-14)

1. **Tabbed UI shell** — `App.tsx` no longer renders one long vertical page. It now renders `AppHeader` (sticky), `PortfolioStrip` (persistent above tab content), one of `WatchlistTab` / `PositionsTab` / `FilersTab` / `DiscoverTab`, the disclaimer, then the `SettingsDrawer` and `TradeModal` overlays. Active tab is stored in `useState<TabId>` and persisted to `window.location.hash`. Tab content unmounts when not active; all state still lives in `App`. See `design_handoff_ledger_tabs/README.md` for the original spec.
2. **Settings drawer** — `SettingsPanel` is no longer rendered inline below the header. It's wrapped in `SettingsDrawer` (right-side slide-in, scrim, Esc-to-close). `Header.tsx` prop `onConnect` → `onOpenSettings`.
3. **Inline sparkline on watchlist rows** — `StockRow.tsx` grew a 7th grid column with a 120×32 SVG mini-chart showing the last 30 daily closes (green/red filled area, matches `data.change >= 0`). Grid template: `1.2fr 1fr 1fr 120px 1.4fr 70px 40px`. Full 60-day chart still in the expanded `StockDetail`.
4. **AutoTradeLog section head** — upgraded from mono 11px uppercase to Fraunces italic 26px with bottom border, matching other section heads.
5. **Top performers** — backend `insights.py` `top_n` 10 → 50. Frontend adds a defensive `.sort((a,b) => b.return_pct - a.return_pct)` because users reported alphabetic-looking ordering (cause unconfirmed — possibly stale 1-hour cache from before, or stable-sort tiebreak preserving Alpaca's alphabetic response order). Click **Refresh** in the Discover tab after backend restart to bust the in-memory cache.

### Files modified
- `frontend/src/App.tsx` — return JSX rewritten; state/effects unchanged; added `activeTab` + hash sync.
- `frontend/src/components/Header.tsx` — outer `<header>` wrapper removed (moved to AppHeader); prop renamed.
- `frontend/src/components/AutoTradeLog.tsx` — section head restyled.
- `frontend/src/components/StockRow.tsx` — added local `MiniSparkline`, new grid column.
- `frontend/src/components/MarketInsights.tsx` — defensive client-side sort.
- `backend/app/routers/insights.py` — `top_n = 50`.

### Files created
- `frontend/src/components/AppHeader.tsx`
- `frontend/src/components/PortfolioStrip.tsx`
- `frontend/src/components/SettingsDrawer.tsx`
- `frontend/src/components/tabs/{WatchlistTab,PositionsTab,FilersTab,DiscoverTab}.tsx`

### Known leftover
- `frontend/src/components/PortfolioSummary.tsx` is now unreferenced. Delete in a future cleanup pass if no one is importing it externally.
- `design_handoff_ledger_tabs/` is the design reference bundle (HTML/JSX prototype). Untracked. Keep or remove per preference.

---

## Next Recommended Tasks

### High priority

1. **QUIVER_API_TOKEN** — Add real token to `backend/.env`, restart backend, test Sync for `nancy-pelosi`. Still the only thing blocking the full filer flow.
2. **Sync error display** — `TrackedFilersSection` currently shows the full `502: {"detail": ...}` string. Should extract and show only the `detail` field.
3. **Validate insights sort** — Open Discover tab, click Refresh, confirm top 50 rows are in descending `return_pct` order across all three windows (7d / 14d / 30d). If still alphabetic-looking, investigate `_fetch_and_rank` more carefully — the sort there is correct, so suspect cache or response shape.

### Medium priority

4. **Backend dev deps** — Install `pytest`, `pytest-asyncio`, `ruff` into `backend/.venv` and run tests.
5. **Auto-trade qty for signals** — Currently hardcoded to `1` share. Could add a configurable default trade size in `system_settings` (e.g. `default_trade_usd=500`) so auto-trades size themselves by dollar amount.
6. **Evaluator tax rates** — Currently hardcoded at 37%/20%. Could expose as user-configurable settings.
7. **Discover card grid (optional)** — `design_handoff_ledger_tabs/README.md` describes a 4-up card grid with sparklines as a visual upgrade for `MarketInsights`. Currently we render the existing single-column rank table, which is fine.
8. **Delete `PortfolioSummary.tsx`** — Unreferenced after this session's refactor.

### Low priority / future

9. **EDGAR 13F XML parsing** — `edgar.py` is a stub. Full implementation would parse SEC EDGAR XML for institutional 13F holdings.
10. **Live mode workflow** — When `ALPACA_ENV=live`: auto-trading is blocked by design, but a review queue (trades proposed but pending approval) would be the natural next step.
11. **Notifications delivery** — `notifications_log` entries are written but never sent. Resend (email) was the preferred provider noted in earlier sessions.
12. **Portfolio analytics** — P&L over time, gain/loss breakdown, benchmark comparison vs S&P.
13. **Mobile / responsive** — Currently desktop-only (`max-width: 1600px`, fixed grid columns). The 2-col Watchlist (`1fr 380px`) and 4-col portfolio strip both stop looking right below ~1100px. Out of scope until requested.
