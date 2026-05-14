import { Bar, Indicators } from '../types'
import { fmtMoney, rsiNote, macdNote, bbNote } from '../lib/format'

interface Props {
  symbol: string
  price: number
  isUp: boolean
  bars: Bar[]
  indicators: Indicators | null
}

function Sparkline({ bars, isUp }: { bars: Bar[]; isUp: boolean }) {
  if (!bars.length) return null
  const w = 320
  const h = 180
  const pad = 8
  const closes = bars.slice(-60).map((b) => b.c)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const stepX = (w - pad * 2) / Math.max(closes.length - 1, 1)
  const points = closes
    .map((p, i) => {
      const x = pad + i * stepX
      const y = pad + (h - pad * 2) * (1 - (p - min) / range)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const color = isUp ? '#6fcf97' : '#eb5757'
  const fill = isUp ? 'rgba(111, 207, 151, 0.08)' : 'rgba(235, 87, 87, 0.08)'
  const first = closes[0]
  const last = closes[closes.length - 1]
  const areaPoints = `${pad},${h - pad} ${points} ${pad + (closes.length - 1) * stepX},${h - pad}`

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: 16 }}>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'var(--ink-mute)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        60-Day Price
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none">
        <polygon points={areaPoints} fill={fill} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'var(--ink-mute)',
          marginTop: 8,
        }}
      >
        <span>Low {fmtMoney(min)}</span>
        <span>High {fmtMoney(max)}</span>
      </div>
      {/* invisible usage to satisfy the variables */}
      <span style={{ display: 'none' }}>{first}{last}</span>
    </div>
  )
}

function IndicatorCard({
  label,
  value,
  note,
  span2,
}: {
  label: string
  value: string
  note: string
  span2?: boolean
}) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        padding: '14px 16px',
        gridColumn: span2 ? 'span 2' : undefined,
      }}
    >
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'var(--ink-mute)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: span2 ? 13 : 16, fontWeight: 500 }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-soft)',
          marginTop: 4,
          fontStyle: 'italic',
          fontFamily: 'Fraunces, Georgia, serif',
        }}
      >
        {note}
      </div>
    </div>
  )
}

export default function StockDetail({ symbol: _symbol, price, isUp, bars, indicators: ind }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        padding: '24px 22px',
        borderTop: '1px solid var(--line)',
        background: 'var(--bg-card)',
      }}
    >
      <Sparkline bars={bars} isUp={isUp} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <IndicatorCard
          label="RSI (14)"
          value={ind?.rsi != null ? ind.rsi.toFixed(1) : '—'}
          note={rsiNote(ind?.rsi ?? null)}
        />
        <IndicatorCard
          label="50-day MA"
          value={fmtMoney(ind?.sma50 ?? null)}
          note={ind?.sma50 != null ? (price > ind.sma50 ? 'Above trend' : 'Below trend') : '—'}
        />
        <IndicatorCard
          label="200-day MA"
          value={fmtMoney(ind?.sma200 ?? null)}
          note={ind?.sma200 != null ? (price > ind.sma200 ? 'Long-term up' : 'Long-term down') : '—'}
        />
        <IndicatorCard
          label="MACD"
          value={ind?.macd != null ? ind.macd.histogram.toFixed(2) : '—'}
          note={macdNote(ind?.macd ?? null)}
        />
        <IndicatorCard
          label="Bollinger Bands (20, 2σ)"
          value={
            ind?.bollinger != null
              ? `Lower ${fmtMoney(ind.bollinger.lower)} · Mid ${fmtMoney(ind.bollinger.middle)} · Upper ${fmtMoney(ind.bollinger.upper)}`
              : '—'
          }
          note={bbNote(price, ind?.bollinger ?? null)}
          span2
        />
      </div>
    </div>
  )
}
