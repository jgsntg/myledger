import { useEffect, useState, type CSSProperties } from 'react'
import { api } from '../api/client'
import { EarningsEntry } from '../types'

interface Props {
  symbols: string[]
}

function urgencyColor(days: number): string {
  if (days <= 7)  return 'var(--red)'
  if (days <= 14) return 'var(--amber)'
  if (days <= 30) return 'var(--green)'
  return 'var(--ink-mute)'
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function daysLabel(days: number): string {
  if (days < 0)  return `${Math.abs(days)}d ago`
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days}d`
}

export default function EarningsCalendar({ symbols }: Props) {
  const [entries, setEntries] = useState<EarningsEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!symbols.length) return
    setLoading(true)
    setError(null)
    api.getEarningsCalendar(symbols)
      .then(setEntries)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [symbols.join(',')])

  return (
    <section style={{ marginTop: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--line)' }}>
        <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 400, fontSize: 22, letterSpacing: '-0.3px', margin: 0 }}>
          Earnings Calendar
        </h2>
        <span style={mutedMonoStyle}>{symbols.length} symbols · estimates only</span>
      </div>

      {error && (
        <div style={{ color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, padding: '8px 12px', background: 'rgba(235,87,87,0.08)', border: '1px solid rgba(235,87,87,0.3)', marginBottom: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {Array.from({ length: Math.min(symbols.length, 6) }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 52, width: '100%' }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ padding: '34px 22px', textAlign: 'center', background: 'var(--bg-elev)', border: '1px dashed var(--line)', color: 'var(--ink-mute)', fontSize: 13 }}>
          {symbols.length === 0
            ? 'Add symbols to your watchlist to see earnings dates.'
            : 'No earnings data available for these symbols.'}
        </div>
      ) : (
        <div style={{ background: 'var(--line)', border: '1px solid var(--line)' }}>
          {/* Header */}
          <div style={headerRowStyle}>
            {['Symbol', 'Last Quarter', 'Reported', 'Est. Next', 'Days Away'].map((h) => (
              <div key={h} style={mutedMonoStyle}>{h}</div>
            ))}
          </div>

          {entries.map((e) => {
            const color = urgencyColor(e.days_until)
            return (
              <div key={e.symbol} style={dataRowStyle}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 600, letterSpacing: '0.5px' }}>
                  {e.symbol}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink-soft)' }}>
                  {e.last_period || '—'}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink-soft)' }}>
                  {e.last_filing_date ? fmtDate(e.last_filing_date) : '—'}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink)' }}>
                  {fmtDate(e.estimated_next)}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color }}>
                  {daysLabel(e.days_until)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 10, ...mutedMonoStyle, fontStyle: 'italic', textTransform: 'none', letterSpacing: 0, fontSize: 10, color: 'var(--ink-mute)' }}>
        Next earnings dates are estimates based on prior filing cadence. Confirm with official filings before trading.
      </div>
    </section>
  )
}

const mutedMonoStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: 'var(--ink-mute)',
  letterSpacing: '1px',
  textTransform: 'uppercase',
}

const headerRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px 120px 1fr 1fr 100px',
  gap: 12,
  alignItems: 'center',
  padding: '10px 18px',
  background: 'var(--bg-elev)',
  borderBottom: '1px solid var(--line)',
}

const dataRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px 120px 1fr 1fr 100px',
  gap: 12,
  alignItems: 'center',
  padding: '14px 18px',
  background: 'var(--bg-elev)',
  marginBottom: 1,
}
