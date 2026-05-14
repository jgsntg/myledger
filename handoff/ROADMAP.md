# Roadmap

Phased delivery. Don't try to ship all of this at once. Each phase produces something the user can actually run and test.

## Phase 1: Foundation (target: get to parity with the prototype, securely)

**Goal:** Same features as `prototype/ledger.html`, but with keys on the backend and code in a real project.

1. Scaffold the repo: Vite + React + TS frontend, FastAPI backend, SQLite, `.env.example`, `Dockerfile`s, `docker-compose.yml`
2. Backend: implement `/api/account`, `/api/positions`, `/api/orders` (GET + POST + GET by id), `/api/snapshots`, `/api/bars`, `/api/clock`
3. Backend: implement watchlist endpoints with SQLite
4. Frontend: port the prototype UI to React components. Major components:
   - `<PortfolioSummary />`
   - `<Watchlist />` with `<StockRow />` and `<StockDetail />`
   - `<PositionsTable />`
   - `<OrdersTable />`
   - `<TradeModal />`
   - `<SignalsLog />`
5. Frontend: replace direct Alpaca calls with backend calls
6. Wire up dev tooling: hot reload both sides, basic ESLint/Prettier, pre-commit hook
7. Smoke test: connect, see real account, see watchlist persist across reload, place paper order, see fill update positions

**Done when:** user can `docker-compose up`, open localhost, place a paper trade, see it fill, and close the position — without keys ever leaving the backend.

## Phase 2: Persistent intelligence + 13F holdings

**Goal:** the app becomes more useful than just a thin Alpaca client, and adds the ability to track what politicians and fund managers are holding.

### 2a — Signal persistence & alerts

1. Backend: signal scanner runs every 60s during market hours
2. Backend: write to `signal_events` on signal transitions (off → on)
3. Backend: `/api/signals/history` endpoint
4. Frontend: signal history view per symbol (small inline timeline on the expanded detail panel)
5. Backend: alert CRUD endpoints
6. Frontend: "Create alert" UI on each stock row (modal or inline)
7. Backend: alert scanner with debounce
8. Add `notifications_log` writes (even if no notification channel exists yet — log what *would* have been sent)

**Done when:** user can set "alert me when AAPL crosses $200" and see a record in the log when it triggers (no email yet — that's Phase 3).

### 2b — 13F Holdings tracker

Track publicly disclosed holdings from politicians, hedge funds, and large institutions. 13F filings are legally required quarterly disclosures — free, public, no subscription needed.

**Data source:** [SEC EDGAR full-text search API](https://efts.sec.gov/LATEST/search-index?q=%2213F%22&dateRange=custom) for filings; [Quiver Quant API](https://api.quiverquant.com) (free tier) for pre-parsed congressional trading data. Start with Quiver Quant — it's simpler; fall back to raw EDGAR if needed.

**Database additions:**

```sql
CREATE TABLE tracked_filers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,          -- "Nancy Pelosi", "Berkshire Hathaway"
  filer_type TEXT NOT NULL,          -- 'congress' | 'institution'
  source_id  TEXT NOT NULL UNIQUE,   -- Quiver slug or SEC CIK number
  added_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE filer_holdings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  filer_id    INTEGER NOT NULL REFERENCES tracked_filers(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  shares      REAL,
  value_usd   REAL,
  report_date DATE NOT NULL,
  filed_at    TIMESTAMP,
  fetched_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(filer_id, symbol, report_date)
);
```

**Backend endpoints:**

```
GET    /api/filers                         → list tracked filers
POST   /api/filers                         → { name, filer_type, source_id }
DELETE /api/filers/{id}                    → 204

GET    /api/filers/{id}/holdings           → latest holdings for this filer
GET    /api/filers/{id}/holdings/history   → all filing periods on record

POST   /api/filers/{id}/refresh            → re-fetch from Quiver/EDGAR, update DB
```

Background task: refresh all filer holdings once daily (filings are quarterly, but Quiver updates daily for congress).

**Frontend additions:**

- New "Tracked Filers" section below the watchlist (or as a second tab)
- "Add filer" input: type a name, pick from search results (Quiver has a search endpoint)
- Holdings table per filer: symbol, shares, value, report date, "Add to watchlist" button
- Badge on watchlist rows when a tracked filer holds that stock (e.g. small "13F" tag next to the signal badges)

**Done when:** user can add "Nancy Pelosi" as a tracked filer, see her latest disclosed trades, and click "Add to watchlist" on any holding to start tracking its signals.

## Phase 3: Notifications

**Goal:** the app pings the user when something happens, even if the dashboard isn't open.

1. Pick a notification service. Resend is the easiest for transactional email. Suggest to user.
2. Backend: notification dispatcher reading from queue/scheduler
3. Send emails on alert triggers and (optionally) on strong buy/sell signals
4. Frontend: notification preferences page (which signals trigger emails, quiet hours, etc.)
5. Optional: Web Push API for in-browser notifications when the tab is open

**Done when:** user closes laptop, signal fires on a watched stock, gets an email.

## Phase 4: Backtesting

**Goal:** answer "would this signal have made me money?"

1. Backend: backtest engine. Given a symbol, a signal definition, and a date range, simulate buying on every buy signal and selling on every sell signal. Track P&L, drawdown, win rate, Sharpe.
2. Backend: `/api/backtest` endpoint
3. Frontend: backtest UI — pick symbol, pick signal combo, pick date range, see results
4. Stretch: parameter sweep (try RSI thresholds from 20-40 to find what worked best on this symbol historically)

**Done when:** user can answer "should I trust the Golden Cross signal on TSLA?" with a chart instead of vibes.

## Phase 5: Polish

Things to revisit once core features are solid:

- Charting library (Recharts or lightweight-charts) for proper candlestick charts in the detail view
- More indicators: ATR, Stochastic, Volume-weighted moving average
- Multi-symbol comparison view
- Tax-lot view (Alpaca exposes this via `/v2/positions/{symbol}`)
- Mobile-responsive layout (the prototype assumes desktop)
- Real auth if anyone else ever uses the app
- Deploy story: pick a host, set up CI to deploy on main

## Anti-goals

Things to *not* build, at least not yet:

- **Live trading.** Paper only until the user explicitly says otherwise and we have a real conversation about position sizing and risk management.
- **Algorithmic auto-trading.** Signals inform the user; they pull the trigger. No auto-submit on signal.
- **Social features.** Sharing portfolios, copy trading, leaderboards. Not the point of this tool.
- **Multi-broker support.** Alpaca only. Adding a second broker doubles complexity for marginal value.
- **Crypto.** Stocks only per user request. Crypto can come later if needed.
