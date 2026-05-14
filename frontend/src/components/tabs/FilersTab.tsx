import { AutoTradeEntry } from '../../types'
import TrackedFilersSection from '../TrackedFilersSection'
import AutoTradeLog from '../AutoTradeLog'

interface Props {
  autoTrades: AutoTradeEntry[]
  tradingMode: 'auto' | 'manual'
  onMirror: (symbol: string, side: 'buy' | 'sell', qty: string, sourceNote: string) => void
  onHeldSymbolsChange: (symbols: Set<string>) => void
}

export default function FilersTab({
  autoTrades,
  tradingMode,
  onMirror,
  onHeldSymbolsChange,
}: Props) {
  return (
    <div role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 44 }}>
      <TrackedFilersSection onMirror={onMirror} onHeldSymbolsChange={onHeldSymbolsChange} />
      <AutoTradeLog entries={autoTrades} tradingMode={tradingMode} />
    </div>
  )
}
