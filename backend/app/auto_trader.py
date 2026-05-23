"""Auto-trader: submits market orders when trading_mode == 'auto'.

Rules:
- Only fires when system_settings.trading_mode == 'auto'.
- Capped at 1 auto-trade per symbol per calendar day.
- Safety guard: blocked if ALPACA_ENV == 'live' (settings router enforces this too).
- Risk level (1–10) controls evaluator gate strength and trade size multiplier.
- Does NOT close the passed db connection; caller owns the lifecycle.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Optional

import aiosqlite

from app.alpaca import data_get, trading_get, trading_post
from app.config import settings as app_settings
from app.evaluator import evaluate_trade

logger = logging.getLogger(__name__)

_DAILY_CAP = 1  # max auto-trades per symbol per calendar day

# Human-readable explanations per signal label (why action was taken, potential benefit)
_SIGNAL_COPY: dict[str, tuple[str, str]] = {
    "RSI Oversold": (
        "RSI dropped below 30, indicating the stock is oversold relative to recent price action.",
        "Potential benefit: mean reversion bounce as selling pressure exhausts itself.",
    ),
    "RSI Overbought": (
        "RSI exceeded 70, indicating the stock is overbought relative to recent price action.",
        "Potential benefit: locking in gains before a likely pullback to equilibrium.",
    ),
    "Golden Cross": (
        "The 50-day SMA crossed above the 200-day SMA, signaling a long-term bullish trend shift.",
        "Potential benefit: early positioning in a confirmed uptrend backed by moving average alignment.",
    ),
    "Death Cross": (
        "The 50-day SMA crossed below the 200-day SMA, signaling a long-term bearish trend shift.",
        "Potential benefit: reducing exposure ahead of a potential prolonged downtrend.",
    ),
    "MACD Bull": (
        "MACD histogram turned positive — upward momentum is building over the signal line.",
        "Potential benefit: capturing momentum early before broader market recognition.",
    ),
    "MACD Bear": (
        "MACD histogram turned negative — downward momentum is building below the signal line.",
        "Potential benefit: exiting before momentum-driven selling accelerates.",
    ),
    "Below Lower BB": (
        "Price dropped below the lower Bollinger Band — a statistically extreme deviation from the mean.",
        "Potential benefit: buying into an oversold condition with high probability of reversion toward the band midpoint.",
    ),
    "Above Upper BB": (
        "Price exceeded the upper Bollinger Band — a statistically extreme deviation from the mean.",
        "Potential benefit: selling into stretched conditions before volatility contracts back toward the mean.",
    ),
}

_RISK_LABELS: dict[int, str] = {
    1: "most conservative",
    2: "conservative",
    3: "conservative",
    4: "moderately conservative",
    5: "balanced",
    6: "moderately aggressive",
    7: "aggressive",
    8: "aggressive",
    9: "very aggressive",
    10: "most aggressive",
}

# Trade size multiplier per risk level: 50% at 1, 100% at 5, 200% at 10
_RISK_SIZE_MULTIPLIER: dict[int, float] = {
    1: 0.50, 2: 0.65, 3: 0.80, 4: 0.90, 5: 1.00,
    6: 1.20, 7: 1.40, 8: 1.60, 9: 1.80, 10: 2.00,
}


def _build_reasoning(
    source: str,
    source_ref: str,
    side: str,
    risk_level: int,
    recommendation: Optional[str],
    eval_reasons: list[str],
) -> str:
    """Compose a plain-English explanation of why this trade was taken."""
    lines: list[str] = []

    # --- Why was this action taken? ---
    if source == "signal":
        why, benefit = _SIGNAL_COPY.get(
            source_ref,
            (f"Signal '{source_ref}' triggered a {side} condition.", ""),
        )
        lines.append(why)
        if benefit:
            lines.append(benefit)

    elif source == "alert":
        # source_ref format: "price_below=150.0" or "rsi_above=65"
        try:
            condition, raw_threshold = source_ref.split("=", 1)
            threshold = float(raw_threshold)
            cond_map = {
                "price_below": f"Price dropped below your alert threshold of ${threshold:,.2f}.",
                "price_above": f"Price rose above your alert threshold of ${threshold:,.2f}.",
                "rsi_below": f"RSI dropped below your alert threshold of {threshold:.0f}.",
                "rsi_above": f"RSI rose above your alert threshold of {threshold:.0f}.",
            }
            lines.append(cond_map.get(condition, f"Alert condition '{condition}' met at threshold {threshold}."))
        except (ValueError, AttributeError):
            lines.append(f"Alert '{source_ref}' triggered a {side} condition.")
        action_copy = {
            "buy": "Potential benefit: entering a position at a price level you flagged as a buying opportunity.",
            "sell": "Potential benefit: exiting at a price level you flagged as a take-profit or stop target.",
        }
        lines.append(action_copy.get(side, ""))

    elif source == "filer":
        lines.append(
            f"Mirroring a disclosed {side} transaction from tracked filer '{source_ref}'."
        )
        lines.append(
            "Potential benefit: aligning with a significant market participant's disclosed position change."
        )

    else:
        lines.append(f"Source '{source}' triggered a {side} on '{source_ref}'.")

    # --- Evaluator summary ---
    if recommendation and recommendation != "proceed":
        reasons_str = "; ".join(eval_reasons) if eval_reasons else "see evaluator"
        lines.append(
            f"Evaluator flagged '{recommendation}': {reasons_str}. "
            "Trade executed per current risk settings."
        )
    elif recommendation == "proceed":
        lines.append("Evaluator cleared: no tax or wash-sale concerns.")

    # --- Risk level context ---
    label = _RISK_LABELS.get(risk_level, "balanced")
    multiplier = _RISK_SIZE_MULTIPLIER.get(risk_level, 1.0)
    pct = int(multiplier * 100)
    if risk_level <= 3:
        lines.append(
            f"Risk level {risk_level} ({label}) — trade size at {pct}% of default; "
            "evaluator approval required before executing."
        )
    elif risk_level >= 7:
        lines.append(
            f"Risk level {risk_level} ({label}) — trade size at {pct}% of default; "
            "evaluator bypassed to maximize execution speed."
        )
    else:
        lines.append(f"Risk level {risk_level} ({label}) — trade size at {pct}% of default.")

    return " ".join(line for line in lines if line)


async def maybe_auto_trade(
    symbol: str,
    side: str,
    source: str,
    source_ref: str,
    db: aiosqlite.Connection,
    amount_low: Optional[float] = None,
    amount_high: Optional[float] = None,
) -> None:
    """Submit an auto-trade if conditions are met.

    Args:
        symbol: Ticker symbol.
        side: 'buy' or 'sell'.
        source: Origin of the signal — 'signal', 'alert', or 'filer'.
        source_ref: Human-readable label for logging (e.g. 'RSI Oversold', 'price_below=150').
        db: Open aiosqlite connection — caller must not close it before this returns.
        amount_low: Dollar amount lower bound (filer transactions only); used for qty estimation.
        amount_high: Dollar amount upper bound (filer transactions only).
    """
    if app_settings.alpaca_env == "live":
        return

    async with db.execute(
        "SELECT value FROM system_settings WHERE key = 'trading_mode'"
    ) as cur:
        row = await cur.fetchone()
    if not row or row["value"] != "auto":
        return

    today = date.today().isoformat()
    async with db.execute(
        "SELECT COUNT(*) as cnt FROM auto_trade_log WHERE symbol = ? AND DATE(created_at) = ?",
        (symbol, today),
    ) as cur:
        cap_row = await cur.fetchone()
    if cap_row and cap_row["cnt"] >= _DAILY_CAP:
        logger.info("Auto-trade daily cap reached for %s", symbol)
        return

    # Read risk level
    risk_level = 5
    async with db.execute(
        "SELECT value FROM system_settings WHERE key = 'risk_level'"
    ) as cur:
        risk_row = await cur.fetchone()
    if risk_row:
        try:
            risk_level = max(1, min(10, int(float(risk_row["value"]))))
        except (ValueError, TypeError):
            pass

    # Short-selling guard: if allow_short_selling is off, skip sell signals
    # when there is no existing long position to close.
    if side == "sell":
        allow_short: bool = False
        async with db.execute(
            "SELECT value FROM system_settings WHERE key = 'allow_short_selling'"
        ) as cur:
            ss_row = await cur.fetchone()
        if ss_row:
            allow_short = ss_row["value"].lower() == "true"

        if not allow_short:
            try:
                pos = await trading_get(f"/v2/positions/{symbol.upper()}")
                existing_qty = float(pos.get("qty", 0))
                if existing_qty <= 0:
                    logger.info(
                        "Auto-trade skipped: no long position in %s and short selling is disabled", symbol
                    )
                    return
            except Exception:
                # 404 = no position at all — skip
                logger.info(
                    "Auto-trade skipped: no position found for %s and short selling is disabled", symbol
                )
                return

    # Read tax settings for evaluator
    short_term_rate, long_term_rate, long_term_days = 0.37, 0.20, 365
    async with db.execute(
        "SELECT key, value FROM system_settings "
        "WHERE key IN ('tax_short_term_rate', 'tax_long_term_rate', 'tax_long_term_days')"
    ) as cur:
        for row in await cur.fetchall():
            try:
                if row["key"] == "tax_short_term_rate":
                    short_term_rate = float(row["value"])
                elif row["key"] == "tax_long_term_rate":
                    long_term_rate = float(row["value"])
                elif row["key"] == "tax_long_term_days":
                    long_term_days = int(float(row["value"]))
            except (ValueError, TypeError):
                pass

    recommendation: Optional[str] = None
    eval_reasons: list[str] = []

    # Risk 7–10: skip evaluator entirely (aggressive — maximize execution speed)
    if risk_level <= 6:
        try:
            eval_result = await evaluate_trade(
                symbol, side, "1",  # qty placeholder — evaluator cares about symbol/side/holding
                short_term_rate=short_term_rate,
                long_term_rate=long_term_rate,
                long_term_days=long_term_days,
            )
            recommendation = eval_result.recommendation
            eval_reasons = eval_result.reasons
            if recommendation != "proceed":
                logger.info(
                    "Auto-trade pre-flight: %s %s — evaluator says '%s': %s",
                    side, symbol, recommendation, "; ".join(eval_reasons),
                )
                # Risk 1–3: hard gate — skip trade if evaluator is not happy
                if risk_level <= 3:
                    logger.info(
                        "Auto-trade blocked by conservative risk level %d for %s", risk_level, symbol
                    )
                    return
        except Exception:
            logger.warning("Auto-trade: evaluator failed for %s, proceeding anyway", symbol)

    qty = await _compute_qty(symbol, amount_low, amount_high, db, risk_level)

    reasoning = _build_reasoning(source, source_ref, side, risk_level, recommendation, eval_reasons)

    # Phase 1: write a pending record BEFORE calling Alpaca.
    # If the process crashes after the Alpaca call but before the DB write we'd
    # lose the record entirely — the order exists in Alpaca but not locally,
    # causing it to show as "manual" in the UI.  Writing first guarantees there
    # is always a row, even if the status never advances past "pending".
    async with db.execute(
        "INSERT INTO auto_trade_log "
        "(symbol, side, qty, source, source_ref, order_id, status, error, recommendation, reasoning) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (symbol, side, qty, source, source_ref, None, "pending", None, recommendation, reasoning),
    ) as cur:
        log_id = cur.lastrowid
    await db.commit()

    # Phase 2: submit to Alpaca, then update the row with the result.
    order_id: Optional[str] = None
    status = "submitted"
    error: Optional[str] = None

    try:
        result = await trading_post("/v2/orders", {
            "symbol": symbol.upper(),
            "qty": qty,
            "side": side,
            "type": "market",
            "time_in_force": "day",
        })
        order_id = result.get("id")
        logger.info("Auto-trade: %s %s x%s [%s: %s]", side.upper(), symbol, qty, source, source_ref)
    except Exception as exc:
        status = "failed"
        error = str(exc)
        logger.error("Auto-trade failed: %s %s — %s", side, symbol, error)

    await db.execute(
        "UPDATE auto_trade_log SET order_id = ?, status = ?, error = ? WHERE id = ?",
        (order_id, status, error, log_id),
    )
    await db.commit()


async def _compute_qty(
    symbol: str,
    amount_low: Optional[float],
    amount_high: Optional[float],
    db: aiosqlite.Connection,
    risk_level: int = 5,
) -> str:
    multiplier = _RISK_SIZE_MULTIPLIER.get(risk_level, 1.0)
    trade_usd: Optional[float] = None

    if amount_low is None:
        async with db.execute(
            "SELECT value FROM system_settings WHERE key = 'default_trade_usd'"
        ) as cur:
            row = await cur.fetchone()
        if row:
            try:
                trade_usd = float(row["value"])
            except (ValueError, TypeError):
                pass

    try:
        snap = await data_get(
            "/v2/stocks/snapshots",
            symbols=symbol,
            feed=app_settings.alpaca_feed,
        )
        snap_data = snap.get(symbol, {})
        price: Optional[float] = (
            (snap_data.get("latestTrade") or {}).get("p")
            or (snap_data.get("minuteBar") or {}).get("c")
            or (snap_data.get("dailyBar") or {}).get("c")
        )
        if price and price > 0:
            if amount_low is None:
                usd = (trade_usd if trade_usd is not None else 500.0) * multiplier
                return str(max(1, round(usd / price)))
            midpoint = (amount_low + amount_high) / 2 if amount_high else amount_low * 2
            adjusted = midpoint * multiplier
            return str(max(1, round(adjusted / price)))
    except Exception:
        logger.warning("Auto-trade: could not fetch price for %s qty estimate, defaulting to 1", symbol)

    return "1"


async def reconcile_pending_trades(db: aiosqlite.Connection) -> None:
    """Patch auto_trade_log records left as 'pending' after a process crash.

    When the server crashes between submitting the Alpaca order and writing the
    order_id back to the DB, the record stays with order_id=NULL and
    status='pending'.  The frontend filters those out, so the order appears as
    manual even though the auto-trader placed it.

    This function fetches recent Alpaca orders and matches them against pending
    records by symbol + side + timestamp proximity (within 2 hours).  Stale
    records that can't be matched after 24 hours are marked failed.
    """
    async with db.execute(
        "SELECT id, symbol, side, created_at FROM auto_trade_log "
        "WHERE order_id IS NULL AND status = 'pending'"
    ) as cur:
        pending = await cur.fetchall()

    if not pending:
        return

    logger.info("Reconciling %d pending auto_trade_log record(s) with Alpaca orders", len(pending))

    try:
        orders = await trading_get("/v2/orders", status="all", limit=100, direction="desc")
    except Exception:
        logger.warning("Reconciliation: could not fetch orders from Alpaca, will retry next cycle")
        return

    if not isinstance(orders, list):
        return

    now = datetime.now(timezone.utc)
    updated = 0

    for record in pending:
        rec_id = record["id"]
        symbol = record["symbol"]
        side = record["side"]

        try:
            created_at = datetime.fromisoformat(record["created_at"])
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            continue

        age_hours = (now - created_at).total_seconds() / 3600

        matched_order_id: Optional[str] = None
        for order in orders:
            if order.get("symbol", "").upper() != symbol.upper():
                continue
            if order.get("side", "") != side:
                continue
            order_time_str = order.get("created_at", "")
            try:
                order_time = datetime.fromisoformat(order_time_str.replace("Z", "+00:00"))
            except (ValueError, TypeError):
                continue
            if abs((order_time - created_at).total_seconds()) <= 7200:
                matched_order_id = order.get("id")
                break

        if matched_order_id:
            await db.execute(
                "UPDATE auto_trade_log SET order_id = ?, status = 'submitted' WHERE id = ?",
                (matched_order_id, rec_id),
            )
            logger.info(
                "Reconciled pending #%d → Alpaca order %s (%s %s)",
                rec_id, matched_order_id[:8], side, symbol,
            )
            updated += 1
        elif age_hours > 24:
            await db.execute(
                "UPDATE auto_trade_log SET status = 'failed', error = ? WHERE id = ?",
                (
                    "Unresolved after 24h — process likely crashed before Alpaca confirmed the order",
                    rec_id,
                ),
            )
            logger.info("Marked stale pending #%d as failed (%s %s)", rec_id, side, symbol)
            updated += 1

    if updated:
        await db.commit()
