import { useMemo } from 'react'
import { AppSettings, Position } from '../../types'
import EarningsCalendar from '../EarningsCalendar'
import MarketInsights from '../MarketInsights'

interface Props {
  settings: AppSettings
  watchlistSymbols: string[]
  positions: Position[]
  onSettingsUpdate: (updated: AppSettings) => void
  onAddToWatchlist: (symbol: string) => void
  onTrade: (symbol: string) => void
}

export default function DiscoverTab({
  settings,
  watchlistSymbols,
  positions,
  onSettingsUpdate,
  onAddToWatchlist,
  onTrade,
}: Props) {
  const earningsSymbols = useMemo(() => {
    const positionSymbols = positions.map((p) => p.symbol)
    return [...new Set([...watchlistSymbols, ...positionSymbols])]
  }, [watchlistSymbols, positions])

  return (
    <div role="tabpanel">
      <MarketInsights
        settings={settings}
        watchlistSymbols={watchlistSymbols}
        onSettingsUpdate={onSettingsUpdate}
        onAddToWatchlist={onAddToWatchlist}
        onTrade={onTrade}
      />
      <EarningsCalendar symbols={earningsSymbols} />
    </div>
  )
}
