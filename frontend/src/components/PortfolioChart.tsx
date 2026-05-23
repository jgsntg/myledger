import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import { AccountData, Position } from '../types'
import { fmtMoney, fmtPct, deltaClass } from '../lib/format'

type Period = '1D' | '1W' | '1M' | '1Y' | 'All'

interface ChartPoint {
  t: number
  v: number
}

const PERIODS: Period[] = ['1D', '1W', '1M', '1Y', 'All']

const PERIOD_PARAMS: Record<Period, { period: string; timeframe: string }> = {
  '1D':  { period: '1D',  timeframe: '1Min' },
  '1W':  { period: '1W',  timeframe: '1H' },
  '1M':  { period: '1M',  timeframe: '1D' },
  '1Y':  { period: '1A',  timeframe: '1D' },
  'All': { period: '5A',  timeframe: '1D' },
}

function fmtTick(t: number, period: Period): string {
  const d = new Date(t * 1000)
  if (period === '1D') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  if (period === '1W') {
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, period }: { active?: boolean; payload?: { payload: ChartPoint }[]; period: Period }) {
  if (!active || !payload?.length) return null
  const { t, v } = payload[0].payload
  const d = new Date(t * 1000)
  const label =
    period === '1D'
      ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      : period === '1W'
        ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', hour12: true })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--line)',
        padding: '8px 12px',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 11,
      }}
    >
      <div style={{ color: 'var(--ink-mute)', marginBottom: 3 }}>{label}</div>
      <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{fmtMoney(v)}</div>
    </div>
  )
}

interface Props {
  account: AccountData | null
  positions: Position[]
}

export default function PortfolioChart({ account, positions }: Props) {
  const [period, setPeriod] = useState<Period>('1M')
  const [data, setData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const eq = account ? parseFloat(account.equity) : null
  const lastEq = account ? parseFloat(account.last_equity) : null
  const bp = account ? parseFloat(account.buying_power) : null
  const pl = eq !== null && lastEq !== null ? eq - lastEq : null
  const plPct = lastEq && pl !== null ? (pl / lastEq) * 100 : null
  const plClass = pl !== null ? deltaClass(pl) : undefined

  const fetchHistory = useCallback(async (p: Period) => {
    setLoading(true)
    try {
      const { period: pParam, timeframe } = PERIOD_PARAMS[p]
      const res = await api.getPortfolioHistory(pParam, timeframe)
      const points: ChartPoint[] = []
      for (let i = 0; i < res.timestamp.length; i++) {
        if (res.equity[i] != null) {
          points.push({ t: res.timestamp[i], v: res.equity[i]! })
        }
      }
      setData(points)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('Portfolio history fetch failed:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory(period)
  }, [period, fetchHistory])

  const tickCount = 5
  const tickIndices =
    data.length > 1
      ? Array.from({ length: tickCount }, (_, i) =>
          Math.round((i / (tickCount - 1)) * (data.length - 1)),
        )
      : []
  const ticks = tickIndices.map((i) => data[i]?.t).filter(Boolean)

  const plLabel =
    pl !== null
      ? `${pl >= 0 ? '+' : ''}${fmtMoney(Math.abs(pl)).replace('$', pl < 0 ? '-$' : '+$')}`
      : null

  return (
    <section aria-label="Portfolio chart" style={{ marginBottom: 36 }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
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
            Your Portfolio
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span
              style={{
                fontFamily: 'Fraunces, Georgia, serif',
                fontSize: 36,
                fontWeight: 400,
                letterSpacing: '-1px',
                lineHeight: 1,
              }}
            >
              {eq !== null ? fmtMoney(eq) : '$—'}
            </span>
            {plPct !== null && (
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  color:
                    plClass === 'pos'
                      ? 'var(--green)'
                      : plClass === 'neg'
                        ? 'var(--red)'
                        : 'var(--ink-soft)',
                }}
              >
                {fmtPct(plPct)}
              </span>
            )}
          </div>
          {lastUpdated && (
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: 'var(--ink-mute)',
                marginTop: 4,
              }}
            >
              {lastUpdated.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZoneName: 'short',
              })}
            </div>
          )}
        </div>

        {/* Period tabs + refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: '0.5px',
                padding: '5px 10px',
                border: '1px solid',
                borderColor: period === p ? 'var(--accent)' : 'var(--line)',
                background: period === p ? 'var(--accent)' : 'transparent',
                color: period === p ? 'var(--bg)' : 'var(--ink-soft)',
                cursor: 'pointer',
                borderRadius: 3,
                transition: 'all 0.15s',
              }}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => fetchHistory(period)}
            disabled={loading}
            title="Refresh"
            style={{
              marginLeft: 6,
              background: 'transparent',
              border: '1px solid var(--line)',
              borderRadius: 3,
              padding: '5px 8px',
              cursor: loading ? 'default' : 'pointer',
              color: 'var(--ink-mute)',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: loading ? 'none' : undefined,
                animation: loading ? 'spin 0.8s linear infinite' : undefined,
              }}
            >
              <path d="M13.5 2.5A6.5 6.5 0 1 0 14.5 9" />
              <polyline points="14.5 2 13.5 2.5 14 3.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chart */}
      <div
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          padding: '16px 0 8px',
          position: 'relative',
        }}
      >
        {loading && data.length === 0 ? (
          <div
            className="skeleton"
            style={{ height: 180, margin: '0 16px', borderRadius: 2 }}
          />
        ) : data.length === 0 ? (
          <div
            style={{
              height: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ink-mute)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
            }}
          >
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data} margin={{ top: 4, right: 16, left: 16, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d4a574" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#d4a574" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                type="number"
                domain={['dataMin', 'dataMax']}
                ticks={ticks}
                tickFormatter={(t) => fmtTick(t, period)}
                tick={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  fill: 'var(--ink-mute)',
                }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <Tooltip
                content={<CustomTooltip period={period} />}
                cursor={{ stroke: 'var(--line)', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="#d4a574"
                strokeWidth={1.5}
                fill="url(#equityGradient)"
                dot={false}
                activeDot={{ r: 3, fill: '#d4a574', stroke: 'var(--bg-elev)', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--line)',
          border: '1px solid var(--line)',
          borderTop: 'none',
        }}
      >
        <StatCell
          label="Total Equity"
          value={eq !== null ? fmtMoney(eq) : '$—'}
          delta={plPct !== null ? fmtPct(plPct) : 'Connect to view P&L'}
          deltaClass={plClass}
        />
        <StatCell
          label="Buying Power"
          value={bp !== null ? fmtMoney(bp) : '$—'}
          delta="Cash available"
        />
        <StatCell
          label="Day's P&L"
          value={plLabel ?? '$—'}
          delta={plPct !== null ? fmtPct(plPct) : '—'}
          deltaClass={plClass}
        />
        <StatCell
          label="Open Positions"
          value={String(positions.length)}
          delta="Active holdings"
        />
      </div>
    </section>
  )
}

function StatCell({
  label,
  value,
  delta,
  deltaClass: dc,
}: {
  label: string
  value: string
  delta: string
  deltaClass?: string
}) {
  return (
    <div style={{ background: 'var(--bg-elev)', padding: '18px 22px' }}>
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
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: 26,
          fontWeight: 400,
          letterSpacing: '-0.5px',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          marginTop: 4,
          color:
            dc === 'pos'
              ? 'var(--green)'
              : dc === 'neg'
                ? 'var(--red)'
                : 'var(--ink-soft)',
        }}
      >
        {delta}
      </div>
    </div>
  )
}
