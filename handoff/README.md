# Ledger — Handoff Brief for Claude Code

## What this is

A personal stock-tracking dashboard that connects to the Alpaca paper trading API. The user owns this project and uses it to track a watchlist, monitor technical signals (RSI, MACD, moving averages, Bollinger Bands), and place paper trades to test strategies before going live.

A working prototype exists as a single HTML file (`prototype/ledger.html`). It works — keys connect, snapshots refresh, orders submit, positions update — but it's hit the natural ceiling of "single file in a browser." Your job is to turn it into a real project.

## Why we're moving past the prototype

The prototype has three problems that block real use:

1. **API keys live in `sessionStorage`.** Anyone who can run JS in the page (a malicious browser extension, a compromised CDN font load) can exfiltrate them. Keys belong on a backend.
2. **No persistence.** Watchlist resets when the tab closes. No history of signals or trades beyond what Alpaca itself stores.
3. **No tests, no build, no deploy story.** It's one file. Adding features means careful surgery on a 1800-line HTML doc.

## Target architecture

```
┌──────────────────┐         ┌─────────────────┐         ┌──────────────┐
│  React frontend  │ ──────▶ │  FastAPI / Node │ ──────▶ │  Alpaca API  │
│  (Vite + TS)     │ ◀────── │  backend        │ ◀────── │              │
└──────────────────┘         │                 │         └──────────────┘
                             │  ┌───────────┐  │
                             │  │  SQLite   │  │
                             │  └───────────┘  │
                             └─────────────────┘
```

- **Frontend**: React + TypeScript + Vite. Tailwind for styling (the prototype's aesthetic is in `prototype/DESIGN_NOTES.md` — keep that direction).
- **Backend**: FastAPI (Python) preferred — easy to add backtesting and indicator math later with pandas/numpy. Express/Node also fine if the user prefers JS end-to-end. Ask the user before picking.
- **Database**: SQLite to start. Stores watchlist, signal events, alert preferences, user-defined alert thresholds. Migrate to Postgres only if/when needed.
- **Secrets**: Alpaca keys in `.env`, never committed. Server holds them; frontend never sees them.

## What's done (prototype features to carry forward)

The prototype already implements all of this — copy the logic, don't reinvent it:

- Watchlist with add/remove
- Snapshot-based price refresh (single API call for many symbols)
- Daily bars caching for indicators
- Four technical indicators: RSI(14), SMA(50/200), MACD, Bollinger Bands(20, 2σ)
- Signal generation: Golden/Death Cross, RSI oversold/overbought, MACD bull/bear, BB breakouts
- Account summary (equity, buying power, day P&L)
- Open positions table with P&L
- Recent orders table
- Trade modal with market/limit orders, order status polling
- Signals log of recent bullish/bearish events
- Market open/closed indicator

Indicator math is in the prototype's `computeSignals`, `rsi`, `macd`, `bollinger`, `sma`, `ema` functions — port these to the backend.

## What's NOT done yet (build these)

In rough priority order:

1. **Project scaffolding** — Vite + React + TS frontend, FastAPI backend, SQLite, `.env.example`, `Dockerfile`, `docker-compose.yml`, basic CI.
2. **Backend proxy for Alpaca** — Endpoints that wrap Alpaca calls so the frontend never holds keys. See `BACKEND_API.md`.
3. **Persistent watchlist** — `GET/POST/DELETE /watchlist` backed by SQLite.
4. **User-defined price alerts** — "Alert me when AAPL crosses $200." Stored in DB, evaluated server-side on a schedule.
5. **Signal history** — log every signal event to DB so the user can see e.g. "AAPL has triggered RSI Oversold 3 times in the last month."
6. **Email or push notifications** — when an alert or strong signal fires. Start with email via Resend/SendGrid; push notifications are a stretch goal.
7. **Backtesting** — "If I'd bought every Golden Cross and sold every Death Cross on AAPL over the last 5 years, what would my return be?" Use pandas; serve results to the frontend.
8. **Tests** — pytest for backend, vitest for frontend. Focus on indicator math correctness and order submission flow.

## Constraints and principles

- **Paper trading only by default.** The backend should hardcode the paper endpoint unless an explicit `ALPACA_ENV=live` env var is set, and even then surface a loud warning in the UI. The user is not ready for live trading.
- **No financial advice in copy.** Signals are descriptive of past price action, never prescriptive. The prototype's disclaimer language is good; preserve that tone.
- **No bypassing Alpaca's rules.** If Alpaca rejects an order (fractional + limit, market closed, etc.), surface the error verbatim. Don't re-implement Alpaca's validation on the client.
- **Privacy.** This is a personal tool. No analytics, no telemetry, no third-party scripts beyond what's strictly needed (Tailwind/fonts/etc.).
- **Keep it runnable locally.** `docker-compose up` should be enough to launch frontend + backend + db.

## Files in this handoff

- `README.md` — this file
- `prototype/ledger.html` — the working prototype, with all the indicator math and UI patterns
- `prototype/DESIGN_NOTES.md` — typography, color palette, aesthetic direction
- `BACKEND_API.md` — proposed API surface for the backend
- `DATA_MODEL.md` — proposed SQLite schema
- `ROADMAP.md` — phased delivery plan
- `.env.example` — environment variables the user will need
- `ALPACA_NOTES.md` — gotchas learned during prototype work

## First conversation with the user

When the user starts, confirm:

1. **Tech stack preference** — FastAPI (recommended) vs Node/Express for backend
2. **Where they want to deploy eventually** — local-only, Fly.io, Railway, self-hosted on a VPS, etc. Influences Docker setup.
3. **Email service** — do they have a Resend/SendGrid account, or should you suggest one?
4. **Git hosting** — initialize a fresh repo and push to GitHub? They'll need to provide the URL or create one.

Then propose Phase 1 from `ROADMAP.md` and get to work. Don't try to build everything at once.
