# Data Model

SQLite for v1. Schema is small enough to manage with raw SQL migrations; bring in Alembic (FastAPI) or Knex/Prisma (Node) if migrations get hairy.

## Tables

### `watchlist`

User's tracked symbols.

```sql
CREATE TABLE watchlist (
  symbol     TEXT PRIMARY KEY,
  added_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes      TEXT  -- optional user notes per symbol
);
```

### `signal_events`

Every time a technical signal flips on for a watched symbol, log it. Used for "AAPL has triggered Golden Cross 2 times this year" and for backtesting display.

```sql
CREATE TABLE signal_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol          TEXT NOT NULL,
  signal_type     TEXT NOT NULL,   -- 'buy', 'sell', 'hold'
  signal_label    TEXT NOT NULL,   -- 'Golden Cross', 'RSI Oversold', etc.
  price_at_signal REAL NOT NULL,
  rsi_at_signal   REAL,
  triggered_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (symbol) REFERENCES watchlist(symbol) ON DELETE CASCADE
);

CREATE INDEX idx_signal_events_symbol_time ON signal_events(symbol, triggered_at DESC);
```

Dedupe at write time: don't insert a duplicate signal if the same (symbol, signal_label) fired in the previous scan cycle. Only insert when the signal *transitions* from off to on.

### `alerts`

User-defined price/indicator thresholds.

```sql
CREATE TABLE alerts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol              TEXT NOT NULL,
  condition           TEXT NOT NULL,   -- 'price_above', 'price_below', 'rsi_above', 'rsi_below'
  threshold           REAL NOT NULL,
  active              INTEGER NOT NULL DEFAULT 1,  -- 0/1
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_triggered_at   TIMESTAMP,
  notification_sent   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_alerts_active ON alerts(active, symbol);
```

### `bar_cache`

Optional but useful. Caches daily bars so we don't re-fetch the same history every restart.

```sql
CREATE TABLE bar_cache (
  symbol      TEXT NOT NULL,
  bar_date    DATE NOT NULL,
  open        REAL NOT NULL,
  high        REAL NOT NULL,
  low         REAL NOT NULL,
  close       REAL NOT NULL,
  volume      INTEGER NOT NULL,
  fetched_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (symbol, bar_date)
);

CREATE INDEX idx_bar_cache_symbol_date ON bar_cache(symbol, bar_date DESC);
```

On bar fetch: query cache first for the date range; only hit Alpaca for missing dates.

### `notifications_log`

Track what we've sent so the user can audit and so we can debug.

```sql
CREATE TABLE notifications_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,        -- 'alert', 'signal'
  ref_id      INTEGER,              -- alerts.id or signal_events.id
  channel     TEXT NOT NULL,        -- 'email', 'push'
  recipient   TEXT NOT NULL,
  payload     TEXT,                 -- JSON snapshot of what was sent
  sent_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status      TEXT NOT NULL         -- 'sent', 'failed'
);
```

## What we deliberately do NOT store

- **Alpaca order history.** Alpaca is the source of truth; query their API. Storing would just create a sync nightmare.
- **Positions.** Same reason — Alpaca knows.
- **Account balance / equity.** Same.
- **Real-time tick data.** Stream from Alpaca live or fetch on demand.
- **API keys.** Environment variables only. Never in the DB.

## Migrations

Use whatever the chosen framework's migration tool is. First migration creates all five tables. Keep migrations small and reversible.
