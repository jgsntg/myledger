import { useState, type CSSProperties } from 'react'

type Badge = 'buy' | 'sell' | 'info' | 'warn'

interface Term {
  term: string
  badge: Badge
  description: string
}

interface Section {
  title: string
  subtitle: string
  terms: Term[]
}

const SECTIONS: Section[] = [
  {
    title: 'Signals',
    subtitle: 'Scanner-generated buy and sell signals shown on each stock row.',
    terms: [
      {
        term: 'RSI Oversold',
        badge: 'buy',
        description:
          'RSI has dropped below 30, suggesting the asset may have fallen too far too fast. The scanner treats this as a potential buy opportunity — prices could mean-revert upward.',
      },
      {
        term: 'RSI Overbought',
        badge: 'sell',
        description:
          'RSI has climbed above 70, suggesting the asset may be overextended after a strong run. The scanner treats this as a potential sell signal — momentum may be exhausted.',
      },
      {
        term: 'Golden Cross',
        badge: 'buy',
        description:
          'The 50-day EMA has crossed above the 200-day EMA. Widely watched as a long-term bullish trend confirmation — short-term momentum is now outpacing the longer-term average.',
      },
      {
        term: 'Death Cross',
        badge: 'sell',
        description:
          'The 50-day EMA has crossed below the 200-day EMA. The inverse of the Golden Cross — a classic long-term bearish signal suggesting the trend may be turning negative.',
      },
      {
        term: 'MACD Bull',
        badge: 'buy',
        description:
          'The MACD line has crossed above its 9-day signal line, indicating that upward momentum is building. Often an early sign of a new bullish move.',
      },
      {
        term: 'MACD Bear',
        badge: 'sell',
        description:
          'The MACD line has crossed below its 9-day signal line, indicating that downward momentum is building. Often an early sign of a new bearish move.',
      },
      {
        term: 'Below Lower BB',
        badge: 'buy',
        description:
          'Price has closed below the lower Bollinger Band (2 standard deviations below the 20-day SMA). Statistically unusual — the asset may be oversold and due for a bounce back toward the mean.',
      },
      {
        term: 'Above Upper BB',
        badge: 'sell',
        description:
          'Price has closed above the upper Bollinger Band (2 standard deviations above the 20-day SMA). Statistically unusual — the asset may be overbought and due to revert back toward the mean.',
      },
    ],
  },
  {
    title: 'Indicators',
    subtitle: 'The technical calculations behind every signal. Visible in the Indicators tab of any stock.',
    terms: [
      {
        term: 'RSI — Relative Strength Index',
        badge: 'info',
        description:
          'A momentum oscillator ranging from 0 to 100, calculated over a 14-day window. Measures the speed and magnitude of recent price changes. Values above 70 suggest overbought conditions; below 30 suggest oversold.',
      },
      {
        term: 'MACD — Moving Average Convergence Divergence',
        badge: 'info',
        description:
          'The difference between the 12-day EMA and the 26-day EMA. A 9-day signal line is smoothed on top. When MACD crosses the signal line, it generates a bull or bear signal. The histogram shows the gap between the two.',
      },
      {
        term: 'Bollinger Bands',
        badge: 'info',
        description:
          'Three bands around a 20-day SMA: the middle band (SMA itself), an upper band (+2 standard deviations), and a lower band (−2 standard deviations). Narrow bands indicate low volatility; wide bands indicate high volatility. Price touching either outer band is statistically notable.',
      },
      {
        term: 'EMA — Exponential Moving Average',
        badge: 'info',
        description:
          'A moving average that weights recent prices more heavily than older prices, making it more responsive to new information than the SMA. Used in MACD (12-day and 26-day) and the Golden/Death Cross (50-day and 200-day).',
      },
      {
        term: 'SMA — Simple Moving Average',
        badge: 'info',
        description:
          'The arithmetic mean of closing prices over a set window. Less reactive to recent price changes than the EMA. Used as the middle band in Bollinger Bands and as a slower reference line in trend analysis.',
      },
    ],
  },
  {
    title: 'Trading',
    subtitle: 'Core concepts for how orders, positions, and automation work in Ledger.',
    terms: [
      {
        term: 'Long Position',
        badge: 'buy',
        description:
          'Owning shares of a stock with the expectation that the price will rise. You profit when the price goes up. In Ledger, a long position shows a positive quantity (e.g. +3). Closing a long means selling your shares.',
      },
      {
        term: 'Short Position',
        badge: 'sell',
        description:
          'Selling shares you do not own, borrowed from a broker, with the expectation that the price will fall. You profit when the price drops and buy back cheaper. In Ledger, a short position shows a negative quantity (e.g. −4). Closing a short means buying the shares back. Short selling can be enabled or disabled in Settings.',
      },
      {
        term: 'Paper Trading',
        badge: 'info',
        description:
          'Simulated trading using real market data but no real money. Ledger defaults to Alpaca\'s paper trading environment — all orders, fills, and P&L are fictional. Switch to ALPACA_ENV=live only with explicit intent.',
      },
      {
        term: 'Market Order',
        badge: 'info',
        description:
          'An order to buy or sell immediately at the best available market price. Ledger submits market orders with "day" time-in-force — they expire at market close if unfilled.',
      },
      {
        term: 'Unrealized P&L',
        badge: 'info',
        description:
          'The profit or loss on an open position if it were closed right now at the current market price. It fluctuates throughout the day and is not locked in until you sell.',
      },
      {
        term: 'Realized P&L',
        badge: 'info',
        description:
          'The actual profit or loss captured when a position is closed — i.e., after you sell. Unlike unrealized P&L, this is locked in and becomes a taxable event. Ledger shows realized P&L in the orders history once a sell fills.',
      },
      {
        term: 'P&L % (Return)',
        badge: 'info',
        description:
          'The percentage gain or loss relative to your cost basis. Calculated as (current value − cost basis) ÷ cost basis × 100. A position worth $11,000 on a $10,000 cost basis has a P&L % of +10%. Useful for comparing performance across positions of different sizes.',
      },
      {
        term: 'Day\'s P&L',
        badge: 'info',
        description:
          'How much your total portfolio equity changed since yesterday\'s market close. Shown in the portfolio header. Positive means your holdings gained value today; negative means they lost. This is always short-term for tax purposes since it reflects a single trading day\'s movement.',
      },
      {
        term: 'Auto-Trading',
        badge: 'info',
        description:
          'When the system toggle is set to AUTO, Ledger automatically places market orders when signals, alerts, or filer transactions fire. Capped at 1 auto-trade per symbol per calendar day. Blocked entirely when ALPACA_ENV=live.',
      },
      {
        term: 'Filer / Copy Trading',
        badge: 'info',
        description:
          'Tracking reported trades by institutional investors or US Congress members (sourced via Quiver Quant). The Mirror button replicates their reported transaction. Position sizes are estimated from the reported dollar range.',
      },
    ],
  },
  {
    title: 'Evaluation & Tax',
    subtitle: 'How the trade evaluator scores a trade before you (or the auto-trader) execute it.',
    terms: [
      {
        term: 'Holding Period',
        badge: 'info',
        description:
          'How long you have held a position, calculated from your earliest Alpaca order for that symbol. Determines whether a gain qualifies for short-term or long-term tax treatment.',
      },
      {
        term: 'Short-Term Capital Gain',
        badge: 'sell',
        description:
          'A gain on a position held for less than the long-term threshold (default: 365 days). Taxed at your ordinary income rate — the evaluator defaults to 37%. Selling too soon can significantly increase your tax bill.',
      },
      {
        term: 'Long-Term Capital Gain',
        badge: 'buy',
        description:
          'A gain on a position held beyond the long-term threshold (default: 365 days). Taxed at a preferential rate — the evaluator defaults to 20%. Holding past the threshold can meaningfully reduce taxes owed.',
      },
      {
        term: 'Wash Sale',
        badge: 'sell',
        description:
          'Selling a security at a loss and repurchasing the same (or substantially identical) security within 30 days before or after the sale. The IRS disallows the loss deduction. The evaluator flags this risk if a prior purchase is detected within the window.',
      },
      {
        term: 'Evaluator: Proceed',
        badge: 'buy',
        description:
          'The trade evaluator found no major concerns. No tax flags, no wash-sale risk, and no unusual position size issues. The auto-trader executes without any logged caveat.',
      },
      {
        term: 'Evaluator: Caution',
        badge: 'warn',
        description:
          'The evaluator flagged one or more risk factors but the trade still went through. Triggers when: selling a short-term gain (held < 365d), selling at a loss with wash-sale exposure, buying within 30 days of a prior sale, no open position found on a sell, or selling more shares than held.',
      },
      {
        term: 'Evaluator: Hold',
        badge: 'sell',
        description:
          'The evaluator recommends waiting before selling. This fires when you are within 30 days of the long-term capital gains threshold — crossing it would lower the tax rate from 37% to 20%, potentially saving a meaningful amount. The auto-trader logs this but still executes if risk level is 4 or higher.',
      },
    ],
  },
]

const BADGE_STYLES: Record<Badge, CSSProperties> = {
  buy: {
    background: 'rgba(111, 207, 151, 0.12)',
    color: 'var(--green)',
    border: '1px solid rgba(111, 207, 151, 0.3)',
  },
  sell: {
    background: 'rgba(235, 87, 87, 0.10)',
    color: 'var(--red)',
    border: '1px solid rgba(235, 87, 87, 0.25)',
  },
  info: {
    background: 'var(--bg)',
    color: 'var(--ink-mute)',
    border: '1px solid var(--line)',
  },
  warn: {
    background: 'rgba(251, 191, 36, 0.10)',
    color: 'var(--amber, #fbbf24)',
    border: '1px solid rgba(251, 191, 36, 0.35)',
  },
}

const BADGE_LABELS: Record<Badge, string> = {
  buy: 'Buy Signal',
  sell: 'Sell Signal',
  info: 'Concept',
  warn: 'Caution',
}

export default function GlossaryTab() {
  const [search, setSearch] = useState('')

  const query = search.toLowerCase().trim()

  const filtered: Section[] = SECTIONS.map((section) => ({
    ...section,
    terms: section.terms.filter(
      (t) =>
        !query ||
        t.term.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query),
    ),
  })).filter((s) => s.terms.length > 0)

  return (
    <div role="tabpanel" style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={pageTitleStyle}>Glossary</h2>
        <p style={pageSubtitleStyle}>
          Definitions for every signal, indicator, and concept used in Ledger.
        </p>

        {/* Search */}
        <input
          type="search"
          placeholder="Search terms…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchStyle}
        />
      </div>

      {filtered.length === 0 && (
        <div style={{ color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
          No terms match "{search}".
        </div>
      )}

      {filtered.map((section) => (
        <div key={section.title} style={{ marginBottom: 48 }}>
          {/* Section header */}
          <div
            style={{
              marginBottom: 18,
              paddingBottom: 12,
              borderBottom: '1px solid var(--line)',
            }}
          >
            <h3 style={sectionTitleStyle}>{section.title}</h3>
            <p style={sectionSubtitleStyle}>{section.subtitle}</p>
          </div>

          {/* Cards grid */}
          <div style={gridStyle}>
            {section.terms.map((t) => (
              <div key={t.term} style={cardStyle}>
                <div style={cardTopStyle}>
                  <span style={termNameStyle}>{t.term}</span>
                  <span
                    style={{
                      ...badgeStyle,
                      ...BADGE_STYLES[t.badge],
                    }}
                  >
                    {BADGE_LABELS[t.badge]}
                  </span>
                </div>
                <p style={descStyle}>{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const pageTitleStyle: CSSProperties = {
  fontFamily: 'Fraunces, Georgia, serif',
  fontWeight: 400,
  fontSize: 28,
  letterSpacing: '-0.4px',
  marginBottom: 8,
}

const pageSubtitleStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  color: 'var(--ink-mute)',
  marginBottom: 20,
  letterSpacing: '0.4px',
}

const searchStyle: CSSProperties = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--line)',
  color: 'var(--ink)',
  padding: '9px 14px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12,
  outline: 'none',
  width: 280,
}

const sectionTitleStyle: CSSProperties = {
  fontFamily: 'Fraunces, Georgia, serif',
  fontWeight: 400,
  fontStyle: 'italic',
  fontSize: 20,
  letterSpacing: '-0.2px',
  marginBottom: 4,
}

const sectionSubtitleStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: 'var(--ink-mute)',
  letterSpacing: '0.6px',
}

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
}

const cardStyle: CSSProperties = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--line)',
  padding: '16px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const cardTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 10,
}

const termNameStyle: CSSProperties = {
  fontFamily: 'Fraunces, Georgia, serif',
  fontStyle: 'italic',
  fontSize: 15,
  fontWeight: 500,
  color: 'var(--ink)',
  lineHeight: 1.3,
}

const badgeStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  padding: '3px 7px',
  flexShrink: 0,
  whiteSpace: 'nowrap',
}

const descStyle: CSSProperties = {
  fontFamily: 'Fraunces, Georgia, serif',
  fontSize: 13,
  lineHeight: 1.7,
  color: 'var(--ink-soft)',
}
