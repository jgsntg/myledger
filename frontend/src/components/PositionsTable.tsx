import { Position } from '../types'
import { fmtMoney, fmtPct, deltaClass } from '../lib/format'

interface Props {
  positions: Position[]
  sectorMap?: Record<string, string>
  onTrade: (symbol: string, presetSide: 'buy' | 'sell', presetQty: string) => void
}

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function PositionsTable({ positions, sectorMap = {}, onTrade }: Props) {
  // Group positions by sector when sector data is available
  const hassectors = positions.some((p) => sectorMap[p.symbol])
  const grouped: Array<{ sector: string; rows: Position[] }> = []
  if (hassectors) {
    const buckets: Record<string, Position[]> = {}
    for (const p of positions) {
      const sector = sectorMap[p.symbol] ? toTitleCase(sectorMap[p.symbol]) : 'Other'
      if (!buckets[sector]) buckets[sector] = []
      buckets[sector].push(p)
    }
    // Sort sectors by total market value descending
    Object.entries(buckets)
      .sort(([, a], [, b]) => {
        const mvA = a.reduce((s, p) => s + parseFloat(p.market_value), 0)
        const mvB = b.reduce((s, p) => s + parseFloat(p.market_value), 0)
        return mvB - mvA
      })
      .forEach(([sector, rows]) => grouped.push({ sector, rows }))
  } else {
    grouped.push({ sector: '', rows: positions })
  }
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
          Open Positions
        </h2>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--ink-mute)',
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
          }}
        >
          {positions.length} position{positions.length === 1 ? '' : 's'}
        </span>
      </div>

      {positions.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--ink-mute)',
            fontStyle: 'italic',
            fontFamily: 'Fraunces, Georgia, serif',
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
          }}
        >
          No open positions — place your first paper trade from the watchlist
        </div>
      ) : (
        <table
          style={{
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr>
              {['Symbol', 'Qty', 'Avg Entry', 'Current', 'Market Value', 'P&L', 'P&L %', ''].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '14px 18px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: '1.5px',
                      textTransform: 'uppercase',
                      color: 'var(--ink-mute)',
                      borderBottom: '1px solid var(--line)',
                      background: 'var(--bg)',
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ sector, rows }) => (
              <>
                {sector && (
                  <tr key={`sector-${sector}`}>
                    <td
                      colSpan={8}
                      style={{
                        padding: '6px 18px',
                        background: 'var(--bg)',
                        borderBottom: '1px solid var(--line)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 9,
                        letterSpacing: '1.4px',
                        textTransform: 'uppercase',
                        color: 'var(--ink-mute)',
                      }}
                    >
                      {sector}
                    </td>
                  </tr>
                )}
                {rows.map((p) => {
                  const qty = parseFloat(p.qty)
                  const avgEntry = parseFloat(p.avg_entry_price)
                  const current = parseFloat(p.current_price)
                  const mktVal = parseFloat(p.market_value)
                  const upl = parseFloat(p.unrealized_pl)
                  const uplPct = parseFloat(p.unrealized_plpc) * 100
                  const dc = deltaClass(upl)
                  const col =
                    dc === 'pos' ? 'var(--green)' : dc === 'neg' ? 'var(--red)' : 'var(--ink)'
                  return (
                    <tr key={p.symbol}>
                      <td style={cellStyle({ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, fontWeight: 500 })}>
                        {p.symbol}
                      </td>
                      <td style={cellStyle()}>{qty}</td>
                      <td style={cellStyle()}>{fmtMoney(avgEntry)}</td>
                      <td style={cellStyle()}>{fmtMoney(current)}</td>
                      <td style={cellStyle()}>{fmtMoney(mktVal)}</td>
                      <td style={cellStyle({ color: col })}>{upl >= 0 ? '+' : ''}{fmtMoney(upl)}</td>
                      <td style={cellStyle({ color: col })}>{fmtPct(uplPct)}</td>
                      <td style={cellStyle()}>
                        <button
                          onClick={() => onTrade(p.symbol, 'sell', p.qty)}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--accent)',
                            color: 'var(--accent)',
                            padding: '6px 10px',
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 10,
                            letterSpacing: '1.5px',
                            textTransform: 'uppercase',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

import type { CSSProperties } from 'react'
function cellStyle(extra?: CSSProperties): CSSProperties {
  return {
    padding: '14px 18px',
    borderBottom: '1px solid var(--line-soft)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: 13,
    ...extra,
  }
}
