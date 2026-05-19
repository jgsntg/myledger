import { useState } from 'react'
import { AutoTradeEntry } from '../types'

interface Props {
  entries: AutoTradeEntry[]
  tradingMode: 'auto' | 'manual'
}

const cell: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid var(--line)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  color: 'var(--ink-soft)',
  whiteSpace: 'nowrap',
}

const hdr: React.CSSProperties = {
  ...cell,
  color: 'var(--ink-mute)',
  fontSize: 10,
  letterSpacing: 1,
  textTransform: 'uppercase',
  fontWeight: 500,
  textAlign: 'left',
}

export default function AutoTradeLog({ entries, tradingMode }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  function toggleRow(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <section>
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
            fontSize: 26,
            fontStyle: 'italic',
            letterSpacing: '-0.3px',
          }}
        >
          Auto-Trade Log
        </h2>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            letterSpacing: 1,
            textTransform: 'uppercase',
            padding: '2px 7px',
            border: `1px solid ${tradingMode === 'auto' ? 'var(--green)' : 'var(--line)'}`,
            color: tradingMode === 'auto' ? 'var(--green)' : 'var(--ink-mute)',
          }}
        >
          {tradingMode === 'auto' ? 'active' : 'inactive'}
        </span>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: 'var(--ink-mute)',
            padding: '16px 0',
          }}
        >
          No auto-trades executed yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid var(--line)' }}>
            <thead>
              <tr>
                <th style={hdr}>Time</th>
                <th style={hdr}>Symbol</th>
                <th style={hdr}>Side</th>
                <th style={hdr}>Qty</th>
                <th style={hdr}>Source</th>
                <th style={hdr}>Trigger</th>
                <th style={hdr}>Order ID</th>
                <th style={hdr}>Status</th>
                <th style={{ ...hdr, width: 28 }} />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const isOpen = expanded.has(e.id)
                return (
                  <>
                    <tr
                      key={e.id}
                      style={{ cursor: e.reasoning ? 'pointer' : 'default' }}
                      onClick={() => e.reasoning && toggleRow(e.id)}
                    >
                      <td style={cell}>
                        {new Date(e.created_at + 'Z').toLocaleString('en-US', {
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </td>
                      <td style={{ ...cell, color: 'var(--ink)', fontWeight: 600 }}>{e.symbol}</td>
                      <td
                        style={{
                          ...cell,
                          color: e.side === 'buy' ? 'var(--green)' : 'var(--red)',
                          fontWeight: 600,
                        }}
                      >
                        {e.side.toUpperCase()}
                      </td>
                      <td style={cell}>{e.qty}</td>
                      <td style={cell}>{e.source}</td>
                      <td style={{ ...cell, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.source_ref}
                      </td>
                      <td style={{ ...cell, color: 'var(--ink-mute)', fontSize: 10 }}>
                        {e.order_id ? e.order_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td style={cell}>
                        {e.status === 'submitted' ? (
                          <span style={{ color: 'var(--green)' }}>✓</span>
                        ) : e.status === 'pending' ? (
                          <span style={{ color: 'var(--ink-mute)' }} title="Order was logged but process restarted before Alpaca confirmed — status unknown">
                            ? pending
                          </span>
                        ) : (
                          <span style={{ color: 'var(--red)' }} title={e.error ?? undefined}>
                            ✗ {e.error && e.error.length > 40 ? e.error.slice(0, 40) + '…' : e.error}
                          </span>
                        )}
                      </td>
                      {/* Expand toggle */}
                      <td style={{ ...cell, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 10 }}>
                        {e.reasoning ? (isOpen ? '▲' : '▼') : null}
                      </td>
                    </tr>

                    {/* Reasoning expansion row */}
                    {isOpen && e.reasoning && (
                      <tr key={`${e.id}-reasoning`}>
                        <td
                          colSpan={9}
                          style={{
                            padding: '10px 16px 14px 16px',
                            borderBottom: '1px solid var(--line)',
                            background: 'var(--bg)',
                          }}
                        >
                          <div style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 10,
                            color: 'var(--ink-mute)',
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                            marginBottom: 6,
                          }}>
                            Why this trade was taken
                          </div>
                          <div style={{
                            fontFamily: 'Fraunces, Georgia, serif',
                            fontSize: 14,
                            fontStyle: 'italic',
                            color: 'var(--ink-soft)',
                            lineHeight: 1.7,
                            maxWidth: 720,
                          }}>
                            {e.reasoning}
                          </div>
                          {e.recommendation && e.recommendation !== 'proceed' && (
                            <div style={{
                              marginTop: 8,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 9,
                              letterSpacing: '1px',
                              textTransform: 'uppercase',
                              padding: '2px 7px',
                              border: '1px solid var(--amber, #fbbf24)',
                              color: 'var(--amber, #fbbf24)',
                            }}>
                              evaluator: {e.recommendation}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
