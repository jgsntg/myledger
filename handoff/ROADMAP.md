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

## Phase 2: Persistent intelligence

**Goal:** the app becomes more useful than just a thin Alpaca client.

1. Backend: signal scanner runs every 60s during market hours
2. Backend: write to `signal_events` on signal transitions (off → on)
3. Backend: `/api/signals/history` endpoint
4. Frontend: signal history view per symbol (small inline timeline on the expanded detail panel)
5. Backend: alert CRUD endpoints
6. Frontend: "Create alert" UI on each stock row (modal or inline)
7. Backend: alert scanner with debounce
8. Add `notifications_log` writes (even if no notification channel exists yet — log what *would* have been sent)

**Done when:** user can set "alert me when AAPL crosses $200" and see a record in the log when it triggers (no email yet — that's Phase 3).

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
