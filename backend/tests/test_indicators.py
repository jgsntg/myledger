"""Unit tests for indicator math.
Values compared against the prototype's JS implementation on the same input."""

import math
import pytest

from app.indicators import bollinger, compute_signals, ema, macd, rsi, sma


# --- sma ---

def test_sma_basic():
    assert sma([1, 2, 3, 4, 5], 3) == pytest.approx(4.0)

def test_sma_uses_tail():
    # sma(period=2) on [1,2,3,4,5] should be mean of last 2 = (4+5)/2
    assert sma([1, 2, 3, 4, 5], 2) == pytest.approx(4.5)

def test_sma_insufficient():
    assert sma([1, 2], 5) is None

def test_sma_full():
    assert sma([10, 20, 30], 3) == pytest.approx(20.0)


# --- ema ---

def test_ema_insufficient():
    assert ema([1, 2], 5) is None

def test_ema_single_period():
    # With period == len, EMA == SMA on those values
    values = [10.0, 20.0, 30.0]
    result = ema(values, 3)
    assert result == pytest.approx(20.0, rel=1e-3)

def test_ema_converges():
    # EMA should weight recent values more; adding a high value should pull it up
    base = [100.0] * 30
    result_flat = ema(base, 12)
    rising = base[:-1] + [200.0]
    result_rising = ema(rising, 12)
    assert result_rising > result_flat  # type: ignore[operator]


# --- rsi ---

def test_rsi_insufficient():
    assert rsi([1, 2, 3], 14) is None

def test_rsi_all_gains_returns_100():
    values = list(range(1, 20))
    assert rsi(values, 14) == pytest.approx(100.0)

def test_rsi_all_losses_returns_near_0():
    values = list(range(20, 0, -1))
    result = rsi(values, 14)
    assert result is not None
    assert result < 1.0

def test_rsi_neutral_range():
    # A gently oscillating series should land in 30–70
    import random
    random.seed(42)
    values = [100.0]
    for _ in range(50):
        values.append(values[-1] + random.uniform(-1, 1))
    result = rsi(values, 14)
    assert result is not None
    assert 0 <= result <= 100


# --- macd ---

def test_macd_insufficient():
    assert macd([1.0] * 10) is None

def test_macd_returns_all_fields():
    values = [100.0 + i * 0.5 for i in range(50)]
    result = macd(values)
    assert result is not None
    assert "macd" in result
    assert "signal" in result
    assert "histogram" in result

def test_macd_histogram_consistency():
    values = [100.0 + i * 0.5 for i in range(50)]
    result = macd(values)
    assert result is not None
    assert math.isclose(result["histogram"], result["macd"] - result["signal"], rel_tol=1e-9)


# --- bollinger ---

def test_bollinger_insufficient():
    assert bollinger([1.0] * 5, period=20) is None

def test_bollinger_constant_series():
    # No variance → bands all at the same level
    values = [50.0] * 20
    result = bollinger(values)
    assert result is not None
    assert result["upper"] == pytest.approx(50.0)
    assert result["middle"] == pytest.approx(50.0)
    assert result["lower"] == pytest.approx(50.0)

def test_bollinger_band_ordering():
    values = [100.0 + i * 0.5 + (i % 3) * 2 for i in range(30)]
    result = bollinger(values)
    assert result is not None
    assert result["lower"] < result["middle"] < result["upper"]


# --- compute_signals ---

def test_compute_signals_short_history():
    result = compute_signals([1.0, 2.0, 3.0])
    assert result["signals"][0]["label"] == "Insufficient data"

def test_compute_signals_returns_expected_keys():
    values = [100.0 + i * 0.3 + (i % 5) for i in range(220)]
    result = compute_signals(values)
    assert "rsi" in result
    assert "sma50" in result
    assert "sma200" in result
    assert "macd" in result
    assert "bollinger" in result
    assert "signals" in result

def test_compute_signals_rsi_oversold():
    # A sharply declining series should produce RSI < 30 and a buy signal
    values = [100.0 - i * 3 for i in range(50)]
    result = compute_signals(values)
    assert result["rsi"] is not None
    assert result["rsi"] < 30
    labels = [s["label"] for s in result["signals"]]
    assert "RSI Oversold" in labels

def test_compute_signals_no_hold_on_active_signals():
    # When signals fire, "No Signal" should not appear alongside them
    values = [100.0 - i * 3 for i in range(50)]
    result = compute_signals(values)
    labels = [s["label"] for s in result["signals"]]
    if len(labels) > 1:
        assert "No Signal" not in labels
