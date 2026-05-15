import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { api } from '../api/client'
import { fmtMoney } from '../lib/format'
import { AppSettings, InsightEntry, TopPerformers } from '../types'

type Period = '7' | '14' | '30'
type SortCol = 'rank' | 'symbol' | 'return' | 'price'
type SortDir = 'asc' | 'desc'

function InsightSparkline({ closes, positive }: { closes: number[]; positive: boolean }) {
  if (closes.length < 2) return <div />
  const w = 80, h = 28, pad = 2
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const stepX = (w - pad * 2) / (closes.length - 1)
  const pts = closes.map((p, i) => {
    const x = pad + i * stepX
    const y = pad + (h - pad * 2) * (1 - (p - min) / range)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const color = positive ? '#6fcf97' : '#eb5757'
  const fill  = positive ? 'rgba(111,207,151,0.10)' : 'rgba(235,87,87,0.10)'
  const area  = `${pad},${h - pad} ${pts} ${pad + (closes.length - 1) * stepX},${h - pad}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: 'block' }}>
      <polygon points={area} fill={fill} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  )
}

interface Props {
  settings: AppSettings
  watchlistSymbols: string[]
  onSettingsUpdate: (updated: AppSettings) => void
  onAddToWatchlist: (symbol: string) => void
  onTrade: (symbol: string) => void
}

export default function MarketInsights({
  settings,
  watchlistSymbols,
  onSettingsUpdate,
  onAddToWatchlist,
  onTrade,
}: Props) {
  const [data, setData] = useState<TopPerformers | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('7')
  const [sortCol, setSortCol] = useState<SortCol>('return')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [symbolNames, setSymbolNames] = useState<Record<string, string>>({})
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null)
  const [newSymbol, setNewSymbol] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.getInsightsTopPerformers(refresh)
      setData(result)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  async function handleSymbolHover(symbol: string) {
    setHoveredSymbol(symbol)
    if (!symbolNames[symbol]) {
      try {
        const names = await api.getTickerNames([symbol])
        setSymbolNames((prev) => ({ ...prev, ...names }))
      } catch {}
    }
  }

  useEffect(() => {
    load()
  }, [load])

  async function handleAddSymbol() {
    const sym = newSymbol.trim().toUpperCase()
    if (!sym) return
    setAdding(true)
    setError(null)
    try {
      const existing = settings.insights_extra_symbols
        ? settings.insights_extra_symbols.split(',').map((s) => s.trim()).filter(Boolean)
        : []
      const next = existing.includes(sym) ? existing : [...existing, sym]
      const updated = await api.updateSettings({ insights_extra_symbols: next.join(',') })
      onSettingsUpdate(updated)
      setNewSymbol('')
      await load(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function handleRemoveExtra(sym: string) {
    const existing = settings.insights_extra_symbols
      .split(',').map((s) => s.trim()).filter(Boolean)
    const next = existing.filter((s) => s !== sym)
    try {
      const updated = await api.updateSettings({ insights_extra_symbols: next.join(',') })
      onSettingsUpdate(updated)
      await load(true)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const rawEntries: InsightEntry[] =
    data ? (period === '7' ? data.d7 : period === '14' ? data.d14 : data.d30) : []

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(col === 'symbol' ? 'asc' : 'desc')
    }
  }

  const entries = [...rawEntries].sort((a, b) => {
    let cmp = 0
    if (sortCol === 'return') cmp = a.return_pct - b.return_pct
    else if (sortCol === 'price')  cmp = a.current_price - b.current_price
    else if (sortCol === 'symbol') cmp = a.symbol.localeCompare(b.symbol)
    else cmp = 0 // 'rank' preserves server order (return_pct desc)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const extraSymbols = settings.insights_extra_symbols
    ? settings.insights_extra_symbols.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  return (
    <section style={{ marginTop: 40 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <h2
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontWeight: 400,
            fontSize: 22,
            letterSpacing: '-0.3px',
          }}
        >
          Market Insights
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {data && (
            <span style={mutedMonoStyle}>
              {data.universe_size} symbols · as of {data.refreshed_at}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading}
            style={ghostButtonStyle}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Period tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 18 }}>
        {(['7', '14', '30'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              background: period === p ? 'var(--accent)' : 'transparent',
              color: period === p ? 'var(--bg)' : 'var(--ink-soft)',
              border: `1px solid ${period === p ? 'var(--accent)' : 'var(--line)'}`,
              padding: '6px 18px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontWeight: period === p ? 600 : 400,
            }}
          >
            {p}D
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            color: 'var(--red)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            padding: '8px 12px',
            background: 'rgba(235, 87, 87, 0.08)',
            border: '1px solid rgba(235, 87, 87, 0.3)',
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Rankings */}
      {loading && !data ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 52, width: '100%' }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div
          style={{
            padding: '34px 22px',
            textAlign: 'center',
            background: 'var(--bg-elev)',
            border: '1px dashed var(--line)',
            color: 'var(--ink-mute)',
            fontSize: 13,
          }}
        >
          No data yet — click Refresh to fetch performance data.
        </div>
      ) : (
        <div
          style={{
            background: 'var(--line)',
            border: '1px solid var(--line)',
            marginBottom: 20,
          }}
        >
          {/* Table header */}
          <div style={headerRowStyle}>
            {([
              { col: 'rank',   label: '#' },
              { col: 'symbol', label: 'Symbol' },
              { col: 'return', label: `${period}D Return`, align: 'right' },
              { col: null,     label: '30D Trend' },
              { col: 'price',  label: 'Price', align: 'right' },
              { col: null,     label: '' },
            ] as { col: SortCol | null; label: string; align?: string }[]).map(({ col, label, align }) => (
              <div
                key={label}
                onClick={col ? () => handleSort(col) : undefined}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: col && sortCol === col ? 'var(--ink)' : 'var(--ink-mute)',
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  cursor: col ? 'pointer' : 'default',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
                  gap: 4,
                }}
              >
                {col && sortCol === col && align === 'right' && (
                  <span style={{ fontSize: 10 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
                )}
                {label}
                {col && sortCol === col && align !== 'right' && (
                  <span style={{ fontSize: 10 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>
                )}
              </div>
            ))}
          </div>
          {entries.map((entry, idx) => {
            const positive = entry.return_pct >= 0
            const inWatchlist = watchlistSymbols.includes(entry.symbol)
            const name = symbolNames[entry.symbol]
            const isHovered = hoveredSymbol === entry.symbol
            return (
              <div key={entry.symbol} style={dataRowStyle}>
                <div style={{ ...mutedMonoStyle, fontSize: 12 }}>{idx + 1}</div>
                <div
                  onMouseEnter={() => handleSymbolHover(entry.symbol)}
                  onMouseLeave={() => setHoveredSymbol(null)}
                >
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 600, letterSpacing: '0.5px' }}>
                    {entry.symbol}
                  </div>
                  {name && isHovered && (
                    <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontStyle: 'italic', fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {name}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 15,
                    fontWeight: 600,
                    color: positive ? 'var(--green)' : 'var(--red)',
                    textAlign: 'right',
                  }}
                >
                  {positive ? '+' : ''}{entry.return_pct.toFixed(2)}%
                </div>
                <InsightSparkline closes={entry.closes} positive={positive} />
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, textAlign: 'right' }}>
                  {fmtMoney(entry.current_price)}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!inWatchlist && (
                    <button
                      onClick={() => onAddToWatchlist(entry.symbol)}
                      style={secondaryButtonStyle}
                    >
                      Watch
                    </button>
                  )}
                  <button onClick={() => onTrade(entry.symbol)} style={primaryButtonStyle}>
                    Trade
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Universe customization */}
      <div
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          padding: '14px 18px',
        }}
      >
        <div style={{ ...mutedMonoStyle, marginBottom: 10 }}>Custom universe symbols</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {extraSymbols.map((sym) => (
            <span key={sym} style={extraPillStyle}>
              {sym}
              <button
                onClick={() => handleRemoveExtra(sym)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--ink-mute)',
                  cursor: 'pointer',
                  padding: '0 0 0 6px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
            placeholder="TICKER"
            maxLength={10}
            style={{ ...inputStyle, width: 90, textTransform: 'uppercase' }}
          />
          <button onClick={handleAddSymbol} disabled={adding || !newSymbol.trim()} style={primaryButtonStyle}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        <div style={{ ...mutedMonoStyle, marginTop: 8, fontStyle: 'italic' }}>
          Added symbols are included alongside the 50-stock default universe.
        </div>
      </div>
    </section>
  )
}

const headerRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '36px 1fr 1fr 80px 1fr 160px',
  gap: 12,
  alignItems: 'center',
  padding: '10px 18px',
  background: 'var(--bg-elev)',
  borderBottom: '1px solid var(--line)',
}

const dataRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '36px 1fr 1fr 80px 1fr 160px',
  gap: 12,
  alignItems: 'center',
  padding: '14px 18px',
  background: 'var(--bg-elev)',
  marginBottom: 1,
}

const mutedMonoStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: 'var(--ink-mute)',
  letterSpacing: '1px',
  textTransform: 'uppercase',
}

const primaryButtonStyle: CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: '1px solid var(--accent)',
  padding: '7px 12px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontWeight: 600,
}

const secondaryButtonStyle: CSSProperties = {
  background: 'transparent',
  color: 'var(--accent)',
  border: '1px solid var(--accent)',
  padding: '6px 10px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const ghostButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-mute)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const inputStyle: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  color: 'var(--ink)',
  padding: '7px 10px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12,
  outline: 'none',
}

const extraPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  padding: '4px 8px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  color: 'var(--ink-soft)',
  letterSpacing: '0.8px',
}
