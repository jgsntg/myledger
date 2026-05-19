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

export interface TradePayload {
  symbol: string
  qty: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit'
  time_in_force: string
  limit_price?: string
}

export interface TrackedFiler {
  id: number
  name: string
  filer_type: 'congress' | 'institution'
  source_id: string
  added_at: string
}

export interface FilerTransaction {
  id: number
  filer_id: number
  symbol: string
  transaction_type: string
  amount_low: number | null
  amount_high: number | null
  trade_date: string
  filed_at: string | null
  fetched_at: string
}

export interface FilerHolding {
  id: number
  filer_id: number
  symbol: string
  shares: number | null
  value_usd: number | null
  report_date: string
  fetched_at: string
}

export interface FilerRefreshResult {
  filer: TrackedFiler
  transactions_seen: number
  transactions_inserted: number
  holdings_seen: number
  holdings_inserted: number
  message?: string
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

export interface SignalEvent {
  symbol: string
  signal_type: 'buy' | 'sell' | 'hold'
  signal_label: string
  price_at_signal: number
  rsi_at_signal: number | null
  triggered_at: string
}

export interface Alert {
  id: number
  symbol: string
  condition: 'price_above' | 'price_below' | 'rsi_above' | 'rsi_below'
  threshold: number
  active: number   // 0 | 1 from SQLite
  created_at: string
  last_triggered_at: string | null
}

export interface SignalLogEntry {
  id: string
  time: Date
  message: string
  type: 'buy' | 'sell' | 'warn' | 'info'
  symbol: string | null
}

export interface AppSettings {
  trading_mode: 'auto' | 'manual'
  alpaca_env: string
  default_trade_usd: number
  tax_short_term_rate: number
  tax_long_term_rate: number
  tax_long_term_days: number
  insights_extra_symbols: string
  risk_level: number
}

export interface InsightEntry {
  symbol: string
  return_pct: number
  current_price: number
  closes: number[]
}

export interface TopPerformers {
  d7: InsightEntry[]
  d14: InsightEntry[]
  d30: InsightEntry[]
  refreshed_at: string
  universe_size: number
}

export interface EvaluationResult {
  recommendation: 'proceed' | 'caution' | 'hold'
  reasons: string[]
  holding_days: number | null
  is_long_term: boolean | null
  days_to_long_term: number | null
  estimated_gain_usd: number | null
  estimated_tax_usd: number | null
  tax_rate_used: number | null
  wash_sale_risk: boolean
  has_position: boolean
  position_qty: number | null
  avg_entry_price: number | null
}

export interface EarningsEntry {
  symbol: string
  last_period: string
  last_end_date: string
  last_filing_date: string | null
  estimated_next: string
  days_until: number
}

export interface TickerDetails {
  ticker: string
  name: string
  description: string
  sic_description: string | null
  market_cap: number | null
  primary_exchange: string | null
  list_date: string | null
  homepage_url: string | null
  branding?: {
    logo_url?: string
    icon_url?: string
  }
  [key: string]: unknown
}

export interface NewsPublisher {
  name: string
  logo_url?: string
  favicon_url?: string
  homepage_url?: string
}

export interface NewsArticle {
  id: string
  title: string
  published_utc: string
  article_url: string
  description: string | null
  image_url: string | null
  publisher: NewsPublisher
  tickers: string[]
}

export interface AutoTradeEntry {
  id: number
  symbol: string
  side: 'buy' | 'sell'
  qty: string
  source: string
  source_ref: string
  order_id: string | null
  status: 'pending' | 'submitted' | 'failed'
  error: string | null
  recommendation: string | null
  reasoning: string | null
  created_at: string
}
