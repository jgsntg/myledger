import { useState } from 'react'
import { api } from '../api/client'
import { AutoTradeEntry, Order } from '../types'
import { fmtMoney } from '../lib/format'

interface Props {
  orders: Order[]
  autoOrderIds?: Set<string>
  autoTrades?: AutoTradeEntry[]
  onMarkAuto?: (orderId: string) => Promise<void>
}

const STATUS_COLOR: Record<string, string> = {
  filled: 'var(--green)',
  partially_filled: 'var(--green)',
  rejected: 'var(--red)',
  new: 'var(--ink-soft)',
  accepted: 'var(--ink-soft)',
  pending_new: 'var(--ink-soft)',
  done_for_day: 'var(--ink-soft)',
}

export default function OrdersTable({ orders, autoOrderIds, autoTrades, onMarkAuto }: Props) {
  const [marking, setMarking] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [symbolNames, setSymbolNames] = useState<Record<string, string>>({})
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null)

  // order_id → AutoTradeEntry for reasoning lookup
  const tradeByOrderId = new Map<string, AutoTradeEntry>()
  for (const t of autoTrades ?? []) {
    if (t.order_id) tradeByOrderId.set(t.order_id, t)
  }

  function toggleExpanded(orderId: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  async function handleSymbolHover(symbol: string) {
    setHoveredSymbol(symbol)
    if (!symbolNames[symbol]) {
      try {
        const names = await api.getTickerNames([symbol])
        setSymbolNames((prev) => ({ ...prev, ...names }))
      } catch {}
    }
  }

  async function handleMarkAuto(orderId: string) {
    if (!onMarkAuto) return
    setMarking((prev) => new Set(prev).add(orderId))
    try {
      await onMarkAuto(orderId)
    } finally {
      setMarking((prev) => { const next = new Set(prev); next.delete(orderId); return next })
    }
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
          Recent Orders
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
          Last 20 · all statuses
        </span>
      </div>

      {orders.length === 0 ? (
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
          No orders yet
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
              {['Submitted', 'Symbol', 'Side', 'Qty', 'Type', 'Fill Price', 'Status', 'Source', ''].map((h) => (
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
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const submittedAt = new Date(o.submitted_at)
              const timeStr = submittedAt.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              const sideColor = o.side === 'buy' ? 'var(--green)' : 'var(--red)'
              const fillPrice = o.filled_avg_price
                ? fmtMoney(parseFloat(o.filled_avg_price))
                : '—'
              const statusColor = STATUS_COLOR[o.status] ?? 'var(--ink-soft)'
              const isAuto = autoOrderIds?.has(o.id) ?? false
              const tradeEntry = tradeByOrderId.get(o.id)
              const hasReasoning = isAuto && tradeEntry !== undefined
              const isExpanded = expanded.has(o.id)

              return (
                <>
                <tr key={o.id} style={{ cursor: hasReasoning ? 'pointer' : 'default' }} onClick={() => hasReasoning && toggleExpanded(o.id)}>
                  {[
                    <td
                      key="t"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        color: 'var(--ink-soft)',
                      }}
                    >
                      {timeStr}
                    </td>,
                    <td
                      key="sym"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'Fraunces, Georgia, serif',
                        fontSize: 16,
                        fontWeight: 500,
                        cursor: 'default',
                      }}
                      onMouseEnter={() => handleSymbolHover(o.symbol)}
                      onMouseLeave={() => setHoveredSymbol(null)}
                    >
                      {o.symbol}
                      {hoveredSymbol === o.symbol && symbolNames[o.symbol] && (
                        <div style={{
                          fontFamily: 'Fraunces, Georgia, serif',
                          fontStyle: 'italic',
                          fontSize: 11,
                          color: 'var(--ink-mute)',
                          marginTop: 2,
                          fontWeight: 400,
                        }}>
                          {symbolNames[o.symbol]}
                        </div>
                      )}
                    </td>,
                    <td
                      key="side"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                        color: sideColor,
                        textTransform: 'uppercase',
                        fontWeight: 500,
                      }}
                    >
                      {o.side}
                    </td>,
                    <td
                      key="qty"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                      }}
                    >
                      {o.qty}
                    </td>,
                    <td
                      key="type"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        textTransform: 'uppercase',
                      }}
                    >
                      {o.type}
                    </td>,
                    <td
                      key="fp"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                      }}
                    >
                      {fillPrice}
                    </td>,
                    <td
                      key="status"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        color: statusColor,
                      }}
                    >
                      {o.status.replace('_', ' ')}
                    </td>,
                    <td
                      key="source"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                      }}
                    >
                      {isAuto ? (
                        <span
                          style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 9,
                            letterSpacing: 1,
                            padding: '2px 6px',
                            border: '1px solid var(--green)',
                            color: 'var(--green)',
                          }}
                        >
                          AUTO
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 9,
                              letterSpacing: 1,
                              color: 'var(--ink-mute)',
                            }}
                          >
                            manual
                          </span>
                          {onMarkAuto && (
                            <button
                              onClick={() => handleMarkAuto(o.id)}
                              disabled={marking.has(o.id)}
                              title="Mark this order as an auto-trade"
                              style={{
                                background: 'none',
                                border: '1px solid var(--line)',
                                color: 'var(--ink-mute)',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: 8,
                                letterSpacing: '0.8px',
                                textTransform: 'uppercase',
                                padding: '1px 5px',
                                cursor: 'pointer',
                                opacity: marking.has(o.id) ? 0.4 : 1,
                              }}
                            >
                              {marking.has(o.id) ? '…' : '→ auto'}
                            </button>
                          )}
                        </span>
                      )}
                    </td>,
                    <td
                      key="expand"
                      style={{
                        padding: '14px 10px',
                        borderBottom: '1px solid var(--line-soft)',
                        textAlign: 'center',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 10,
                        color: 'var(--ink-mute)',
                        width: 28,
                      }}
                    >
                      {hasReasoning ? (isExpanded ? '▲' : '▼') : null}
                    </td>,
                  ]}
                </tr>
                {isExpanded && tradeEntry && (
                  <tr key={`${o.id}-reasoning`}>
                    <td
                      colSpan={9}
                      style={{
                        padding: '10px 18px 14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
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
                        {tradeEntry.reasoning ?? `Auto-trade triggered by ${tradeEntry.source} · ${tradeEntry.source_ref}`}
                      </div>
                      {tradeEntry.recommendation && tradeEntry.recommendation !== 'proceed' && (
                        <div style={{
                          marginTop: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 9,
                          letterSpacing: '1px',
                          textTransform: 'uppercase',
                          padding: '2px 7px',
                          border: '1px solid var(--amber, #fbbf24)',
                          color: 'var(--amber, #fbbf24)',
                        }}>
                          evaluator: {tradeEntry.recommendation}
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
      )}
    </section>
  )
}
