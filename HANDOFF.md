# Ledger — Session Handoff

Last updated: 2026-05-14. Pick up from here.

---

## What exists right now

### Phases complete
- **Phase 1** — Full scaffold: FastAPI backend, React/TS frontend, SQLite, all Alpaca proxy endpoints, watchlist CRUD, indicators (RSI/MACD/SMA/Bollinger), signal computation, trade modal with order polling.
- **Phase 2a** — Signal scanner (60s loop, writes `signal_events` on transitions), alert scanner (30s loop, writes `notifications_log`), signal history tab + alert creation UI in expanded stock row.

### Phase 2b — IN PROGRESS (stopped mid-session)

**Done:**
- `backend/app/database.py` — 3 new tables appended to `_DDL`: `tracked_filers`, `filer_transactions`, `filer_holdings`
- `backend/app/quiver.py` — Quiver Quant httpx client + `parse_amount_range()` helper
- `.env.example` — `QUIVER_API_TOKEN` documented

**NOT YET DONE (do these in order):**

1. `backend/app/config.py` — add `quiver_api_token: str = ""`
2. `backend/app/edgar.py` — stub only (returns metadata, no XML parsing yet)
3. `backend/app/main.py` — import + wire quiver lifecycle, register filers router
4. `backend/app/routers/filers.py` — 6 endpoints (see plan file for full spec)
5. `frontend/src/types/index.ts` — add `TrackedFiler`, `FilerTransaction`, `FilerHolding`
6. `frontend/src/api/client.ts` — add 6 filer API methods
7. `frontend/src/components/TradeModal.tsx` — add optional `sourceNote?: string` prop
8. `frontend/src/components/TrackedFilersSection.tsx` — new component (largest piece)
9. `frontend/src/components/StockRow.tsx` — add `heldByFiler?: boolean` → blue `13F` badge
10. `frontend/src/components/Watchlist.tsx` — pass `heldSymbols?: Set<string>` to StockRow
11. `frontend/src/App.tsx` — wire TrackedFilersSection, extend `openTrade` with `sourceNote`
12. `backend/tests/test_filers.py` — unit tests for `parse_amount_range`, integration tests for refresh

**Full detailed plan:** `.claude/plans/before-we-implement-2bm-vivid-nygaard.md`

---

## How to run

```bash
# Backend (from backend/ directory)
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal, from frontend/ directory)
cd frontend
npm run dev
```

Then open http://localhost:5173.

---

## Environment variables

Backend reads from `backend/.env` (NOT the project root `.env`).
Frontend reads from `frontend/.env.local`.

```bash
# backend/.env — minimum required fields
ALPACA_API_KEY=PK...
ALPACA_API_SECRET=...
ALPACA_ENV=paper
ALPACA_FEED=iex
API_TOKEN=<shared secret>
DATABASE_URL=ledger.db
QUIVER_API_TOKEN=<get from quiverquant.com>   ← needed for Phase 2b

# frontend/.env.local
VITE_API_TOKEN=<same value as API_TOKEN above>
```

To add your Quiver token: sign up at https://www.quiverquant.com/signup (free tier is enough), then add to `backend/.env`.

---

## Critical rules (do not break)

1. **No auto-trading.** TradeModal always requires the user to click Submit. Never wire auto-submission.
2. **`ALPACA_ENV=paper` default everywhere.** Live mode requires explicit env var + UI warning.
3. **Keys on backend only.** Frontend never sees Alpaca keys.
4. **No financial advice in copy.** Signals are descriptive. Use "RSI indicates oversold conditions", not "good time to buy."
5. **Python 3.9 compatibility.** See section below.

---

## Python 3.9 compatibility rules

Python 3.9.6 is installed. Every new `.py` file must follow these rules:

```python
# Top of every new file:
from __future__ import annotations
```

**In Pydantic `BaseModel` subclasses** — use `Optional[X]`, NOT `X | None`:
```python
# WRONG — Pydantic evaluates at class-definition time, fails on 3.9
limit_price: str | None = None

# CORRECT
from typing import Optional
limit_price: Optional[str] = None
```

**In regular function signatures** — `X | None` is fine under `from __future__ import annotations`:
```python
def parse_amount_range(s: str | None) -> tuple[float | None, float | None]:  # OK
```

---

## Key design decisions for Phase 2b

### Copy trading model
Manual mirror only — user sees a filer's transaction, clicks **Mirror**, TradeModal opens pre-filled (symbol, side, estimated qty), user adjusts and clicks Submit. No auto-execution.

### Data source
- **Congressional trades:** Quiver Quant API (`GET /beta/live/congresstrading/{slug}`). Slug format: `"nancy-pelosi"`, `"ro-khanna"`.
- **Institutional 13F:** SEC EDGAR — stubbed in v1, full XML parsing deferred to later.

### Quiver API response shape
```json
{
  "Ticker": "AAPL",
  "Transaction": "Purchase",
  "Range": "$15,001 - $50,000",
  "TransactionDate": "2025-01-15",
  "FilingDate": "2025-01-28",
  "Name": "Nancy Pelosi"
}
```
`Transaction` values: `"Purchase"` | `"Sale (Full)"` | `"Sale (Partial)"` | `"Exchange"`.

### `parse_amount_range()` (already in `quiver.py`)
| Input | Output |
|-------|--------|
| `"$15,001 - $50,000"` | `(15001.0, 50000.0)` |
| `"$1,001"` | `(1001.0, 1001.0)` |
| `"Over $1,000,000"` | `(1000000.0, None)` |
| `None` / `""` | `(None, None)` |

### Position sizing (computed in frontend, not backend)
```
midpoint = (amount_low + amount_high) / 2
         — if amount_high is None: midpoint = amount_low * 2
         — if both None: qty = "1"
suggestedQty = floor(midpoint / currentPrice)
```
Shown in `sourceNote`: `"Mirroring Nancy Pelosi · Purchase · Jan 15 · est. 178 shares ($32,500 ÷ $182.40)"`

### Transaction → side mapping
- `"Purchase"` → `'buy'`
- anything containing `"Sale"` → `'sell'`
- `"Exchange"` → `'buy'`

### Quiver error handling
| HTTP status from Quiver | Surface as |
|------------------------|-----------|
| 401 | FastAPI 502, message: "Check QUIVER_API_TOKEN in your .env" |
| 404 | FastAPI 422, message: "Slug not found. Try e.g. nancy-pelosi" |
| Other | FastAPI 502 |

### TrackedFilersSection component
Self-manages its own state (filer list, loading states, per-filer expanded view). Does NOT lift state to App except via two callbacks:
- `onMirror(symbol, side, qty, sourceNote)` → App calls `openTrade`
- `onHeldSymbolsChange(symbols: Set<string>)` → App stores, passes to Watchlist → StockRow for the 13F badge

Placed in `App.tsx` between `<OrdersTable />` and the disclaimer footer.

---

## File map (complete)

```
backend/
  app/
    main.py           FastAPI app + lifespan (init_db, alpaca/quiver startup, scanners)
    config.py         pydantic-settings — reads backend/.env
    database.py       aiosqlite, _DDL string, get_db(), init_db()
    alpaca.py         Two httpx clients: trading API + data API
    quiver.py         ✅ Quiver Quant client + parse_amount_range()
    edgar.py          ❌ TO CREATE — stub for EDGAR 13F
    indicators.py     RSI, EMA, SMA, MACD, Bollinger, compute_signals
    auth.py           Bearer token dependency
    scanner.py        signal_scanner_loop + alert_scanner_loop (background tasks)
    routers/
      account.py      GET /api/account
      positions.py    GET /api/positions
      orders.py       GET/POST /api/orders, GET /api/orders/{id}
      market.py       GET /api/snapshots, /api/bars/{symbol}, /api/clock
      watchlist.py    GET/POST/DELETE /api/watchlist
      indicators.py   GET /api/indicators/{symbol}
      signals.py      GET /api/signals/history
      alerts.py       GET/POST/PATCH/DELETE /api/alerts
      filers.py       ❌ TO CREATE — 6 filer endpoints
  tests/
    test_indicators.py  Unit tests for indicator math
    test_filers.py      ❌ TO CREATE

frontend/
  src/
    App.tsx           Root component, state, polling loops
    index.css         CSS variables + Tailwind base
    main.tsx          React entry
    api/client.ts     fetch wrapper, all API calls
    lib/format.ts     fmtMoney, fmtPct, rsiNote, macdNote, bbNote
    types/index.ts    All TypeScript interfaces
    components/
      Header.tsx
      PortfolioSummary.tsx
      Watchlist.tsx
      StockRow.tsx
      StockDetail.tsx      3 tabs: Indicators | Signal History | Alerts
      PositionsTable.tsx
      OrdersTable.tsx
      TradeModal.tsx
      SignalsLog.tsx
      TrackedFilersSection.tsx   ❌ TO CREATE
```

---

## Design system (Bloomberg/editorial aesthetic)

```css
--bg: #0e0e10         /* near-black base */
--bg-elev: #16161a    /* card background */
--bg-card: #1a1a1f    /* second elevation */
--line: #26262d       /* borders */
--line-soft: #1f1f25  /* subtle dividers */
--ink: #e8e6e1        /* primary text */
--ink-soft: #a09c93   /* secondary */
--ink-mute: #6b6860   /* labels */
--accent: #d4a574     /* warm gold — CTAs, active states */
--green: #6fcf97      /* gains, buy signals */
--red: #eb5757        /* losses, sell signals */
--amber: #f2c94c      /* warnings */
--blue: #56a3f0       /* reserved — used for 13F badge */
```

Fonts: `Fraunces` (display/headings), `Inter Tight` (body), `JetBrains Mono` (all numbers, tickers, labels).

Rules: hairline borders not shadows; labels uppercase mono 10px 1.5px letter-spacing; no glassmorphism; no hover-translate; no emojis in labels.

---

## Smoke-test sequence for Phase 2b (after completing all steps)

```bash
TOKEN=$(grep API_TOKEN backend/.env | cut -d= -f2)

# 1. Add Pelosi
curl -X POST http://localhost:8000/api/filers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nancy Pelosi","filer_type":"congress","source_id":"nancy-pelosi"}'

# 2. Refresh from Quiver (need QUIVER_API_TOKEN set first)
curl -X POST http://localhost:8000/api/filers/1/refresh \
  -H "Authorization: Bearer $TOKEN"
# → {"inserted": N, "skipped": 0, "filer_id": 1}

# 3. View transactions
curl http://localhost:8000/api/filers/1/transactions \
  -H "Authorization: Bearer $TOKEN"

# 4. Delete
curl -X DELETE http://localhost:8000/api/filers/1 \
  -H "Authorization: Bearer $TOKEN"
# → 204
```

Then in the browser: scroll to Tracked Filers section, add Pelosi, click Refresh, click Mirror on a trade row, confirm TradeModal opens pre-filled with source attribution.

---

## Git / GitHub

Remote: https://github.com/jgsntg/myledger.git  
Branch: `main`  
Convention: conventional commits (`feat:`, `fix:`, `refactor:`). Small focused commits.
