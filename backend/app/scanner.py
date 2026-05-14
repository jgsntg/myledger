"""Background scanners for Phase 2a.

Signal scanner — every 60s during market hours:
  Computes indicators for all watchlist symbols and writes to signal_events
  when a signal transitions from off → on since the previous scan cycle.

Alert scanner — every 30s during market hours:
  Evaluates user-defined price/RSI thresholds and writes to notifications_log
  with a 1-hour debounce per alert.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone

from app.alpaca import data_get, trading_get
from app.auto_trader import maybe_auto_trade
from app.config import settings
from app.database import get_db
from app.indicators import compute_signals, rsi as compute_rsi
from app.routers.market import _fetch_bars_with_cache

logger = logging.getLogger(__name__)

# In-memory signal state: symbol → set of active signal labels from last scan.
# Resets on server restart — that's intentional; we only log *transitions*.
_prev_signals: dict[str, set[str]] = {}


# ---------------------------------------------------------------------------
# Signal scanner
# ---------------------------------------------------------------------------

async def signal_scanner_loop() -> None:
    """Runs forever; sleeps 60s between scans."""
    while True:
        try:
            clock = await trading_get("/v2/clock")
            if clock.get("is_open"):
                await _run_signal_scan()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Signal scanner error")
        await asyncio.sleep(60)


async def _run_signal_scan() -> None:
    db = await get_db()
    try:
        async with db.execute("SELECT symbol FROM watchlist") as cur:
            rows = await cur.fetchall()
        symbols = [r["symbol"] for r in rows]

        for symbol in symbols:
            try:
                bars = await _fetch_bars_with_cache(symbol, 365, db)
                if not bars:
                    continue

                closes = [b["c"] for b in bars]
                result = compute_signals(closes)
                price = closes[-1]
                rsi_val = result["rsi"]

                active_labels = {
                    s["label"]
                    for s in result["signals"]
                    if s["type"] != "hold"
                }
                prev_labels = _prev_signals.get(symbol, set())
                new_labels = active_labels - prev_labels

                for sig in result["signals"]:
                    if sig["label"] in new_labels:
                        await db.execute(
                            """INSERT INTO signal_events
                               (symbol, signal_type, signal_label, price_at_signal, rsi_at_signal)
                               VALUES (?, ?, ?, ?, ?)""",
                            (symbol, sig["type"], sig["label"], price, rsi_val),
                        )
                        logger.info("New signal: %s %s @ %.2f", symbol, sig["label"], price)
                        if sig["type"] in ("buy", "sell"):
                            await maybe_auto_trade(
                                symbol=symbol,
                                side=sig["type"],
                                source="signal",
                                source_ref=sig["label"],
                                db=db,
                            )

                if new_labels:
                    await db.commit()

                _prev_signals[symbol] = active_labels

            except Exception:
                logger.exception("Signal scan failed for %s", symbol)

    finally:
        await db.close()


# ---------------------------------------------------------------------------
# Alert scanner
# ---------------------------------------------------------------------------

async def alert_scanner_loop() -> None:
    """Runs forever; sleeps 30s between scans."""
    while True:
        try:
            clock = await trading_get("/v2/clock")
            if clock.get("is_open"):
                await _run_alert_scan()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Alert scanner error")
        await asyncio.sleep(30)


async def _run_alert_scan() -> None:
    db = await get_db()
    try:
        async with db.execute(
            "SELECT id, symbol, condition, threshold, last_triggered_at FROM alerts WHERE active = 1"
        ) as cur:
            alerts = await cur.fetchall()

        if not alerts:
            return

        symbols = list({a["symbol"] for a in alerts})
        try:
            snapshots: dict = await data_get(
                "/v2/stocks/snapshots",
                symbols=",".join(symbols),
                feed=settings.alpaca_feed,
            )
        except Exception:
            logger.exception("Alert scanner: snapshot fetch failed")
            return

        now = datetime.now(timezone.utc)

        for alert in alerts:
            symbol = alert["symbol"]
            snap = snapshots.get(symbol) or {}

            latest_trade = snap.get("latestTrade") or {}
            daily_bar = snap.get("dailyBar") or {}
            price: float | None = latest_trade.get("p") or daily_bar.get("c")
            if price is None:
                continue

            # 1-hour debounce
            if alert["last_triggered_at"]:
                last_str = alert["last_triggered_at"]
                # SQLite stores without timezone — treat as UTC
                last_dt = datetime.fromisoformat(last_str).replace(tzinfo=timezone.utc)
                if (now - last_dt).total_seconds() < 3600:
                    continue

            condition: str = alert["condition"]
            threshold: float = alert["threshold"]
            triggered = False

            if condition == "price_above":
                triggered = price > threshold
            elif condition == "price_below":
                triggered = price < threshold
            elif condition in ("rsi_above", "rsi_below"):
                ind_db = await get_db()
                try:
                    bars = await _fetch_bars_with_cache(symbol, 365, ind_db)
                finally:
                    await ind_db.close()
                if bars:
                    closes = [b["c"] for b in bars]
                    rsi_val = compute_rsi(closes)
                    if rsi_val is not None:
                        if condition == "rsi_above":
                            triggered = rsi_val > threshold
                        else:
                            triggered = rsi_val < threshold

            if triggered:
                await db.execute(
                    "UPDATE alerts SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?",
                    (alert["id"],),
                )
                payload = json.dumps({
                    "symbol": symbol,
                    "condition": condition,
                    "threshold": threshold,
                    "price": price,
                })
                await db.execute(
                    """INSERT INTO notifications_log
                       (kind, ref_id, channel, recipient, payload, status)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    ("alert", alert["id"], "email", "user", payload, "pending"),
                )
                logger.info("Alert triggered: %s %s %.2f (price=%.2f)", symbol, condition, threshold, price)
                side = "buy" if condition in ("price_below", "rsi_below") else "sell"
                await maybe_auto_trade(
                    symbol=symbol,
                    side=side,
                    source="alert",
                    source_ref=f"{condition}={threshold}",
                    db=db,
                )

        await db.commit()

    finally:
        await db.close()


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def start_scanners() -> list[asyncio.Task]:
    """Start both background tasks and return them so they can be cancelled on shutdown."""
    signal_task = asyncio.create_task(signal_scanner_loop(), name="signal-scanner")
    alert_task = asyncio.create_task(alert_scanner_loop(), name="alert-scanner")
    return [signal_task, alert_task]
