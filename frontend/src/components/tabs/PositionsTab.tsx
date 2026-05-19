import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { Order, Position } from '../../types'
import AiNarratives from '../AiNarratives'
import OrdersTable from '../OrdersTable'
import PositionsTable from '../PositionsTable'

interface Props {
  positions: Position[]
  orders: Order[]
  autoOrderIds: Set<string>
  onTrade: (symbol: string, presetSide: 'buy' | 'sell', presetQty: string) => void
  onMarkAuto?: (orderId: string) => Promise<void>
}

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function PositionsTab({ positions, orders, autoOrderIds, onTrade, onMarkAuto }: Props) {
  const [sectorMap, setSectorMap] = useState<Record<string, string>>({})

  useEffect(() => {
    if (positions.length === 0) return
    const symbols = positions.map((p) => p.symbol)
    api.getSectorMap(symbols).then(setSectorMap).catch(() => {})
  }, [positions.map((p) => p.symbol).join(',')])

  // Compute sector concentration by market value
  const totalMv = positions.reduce((sum, p) => sum + parseFloat(p.market_value), 0)
  const sectorMv: Record<string, number> = {}
  for (const p of positions) {
    const sector = sectorMap[p.symbol] ? toTitleCase(sectorMap[p.symbol]) : 'Other'
    sectorMv[sector] = (sectorMv[sector] ?? 0) + parseFloat(p.market_value)
  }
  const sectorBreakdown = Object.entries(sectorMv)
    .map(([sector, mv]) => ({ sector, mv, pct: totalMv > 0 ? (mv / totalMv) * 100 : 0 }))
    .sort((a, b) => b.mv - a.mv)

  return (
    <div role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
      {positions.length > 0 && sectorBreakdown.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 10,
              color: 'var(--ink-mute)',
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Sector Concentration
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sectorBreakdown.map(({ sector, pct }) => (
              <div
                key={sector}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--line)',
                  padding: '6px 12px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Fraunces, Georgia, serif',
                    fontStyle: 'italic',
                    fontSize: 13,
                    color: 'var(--ink)',
                  }}
                >
                  {sector}
                </span>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--accent)',
                  }}
                >
                  {pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <PositionsTable positions={positions} sectorMap={sectorMap} onTrade={onTrade} />
      <AiNarratives positions={positions} sectorMap={sectorMap} />
      <OrdersTable orders={orders} autoOrderIds={autoOrderIds} onMarkAuto={onMarkAuto} />
    </div>
  )
}
