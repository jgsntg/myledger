import { AppSettings } from '../../types'
import MarketInsights from '../MarketInsights'

interface Props {
  settings: AppSettings
  watchlistSymbols: string[]
  onSettingsUpdate: (updated: AppSettings) => void
  onAddToWatchlist: (symbol: string) => void
  onTrade: (symbol: string) => void
}

export default function DiscoverTab({
  settings,
  watchlistSymbols,
  onSettingsUpdate,
  onAddToWatchlist,
  onTrade,
}: Props) {
  return (
    <div role="tabpanel">
      <MarketInsights
        settings={settings}
        watchlistSymbols={watchlistSymbols}
        onSettingsUpdate={onSettingsUpdate}
        onAddToWatchlist={onAddToWatchlist}
        onTrade={onTrade}
      />
    </div>
  )
}
