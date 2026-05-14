# CLAUDE.md

Instructions for Claude Code working on this project.

## Project: Ledger

Personal stock-tracking dashboard with Alpaca paper trading integration. See `README.md` for full context and `ROADMAP.md` for what to build next.

## Before doing anything

1. Read `README.md` for the project overview
2. Read `ROADMAP.md` to know what phase we're in
3. Read `prototype/ledger.html` to see the working reference — all indicator math and UI patterns live here
4. Read `BACKEND_API.md` and `DATA_MODEL.md` before writing backend code
5. Read `ALPACA_NOTES.md` before touching any Alpaca-facing code
6. Read `prototype/DESIGN_NOTES.md` before touching any UI

## How to work

- **Confirm tech stack with the user before scaffolding.** README recommends FastAPI but the user gets to decide.
- **Build in phases per `ROADMAP.md`.** Don't try to ship Phase 1-5 in one go. Get Phase 1 working end-to-end and tested before starting Phase 2.
- **Always preserve the prototype.** Don't delete or modify `prototype/ledger.html`. It's the reference implementation. The new app replaces it functionally but the file stays as documentation.
- **Match the design.** This isn't a generic SaaS dashboard. See DESIGN_NOTES.md — preserve the editorial/Bloomberg aesthetic, typography choices, color palette.
- **Test as you go.** Indicator math (RSI, MACD, etc.) is the heart of the app. Get unit tests on these before anything else; the prototype's values are a reasonable oracle to compare against.

## Hard rules

1. **Never commit `.env` or any file containing real API keys.** The `.env.example` is the only env file in the repo.
2. **Never default to live trading.** `ALPACA_ENV=paper` is the default everywhere. Live mode requires explicit user confirmation in the UI, and even then surface a persistent warning banner.
3. **Never re-implement Alpaca validation client-side.** If the user submits an invalid order, let Alpaca reject it and surface the error verbatim. Alpaca's rules change; don't fork them.
4. **Never give financial advice in copy.** Signals are descriptive of past price action. Use phrases like "RSI indicates oversold conditions," not "this is a good time to buy."
5. **Keys live on the backend only.** The frontend must never receive, store, or transmit Alpaca keys. Even temporarily. Even encrypted. The whole point of moving past the prototype is to fix this.
6. **No auto-trading.** Signals inform the user; the user pulls the trigger. Never wire up automatic order submission on signal triggers.

## Style preferences

- Backend (if Python): black + ruff, type hints throughout, FastAPI's built-in Pydantic models for I/O validation.
- Frontend: TypeScript strict mode, function components + hooks, no class components. Tailwind for styling.
- Git: conventional commits (`feat:`, `fix:`, `refactor:`, etc.). Small, focused commits. PR-sized increments even if the user isn't using PRs.
- Comments: explain *why*, not *what*. The code shows what. Comments should capture decisions and tradeoffs that aren't obvious from reading.

## When you're unsure

Ask the user. This is a personal tool, not a product with stakeholders. Their preferences win. Don't guess at:
- Tech stack choices not specified above
- Deployment target
- Notification service
- Whether to add features beyond what's in the roadmap

## Working with the prototype as reference

The prototype is a single HTML file with three sections: CSS, HTML, JS. The JS is well-commented and organized into:

- State and constants
- Technical indicator math (port these to backend)
- Mock data generation (don't port — only for offline demo mode)
- Alpaca API calls (port to backend)
- Rendering (port to React)
- Refresh loop (port to backend scheduler + frontend polling/websocket)
- Settings/connection (port: keys go to backend env vars)
- Trade modal (port to React component)

Reading the prototype top-to-bottom is the fastest way to understand the product.
