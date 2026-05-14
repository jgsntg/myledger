"""Technical indicator math ported from prototype/ledger.html.
All functions operate on a plain list of closing prices (floats), oldest first."""

from __future__ import annotations

from typing import TypedDict


class MACDResult(TypedDict):
    macd: float
    signal: float
    histogram: float


class BollingerResult(TypedDict):
    upper: float
    middle: float
    lower: float


class Signal(TypedDict):
    type: str   # 'buy' | 'sell' | 'hold'
    label: str


class IndicatorsResult(TypedDict):
    rsi: float | None
    sma50: float | None
    sma200: float | None
    macd: MACDResult | None
    bollinger: BollingerResult | None
    signals: list[Signal]


def sma(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    return sum(values[-period:]) / period


def ema(values: list[float], period: int) -> float | None:
    if len(values) < period:
        return None
    k = 2.0 / (period + 1)
    ema_val = sum(values[:period]) / period
    for v in values[period:]:
        ema_val = v * k + ema_val * (1 - k)
    return ema_val


def rsi(values: list[float], period: int = 14) -> float | None:
    if len(values) < period + 1:
        return None
    gains = 0.0
    losses = 0.0
    for i in range(len(values) - period, len(values)):
        diff = values[i] - values[i - 1]
        if diff > 0:
            gains += diff
        else:
            losses -= diff
    avg_gain = gains / period
    avg_loss = losses / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1 + rs))


def macd(values: list[float]) -> MACDResult | None:
    ema12 = ema(values, 12)
    ema26 = ema(values, 26)
    if ema12 is None or ema26 is None:
        return None
    macd_line = ema12 - ema26
    recent = values[-35:]
    macd_history: list[float] = []
    for i in range(26, len(recent) + 1):
        sub = recent[:i]
        e12 = ema(sub, 12)
        e26 = ema(sub, 26)
        if e12 is not None and e26 is not None:
            macd_history.append(e12 - e26)
    signal_line = ema(macd_history, 9) if len(macd_history) >= 9 else macd_line
    assert signal_line is not None
    return {"macd": macd_line, "signal": signal_line, "histogram": macd_line - signal_line}


def bollinger(values: list[float], period: int = 20, k: float = 2.0) -> BollingerResult | None:
    if len(values) < period:
        return None
    sl = values[-period:]
    mean = sum(sl) / period
    variance = sum((v - mean) ** 2 for v in sl) / period
    std = variance**0.5
    return {"upper": mean + k * std, "middle": mean, "lower": mean - k * std}


def compute_signals(history: list[float]) -> IndicatorsResult:
    if not history or len(history) < 30:
        return {
            "rsi": None,
            "sma50": None,
            "sma200": None,
            "macd": None,
            "bollinger": None,
            "signals": [{"type": "hold", "label": "Insufficient data"}],
        }

    ind: IndicatorsResult = {
        "rsi": rsi(history),
        "sma50": sma(history, min(50, len(history))),
        "sma200": sma(history, min(200, len(history))),
        "macd": macd(history),
        "bollinger": bollinger(history),
        "signals": [],
    }

    price = history[-1]
    signals: list[Signal] = []

    if ind["rsi"] is not None:
        if ind["rsi"] < 30:
            signals.append({"type": "buy", "label": "RSI Oversold"})
        elif ind["rsi"] > 70:
            signals.append({"type": "sell", "label": "RSI Overbought"})

    if ind["sma50"] is not None and ind["sma200"] is not None:
        ratio50_200 = ind["sma50"] / ind["sma200"]
        if ind["sma50"] > ind["sma200"] and (ratio50_200 - 1) < 0.02:
            signals.append({"type": "buy", "label": "Golden Cross"})
        elif ind["sma50"] < ind["sma200"] and (1 / ratio50_200 - 1) < 0.02:
            signals.append({"type": "sell", "label": "Death Cross"})

    m = ind["macd"]
    if m is not None and m["macd"] != 0:
        if m["histogram"] > 0 and abs(m["histogram"]) > abs(m["macd"]) * 0.05:
            signals.append({"type": "buy", "label": "MACD Bull"})
        elif m["histogram"] < 0 and abs(m["histogram"]) > abs(m["macd"]) * 0.05:
            signals.append({"type": "sell", "label": "MACD Bear"})

    bb = ind["bollinger"]
    if bb is not None:
        if price < bb["lower"]:
            signals.append({"type": "buy", "label": "Below Lower BB"})
        elif price > bb["upper"]:
            signals.append({"type": "sell", "label": "Above Upper BB"})

    ind["signals"] = signals if signals else [{"type": "hold", "label": "No Signal"}]
    return ind
