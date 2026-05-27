from __future__ import annotations

from typing import AsyncGenerator

import asyncpg

from app.config import settings

_pool: asyncpg.Pool | None = None

_DDL_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS watchlist (
      symbol   TEXT PRIMARY KEY,
      added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes    TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS signal_events (
      id              SERIAL PRIMARY KEY,
      symbol          TEXT NOT NULL,
      signal_type     TEXT NOT NULL,
      signal_label    TEXT NOT NULL,
      price_at_signal REAL NOT NULL,
      rsi_at_signal   REAL,
      triggered_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (symbol) REFERENCES watchlist(symbol) ON DELETE CASCADE
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_signal_events_symbol_time
      ON signal_events(symbol, triggered_at DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS alerts (
      id                SERIAL PRIMARY KEY,
      symbol            TEXT NOT NULL,
      condition         TEXT NOT NULL,
      threshold         REAL NOT NULL,
      active            INTEGER NOT NULL DEFAULT 1,
      created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_triggered_at TIMESTAMP,
      notification_sent INTEGER NOT NULL DEFAULT 0
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(active, symbol)
    """,
    """
    CREATE TABLE IF NOT EXISTS bar_cache (
      symbol     TEXT NOT NULL,
      bar_date   DATE NOT NULL,
      open       REAL NOT NULL,
      high       REAL NOT NULL,
      low        REAL NOT NULL,
      close      REAL NOT NULL,
      volume     INTEGER NOT NULL,
      fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (symbol, bar_date)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_bar_cache_symbol_date
      ON bar_cache(symbol, bar_date DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS notifications_log (
      id        SERIAL PRIMARY KEY,
      kind      TEXT NOT NULL,
      ref_id    INTEGER,
      channel   TEXT NOT NULL,
      recipient TEXT NOT NULL,
      payload   TEXT,
      sent_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      status    TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tracked_filers (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      filer_type TEXT NOT NULL,
      source_id  TEXT NOT NULL UNIQUE,
      added_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS filer_transactions (
      id               SERIAL PRIMARY KEY,
      filer_id         INTEGER NOT NULL REFERENCES tracked_filers(id) ON DELETE CASCADE,
      symbol           TEXT NOT NULL,
      transaction_type TEXT NOT NULL,
      amount_low       REAL,
      amount_high      REAL,
      trade_date       DATE NOT NULL,
      filed_at         TIMESTAMP,
      fetched_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(filer_id, symbol, trade_date, transaction_type)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_filer_transactions_filer
      ON filer_transactions(filer_id, trade_date DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS filer_holdings (
      id          SERIAL PRIMARY KEY,
      filer_id    INTEGER NOT NULL REFERENCES tracked_filers(id) ON DELETE CASCADE,
      symbol      TEXT NOT NULL,
      shares      REAL,
      value_usd   REAL,
      report_date DATE NOT NULL,
      fetched_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(filer_id, symbol, report_date)
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_filer_holdings_filer
      ON filer_holdings(filer_id, report_date DESC)
    """,
    """
    CREATE TABLE IF NOT EXISTS system_settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS auto_trade_log (
      id             SERIAL PRIMARY KEY,
      symbol         TEXT NOT NULL,
      side           TEXT NOT NULL,
      qty            TEXT NOT NULL,
      source         TEXT NOT NULL,
      source_ref     TEXT NOT NULL,
      order_id       TEXT,
      status         TEXT NOT NULL,
      error          TEXT,
      recommendation TEXT,
      reasoning      TEXT,
      created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS idx_auto_trade_log_created
      ON auto_trade_log(created_at DESC)
    """,
]

_DEFAULT_SETTINGS = [
    ("trading_mode", "manual"),
    ("default_trade_usd", "500"),
    ("tax_short_term_rate", "0.388"),
    ("tax_long_term_rate", "0.238"),
    ("tax_long_term_days", "365"),
    ("insights_extra_symbols", ""),
    ("risk_level", "5"),
    ("allow_short_selling", "false"),
]


async def init_db() -> None:
    global _pool
    _pool = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=10)
    async with _pool.acquire() as conn:
        async with conn.transaction():
            for stmt in _DDL_STATEMENTS:
                await conn.execute(stmt)
            for key, val in _DEFAULT_SETTINGS:
                await conn.execute(
                    "INSERT INTO system_settings (key, value) VALUES ($1, $2) "
                    "ON CONFLICT (key) DO NOTHING",
                    key, val,
                )


async def close_db() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    async with _pool.acquire() as conn:
        yield conn


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    return _pool
