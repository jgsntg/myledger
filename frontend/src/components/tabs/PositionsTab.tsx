import { Order, Position } from '../../types'
import PositionsTable from '../PositionsTable'
import OrdersTable from '../OrdersTable'

interface Props {
  positions: Position[]
  orders: Order[]
  autoOrderIds: Set<string>
  onTrade: (symbol: string, presetSide: 'buy' | 'sell', presetQty: string) => void
}

export default function PositionsTab({ positions, orders, autoOrderIds, onTrade }: Props) {
  return (
    <div role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
      <PositionsTable positions={positions} onTrade={onTrade} />
      <OrdersTable orders={orders} autoOrderIds={autoOrderIds} />
    </div>
  )
}
