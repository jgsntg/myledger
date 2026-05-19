import { useState } from 'react'
import { Order } from '../types'
import { fmtMoney } from '../lib/format'

interface Props {
  orders: Order[]
  autoOrderIds?: Set<string>
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

export default function OrdersTable({ orders, autoOrderIds, onMarkAuto }: Props) {
  const [marking, setMarking] = useState<Set<string>>(new Set())

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
              {['Submitted', 'Symbol', 'Side', 'Qty', 'Type', 'Fill Price', 'Status', 'Source'].map((h) => (
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

              return (
                <tr key={o.id}>
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
                      }}
                    >
                      {o.symbol}
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
                  ]}
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}
