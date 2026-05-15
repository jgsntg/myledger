"""AI narrative generation via Claude API.

All calls are on-demand (no auto-scheduling). The caller must supply
the data payload; this module only handles the Claude interaction.
"""
from __future__ import annotations

import logging
from typing import Any

from anthropic import AsyncAnthropic

from app.config import settings

logger = logging.getLogger(__name__)

_MODEL = "claude-sonnet-4-6"


def _client() -> AsyncAnthropic:
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY missing — add it to backend/.env")
    return AsyncAnthropic(api_key=settings.anthropic_api_key)


def _fmt_positions(positions: list[dict[str, Any]]) -> str:
    lines = ["Symbol | Qty | Market Value | Unrealized P&L | P&L %"]
    lines.append("-------|-----|-------------|----------------|-------")
    for p in positions:
        pl = float(p.get("unrealized_pl", 0))
        pl_pct = float(p.get("unrealized_plpc", 0)) * 100
        sign = "+" if pl >= 0 else ""
        lines.append(
            f"{p['symbol']:6} | {p['qty']:5} | "
            f"${float(p['market_value']):>10,.2f} | "
            f"{sign}${pl:>8,.2f} | {sign}{pl_pct:.2f}%"
        )
    return "\n".join(lines)


def _fmt_sectors(sector_map: dict[str, str], positions: list[dict[str, Any]]) -> str:
    total_mv = sum(float(p["market_value"]) for p in positions)
    buckets: dict[str, float] = {}
    for p in positions:
        sector = sector_map.get(p["symbol"], "Other").title()
        buckets[sector] = buckets.get(sector, 0.0) + float(p["market_value"])
    lines = []
    for sector, mv in sorted(buckets.items(), key=lambda x: -x[1]):
        pct = (mv / total_mv * 100) if total_mv else 0
        lines.append(f"  {sector}: {pct:.0f}% (${mv:,.0f})")
    return "\n".join(lines)


async def generate_briefing(positions: list[dict[str, Any]]) -> str:
    """Plain-English portfolio briefing based on current positions."""
    table = _fmt_positions(positions)
    total_mv = sum(float(p["market_value"]) for p in positions)
    total_pl = sum(float(p["unrealized_pl"]) for p in positions)
    sign = "+" if total_pl >= 0 else ""
    prompt = (
        f"Here are the user's current paper trading positions (total market value "
        f"${total_mv:,.2f}, total unrealized P&L {sign}${total_pl:,.2f}):\n\n"
        f"{table}\n\n"
        "Write a concise portfolio briefing in 3-5 sentences. Cover: overall P&L status, "
        "notable movers (best and worst), any obvious concentration. "
        "Be direct and factual. Do not give financial advice."
    )
    client = _client()
    msg = await client.messages.create(
        model=_MODEL,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


async def generate_risk_narrative(
    positions: list[dict[str, Any]],
    sector_map: dict[str, str],
) -> str:
    """Plain-English sector concentration and risk summary."""
    sector_summary = _fmt_sectors(sector_map, positions)
    table = _fmt_positions(positions)
    total_mv = sum(float(p["market_value"]) for p in positions)
    prompt = (
        f"Portfolio total market value: ${total_mv:,.2f}\n\n"
        f"Sector breakdown:\n{sector_summary}\n\n"
        f"Positions:\n{table}\n\n"
        "Write a brief risk narrative in 2-4 sentences. Focus on sector concentration, "
        "any single-name or sector dominance, and whether the portfolio looks balanced or skewed. "
        "Be factual and specific about percentages. Do not give financial advice."
    )
    client = _client()
    msg = await client.messages.create(
        model=_MODEL,
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text
