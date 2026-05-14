# Backend API Surface

The backend is a thin proxy over Alpaca plus persistence for things Alpaca doesn't store (watchlist, alerts, signal history). It holds the Alpaca keys; the frontend never sees them.

All endpoints return JSON. Errors use HTTP status codes + `{"error": "message"}` body.

## Auth

For v1, this is a single-user personal app. Skip user accounts. Protect with a single shared secret in `Authorization: Bearer <token>` header (token in `.env`). If/when this becomes multi-user, swap in proper auth.

## Endpoints

### Account & Market Data (proxy Alpaca)

```
GET  /api/account
     → { equity, last_equity, buying_power, cash, ... }
     Wraps GET /v2/account

GET  /api/positions
     → [{ symbol, qty, avg_entry_price, current_price, market_value, unrealized_pl, unrealized_plpc }]
     Wraps GET /v2/positions. Treat 404 as empty array.

GET  /api/orders?limit=20&status=all
     → [{ id, symbol, side, qty, type, status, submitted_at, filled_avg_price, ... }]
     Wraps GET /v2/orders

GET  /api/orders/{id}
     → single order object
     Used for status polling after submission

POST /api/orders
     Body: { symbol, qty, side, type, time_in_force, limit_price? }
     → submitted order object
     Wraps POST /v2/orders. Pass errors through verbatim.

GET  /api/snapshots?symbols=AAPL,MSFT,...
     → { AAPL: { latestTrade, latestQuote, dailyBar, prevDailyBar, ... }, ... }
     Wraps GET /v2/stocks/snapshots. Cache for 5s to absorb client polling.

GET  /api/bars/{symbol}?timeframe=1Day&days=365
     → [{ t, o, h, l, c, v }]
     Wraps GET /v2/stocks/{symbol}/bars. Cache daily bars for 1 hour during market hours, 12 hours otherwise.

GET  /api/clock
     → { is_open, next_open, next_close }
     Wraps GET /v2/clock
```

### Watchlist (server-stored)

```
GET    /api/watchlist
       → [{ symbol, added_at }]

POST   /api/watchlist
       Body: { symbol }
       → created entry, or 409 if duplicate
       Validate symbol against Alpaca's /v2/assets endpoint before adding.

DELETE /api/watchlist/{symbol}
       → 204
```

### Indicators & Signals (computed server-side)

```
GET  /api/indicators/{symbol}
     → {
         rsi: number,
         sma50: number,
         sma200: number,
         macd: { macd, signal, histogram },
         bollinger: { upper, middle, lower },
         signals: [{ type: 'buy'|'sell'|'hold', label: string }]
       }
     Computed from cached daily bars + latest price.

GET  /api/signals/history?symbol=AAPL&days=30
     → [{ symbol, type, label, price_at_signal, triggered_at }]
     Returns all signal events that fired for this symbol in the window.
```

### Alerts (user-defined thresholds)

```
GET    /api/alerts
       → [{ id, symbol, condition, threshold, active, created_at, last_triggered_at }]

POST   /api/alerts
       Body: { symbol, condition: 'price_above'|'price_below'|'rsi_above'|'rsi_below', threshold: number }
       → created alert

PATCH  /api/alerts/{id}
       Body: { active: bool } or other mutable fields

DELETE /api/alerts/{id}
       → 204
```

### Background tasks (no endpoint, server-internal)

- **Signal scanner**: every 60s during market hours, compute indicators for all watchlist symbols. If a new signal fires that wasn't active in the previous tick, write to `signal_events` table and send notification.
- **Alert scanner**: every 30s during market hours, evaluate user-defined alerts against latest snapshots. If triggered and `last_triggered_at` is more than 1 hour ago (debounce), fire notification and update timestamp.

## Rate limit handling

Alpaca's free tier allows 200 requests/minute. The server should:
- Cache snapshots aggressively (5s TTL is plenty)
- Cache daily bars for 1 hour minimum
- Coalesce concurrent requests for the same data
- Return 429 to clients if the backend is being hammered (shouldn't happen in single-user mode)

## CORS

In dev: allow `http://localhost:5173` (Vite default).
In prod: lock to the actual frontend domain.
