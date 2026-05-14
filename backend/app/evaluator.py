"""Trade evaluator — Phase 3.

Analyses a proposed trade for tax implications, holding period, and wash-sale risk.
Returns a structured recommendation so the UI and auto-trader can act on it.

Tax rate assumptions (US):
  Short-term capital gains  → 37 % (top marginal bracket)
  Long-term capital gains   → 20 %
  Long-term threshold       → 365 days

Wash-sale window: 30 days before / after a loss sale.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from pydantic import BaseModel

from app.alpaca import data_get, trading_get
from app.config import settings as app_settings

logger = logging.getLogger(__name__)

_SHORT_TERM_RATE = 0.37
_LONG_TERM_RATE = 0.20
_LONG_TERM_DAYS = 365
_WASH_SALE_DAYS = 30


class EvaluationResult(BaseModel):
    recommendation: str          # 'proceed' | 'caution' | 'hold'
    reasons: List[str]
    holding_days: Optional[int]
    is_long_term: Optional[bool]
    days_to_long_term: Optional[int]
    estimated_gain_usd: Optional[float]
    estimated_tax_usd: Optional[float]
    tax_rate_used: Optional[float]
    wash_sale_risk: bool
    has_position: bool
    position_qty: Optional[float]
    avg_entry_price: Optional[float]


async def evaluate_trade(
    symbol: str,
    side: str,
    qty_str: str,
    *,
    short_term_rate: float = _SHORT_TERM_RATE,
    long_term_rate: float = _LONG_TERM_RATE,
    long_term_days: int = _LONG_TERM_DAYS,
) -> EvaluationResult:
    """Evaluate a potential trade. Never raises — worst case returns a 'proceed' with no detail."""
    symbol = symbol.upper()
    try:
        qty = max(float(qty_str), 0.0001)
    except (ValueError, TypeError):
        qty = 1.0

    positions, orders, current_price = await _fetch_context(symbol)
    now = datetime.now(timezone.utc)

    if side == "sell":
        return _eval_sell(
            symbol, qty, positions, orders, current_price, now,
            short_term_rate, long_term_rate, long_term_days,
        )
    return _eval_buy(symbol, qty, positions, orders, current_price, now)


async def _fetch_context(symbol: str):
    positions = []
    try:
        positions = await trading_get("/v2/positions")
    except Exception:
        logger.warning("Evaluator: could not fetch positions")

    orders = []
    try:
        two_years_ago = (datetime.now(timezone.utc) - timedelta(days=730)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        raw = await trading_get(
            "/v2/orders",
            status="filled",
            direction="asc",
            limit=500,
            after=two_years_ago,
        )
        orders = [o for o in (raw or []) if o.get("symbol") == symbol]
    except Exception:
        logger.warning("Evaluator: could not fetch order history")

    current_price = None
    try:
        snaps = await data_get(
            "/v2/stocks/snapshots",
            symbols=symbol,
            feed=app_settings.alpaca_feed,
        )
        snap = snaps.get(symbol, {})
        current_price = (
            (snap.get("latestTrade") or {}).get("p")
            or (snap.get("minuteBar") or {}).get("c")
            or (snap.get("dailyBar") or {}).get("c")
        )
    except Exception:
        logger.warning("Evaluator: could not fetch price for %s", symbol)

    return positions, orders, current_price


def _find_position(positions: list, symbol: str) -> Optional[dict]:
    return next((p for p in positions if p.get("symbol") == symbol), None)


def _eval_sell(
    symbol: str,
    qty: float,
    positions: list,
    orders: list,
    current_price: Optional[float],
    now: datetime,
    short_term_rate: float = _SHORT_TERM_RATE,
    long_term_rate: float = _LONG_TERM_RATE,
    long_term_days: int = _LONG_TERM_DAYS,
) -> EvaluationResult:
    position = _find_position(positions, symbol)
    has_position = position is not None
    pos_qty = float(position["qty"]) if position else None
    avg_entry = float(position["avg_entry_price"]) if position else None

    result = EvaluationResult(
        recommendation="proceed",
        reasons=[],
        holding_days=None,
        is_long_term=None,
        days_to_long_term=None,
        estimated_gain_usd=None,
        estimated_tax_usd=None,
        tax_rate_used=None,
        wash_sale_risk=False,
        has_position=has_position,
        position_qty=pos_qty,
        avg_entry_price=avg_entry,
    )

    if not has_position:
        result.recommendation = "caution"
        result.reasons.append("No open position found — check if this is a short sale.")
        return result

    if pos_qty is not None and qty > pos_qty:
        result.reasons.append(
            f"Selling {qty:.4g} shares but only {pos_qty:.4g} held — order will be rejected or partially filled."
        )
        result.recommendation = "caution"

    # Holding period from earliest filled buy order
    buy_orders = [o for o in orders if o.get("side") == "buy" and o.get("filled_at")]
    holding_days = None
    if buy_orders:
        try:
            oldest = datetime.fromisoformat(
                buy_orders[0]["filled_at"].replace("Z", "+00:00")
            )
            holding_days = (now - oldest).days
        except Exception:
            pass

    result.holding_days = holding_days

    is_long_term: Optional[bool] = None
    days_to_lt: Optional[int] = None
    if holding_days is not None:
        is_long_term = holding_days >= long_term_days
        result.is_long_term = is_long_term
        if not is_long_term:
            days_to_lt = long_term_days - holding_days
            result.days_to_long_term = days_to_lt

    # Gain and tax estimate
    if current_price is not None and avg_entry is not None:
        gain_total = round((current_price - avg_entry) * qty, 2)
        result.estimated_gain_usd = gain_total

        if gain_total > 0:
            rate = long_term_rate if is_long_term else short_term_rate
            result.estimated_tax_usd = round(gain_total * rate, 2)
            result.tax_rate_used = rate

            if is_long_term:
                result.reasons.append(
                    f"Long-term position (held {holding_days}d). "
                    f"Favorable {int(long_term_rate * 100)}% rate — est. tax ${result.estimated_tax_usd:,.0f}."
                )
            elif days_to_lt is not None:
                if days_to_lt <= 30:
                    savings = round(gain_total * (short_term_rate - long_term_rate), 2)
                    result.recommendation = "hold"
                    result.reasons.append(
                        f"Only {days_to_lt}d until long-term threshold. "
                        f"Waiting saves ~${savings:,.0f} in taxes "
                        f"({int(short_term_rate * 100)}% → {int(long_term_rate * 100)}%)."
                    )
                else:
                    result.recommendation = "caution"
                    result.reasons.append(
                        f"Short-term gain (held {holding_days}d, {days_to_lt}d to qualify). "
                        f"Tax rate {int(short_term_rate * 100)}% vs "
                        f"{int(long_term_rate * 100)}% long-term — est. tax ${result.estimated_tax_usd:,.0f}."
                    )
        elif gain_total < 0:
            result.wash_sale_risk = True
            result.reasons.append(
                f"Selling at an estimated loss of ${abs(gain_total):,.0f}. "
                f"Buying {symbol} within {_WASH_SALE_DAYS} days will trigger the wash-sale rule and disallow the loss."
            )
            if result.recommendation == "proceed":
                result.recommendation = "caution"
        else:
            result.reasons.append("Breakeven — no gain or loss estimated.")

    elif holding_days is not None:
        label = "long-term" if is_long_term else f"short-term ({days_to_lt}d to qualify)"
        result.reasons.append(f"Held {holding_days} days ({label}). Price data unavailable for tax estimate.")

    if not result.reasons:
        result.reasons.append("No holding or price data available.")

    return result


def _eval_buy(
    symbol: str,
    qty: float,
    positions: list,
    orders: list,
    current_price: Optional[float],
    now: datetime,
) -> EvaluationResult:
    position = _find_position(positions, symbol)
    has_position = position is not None
    pos_qty = float(position["qty"]) if position else None
    avg_entry = float(position["avg_entry_price"]) if position else None

    result = EvaluationResult(
        recommendation="proceed",
        reasons=[],
        holding_days=None,
        is_long_term=None,
        days_to_long_term=None,
        estimated_gain_usd=None,
        estimated_tax_usd=None,
        tax_rate_used=None,
        wash_sale_risk=False,
        has_position=has_position,
        position_qty=pos_qty,
        avg_entry_price=avg_entry,
    )

    # Wash-sale check: any sell order in the past 30 days
    cutoff = now - timedelta(days=_WASH_SALE_DAYS)
    recent_sells = [
        o for o in orders
        if o.get("side") == "sell" and o.get("filled_at")
        and _parse_dt(o["filled_at"]) >= cutoff
    ]
    if recent_sells:
        result.wash_sale_risk = True
        result.recommendation = "caution"
        result.reasons.append(
            f"Sold {symbol} within the last {_WASH_SALE_DAYS} days. "
            "If that sale was at a loss, this purchase triggers the wash-sale rule (loss disallowed)."
        )

    # Averaging up or down
    if has_position and avg_entry is not None and current_price is not None:
        if current_price < avg_entry:
            result.reasons.append(
                f"Averaging down: current ${current_price:.2f} < avg entry ${avg_entry:.2f}."
            )
        else:
            result.reasons.append(
                f"Averaging up: current ${current_price:.2f} > avg entry ${avg_entry:.2f}."
            )

    if not result.reasons:
        result.reasons.append("No immediate tax or risk concerns identified.")

    return result


def _parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))
