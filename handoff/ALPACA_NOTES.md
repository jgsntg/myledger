# Alpaca API: gotchas learned while building the prototype

Useful context so the same lessons aren't relearned the hard way.

## Endpoints

- **Trading API:** `https://paper-api.alpaca.markets` (paper) or `https://api.alpaca.markets` (live). Used for `/v2/account`, `/v2/positions`, `/v2/orders`, `/v2/clock`, `/v2/assets`.
- **Market Data API:** `https://data.alpaca.markets`. Used for `/v2/stocks/...`. Confusingly a *different* base URL from the trading API even though it uses the same keys.
- The prototype handles this with a `useDataEndpoint` flag inside the request wrapper. Backend should split these into two client classes or two base URL constants.

## Auth headers

```
APCA-API-KEY-ID: <key>
APCA-API-SECRET-KEY: <secret>
```

Both required. No bearer token.

## Free tier data limits

- **IEX feed** (free): real-time data from IEX exchange only, plus 15-minute delay on full SIP feed. About 2-3% of total market volume. Fine for indicators on liquid large caps, less accurate for thinly traded stocks.
- **SIP feed** (paid, $99/mo): real-time consolidated tape from all exchanges.
- The prototype hardcodes `feed=iex` because we're on free tier. Make this an env var.

The 16-minute end-date offset in the prototype's `fetchBars` is paranoia about the 15-min delay — gives a 1-minute buffer.

## Snapshot endpoint quirks

`/v2/stocks/snapshots?symbols=AAPL,MSFT` is the most efficient way to get current prices for many tickers. Returns:

```json
{
  "AAPL": {
    "latestTrade": { "p": 180.50, "t": "..." },
    "latestQuote": { "bp": 180.49, "ap": 180.51, ... },
    "minuteBar": { ... },
    "dailyBar": { ... },
    "prevDailyBar": { ... }
  }
}
```

Sometimes one or more sub-fields can be null for low-volume or recently-listed tickers. Always null-check.

## Order submission

- `qty` must be a string, not a number, in the POST body. Alpaca will accept numbers sometimes and reject them others; always stringify.
- **Fractional shares only work with market orders.** Limit + fractional → 422 rejection. Surface the error rather than pre-validating client-side (Alpaca's rules can change).
- `time_in_force: 'day'` is the safe default. Orders auto-cancel at market close if unfilled.
- After-hours orders: market orders submitted after close get status `accepted` and sit until next open. They don't fail immediately.

## Order status lifecycle

```
pending_new → new → (partially_filled →)* filled
                ↘ canceled / expired / rejected
```

Polling for fills: don't trust the initial response from POST `/v2/orders`. It usually returns `accepted` or `new` even for orders that fill within milliseconds. Poll `GET /v2/orders/{id}` for the actual outcome. Terminal statuses (stop polling on these): `filled`, `canceled`, `expired`, `rejected`, `done_for_day`, `replaced`.

## Positions

- `GET /v2/positions` returns `[]` (not 404) when there are no positions. (Earlier API versions returned 404; current is 200 with empty array. Handle both.)
- `GET /v2/positions/{symbol}` does return 404 when the symbol isn't held. Catch this.
- Fractional positions are reported with decimal `qty` strings: `"qty": "0.5"`. Always parseFloat.

## Market hours

- `GET /v2/clock` is the source of truth. Don't compute market hours client-side based on ET — DST handling is annoying.
- Returns `{ is_open, next_open, next_close, timestamp }`.
- Worth caching for 30-60 seconds; doesn't change quickly.

## Rate limits

Free tier: 200 requests/minute across both APIs combined. Easy to blow through if you fetch bars for 30 symbols on every refresh. The prototype handles this by caching daily bars per session. Backend should cache aggressively (1 hour for daily bars during market hours, longer otherwise).

A 429 response includes `X-RateLimit-Reset` header. Back off until then.

## CORS (matters less now that we're moving to backend)

Alpaca's API allows browser requests directly, which is what made the prototype possible. Once we have a backend, this becomes irrelevant. Don't accidentally re-introduce direct browser calls in production.

## Useful undocumented behaviors

- The `?feed=iex` param works on all `/v2/stocks/*` endpoints to force free-tier data. Without it, snapshots may try the SIP feed and fail silently on free accounts.
- The `adjustment=raw` param on bars returns unadjusted prices. For technical indicators we want `adjustment=all` (splits and dividends adjusted) — the prototype uses `raw` which is technically wrong for long-running MAs around split events. Fix this in the backend.

## Documentation links

- Trading API: https://docs.alpaca.markets/reference
- Market Data API: https://docs.alpaca.markets/reference/stockbars
- Python SDK examples (reference, not a dependency): https://github.com/alpacahq/alpaca-py/tree/master/examples
