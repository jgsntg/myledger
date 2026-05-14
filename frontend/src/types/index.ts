export interface WatchlistEntry {
  symbol: string
  added_at: string
}

export interface AccountData {
  equity: string
  last_equity: string
  buying_power: string
  cash: string
  [key: string]: unknown
}

export interface Position {
  symbol: string
  qty: string
  avg_entry_price: string
  current_price: string
  market_value: string
  unrealized_pl: string
  unrealized_plpc: string
  [key: string]: unknown
}

export interface Order {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  qty: string
  filled_qty: string
  type: string
  status: string
  submitted_at: string
  filled_avg_price: string | null
  [key: string]: unknown
}

export interface MACDData {
  macd: number
  signal: number
  histogram: number
}

export interface BollingerData {
  upper: number
  middle: number
  lower: number
}

export interface Signal {
  type: 'buy' | 'sell' | 'hold'
  label: string
}

export interface Indicators {
  rsi: number | null
  sma50: number | null
  sma200: number | null
  macd: MACDData | null
  bollinger: BollingerData | null
  signals: Signal[]
}

export interface Bar {
  t: string
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface ClockData {
  is_open: boolean
  next_open: string
  next_close: string
  timestamp: string
}

export interface SignalEvent {
  symbol: string
  signal_type: string
  signal_label: string
  price_at_signal: number
  rsi_at_signal: number | null
  triggered_at: string
}

export interface TradePayload {
  symbol: string
  qty: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit'
  time_in_force: string
  limit_price?: string
}

export interface SnapshotData {
  latestTrade?: { p: number; t: string }
  latestQuote?: { bp: number; ap: number }
  dailyBar?: { o: number; h: number; l: number; c: number; v: number; t: string }
  prevDailyBar?: { o: number; h: number; l: number; c: number; v: number; t: string }
  minuteBar?: { c: number }
  [key: string]: unknown
}

export interface StockData {
  symbol: string
  price: number
  change: number
  changePct: number
  prevClose: number
  bars: Bar[]
  indicators: Indicators | null
  snapshot: SnapshotData | null
}

export interface SignalLogEntry {
  id: string
  time: Date
  message: string
  type: 'buy' | 'sell' | 'warn' | 'info'
  symbol: string | null
}
