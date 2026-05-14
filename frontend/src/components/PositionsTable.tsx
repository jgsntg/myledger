import { Position } from '../types'
import { fmtMoney, fmtPct, deltaClass } from '../lib/format'

interface Props {
  positions: Position[]
  onTrade: (symbol: string, presetSide: 'buy' | 'sell', presetQty: string) => void
}

export default function PositionsTable({ positions, onTrade }: Props) {
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
            {positions.map((p) => {
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
                  {[
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
                      {p.symbol}
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
                      {qty}
                    </td>,
                    <td
                      key="avg"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                      }}
                    >
                      {fmtMoney(avgEntry)}
                    </td>,
                    <td
                      key="cur"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                      }}
                    >
                      {fmtMoney(current)}
                    </td>,
                    <td
                      key="mv"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                      }}
                    >
                      {fmtMoney(mktVal)}
                    </td>,
                    <td
                      key="pl"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                        color: col,
                      }}
                    >
                      {upl >= 0 ? '+' : ''}
                      {fmtMoney(upl)}
                    </td>,
                    <td
                      key="plp"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 13,
                        color: col,
                      }}
                    >
                      {fmtPct(uplPct)}
                    </td>,
                    <td
                      key="close"
                      style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid var(--line-soft)',
                      }}
                    >
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
