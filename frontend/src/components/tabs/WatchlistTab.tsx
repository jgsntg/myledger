import { SignalLogEntry, StockData } from '../../types'
import Watchlist from '../Watchlist'
import SignalsLog from '../SignalsLog'

interface Props {
  symbols: string[]
  stockData: Record<string, StockData | null>
  signalLog: SignalLogEntry[]
  heldSymbols: Set<string>
  symbolNames: Record<string, string>
  onAdd: (symbol: string) => Promise<void>
  onRemove: (symbol: string) => void
  onTrade: (symbol: string) => void
}

export default function WatchlistTab({
  symbols,
  stockData,
  signalLog,
  heldSymbols,
  symbolNames,
  onAdd,
  onRemove,
  onTrade,
}: Props) {
  return (
    <div
      role="tabpanel"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: 32,
        alignItems: 'start',
      }}
    >
      <Watchlist
        symbols={symbols}
        stockData={stockData}
        symbolNames={symbolNames}
        onAdd={onAdd}
        onRemove={onRemove}
        onTrade={onTrade}
        heldSymbols={heldSymbols}
      />
      <div style={{ position: 'sticky', top: 140 }}>
        <SignalsLog entries={signalLog} />
      </div>
    </div>
  )
}
