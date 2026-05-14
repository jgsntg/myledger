// Mock data shaped to match the real types in frontend/src/types/index.ts

const MOCK_ACCOUNT = {
  equity: '247832.41',
  last_equity: '243019.18',
  buying_power: '31450.22',
  cash: '14820.71',
};

const MOCK_CLOCK = {
  is_open: true,
  next_open: '2026-05-15T13:30:00Z',
  next_close: '2026-05-14T20:00:00Z',
  timestamp: '2026-05-14T17:42:11Z',
};

const MOCK_SETTINGS = {
  trading_mode: 'manual',
  alpaca_env: 'paper',
  default_trade_usd: 500,
  tax_short_term_rate: 0.37,
  tax_long_term_rate: 0.20,
  tax_long_term_days: 365,
  insights_extra_symbols: 'PLTR,ASML,RBLX',
};

const MOCK_POSITIONS = [
  {
    symbol: 'AAPL', qty: '42', avg_entry_price: '189.40',
    current_price: '212.83', market_value: '8938.86',
    unrealized_pl: '983.86', unrealized_plpc: '0.1239',
  },
  {
    symbol: 'NVDA', qty: '18', avg_entry_price: '742.10',
    current_price: '893.45', market_value: '16082.10',
    unrealized_pl: '2724.30', unrealized_plpc: '0.2039',
  },
  {
    symbol: 'GOOGL', qty: '55', avg_entry_price: '168.22',
    current_price: '174.18', market_value: '9579.90',
    unrealized_pl: '327.80', unrealized_plpc: '0.0354',
  },
  {
    symbol: 'TSLA', qty: '24', avg_entry_price: '248.91',
    current_price: '226.50', market_value: '5436.00',
    unrealized_pl: '-537.84', unrealized_plpc: '-0.0900',
  },
  {
    symbol: 'MSFT', qty: '15', avg_entry_price: '402.55',
    current_price: '438.10', market_value: '6571.50',
    unrealized_pl: '533.25', unrealized_plpc: '0.0883',
  },
];

const MOCK_ORDERS = [
  { id: 'ord_9f3a2b', symbol: 'NVDA', side: 'buy', qty: '5', filled_qty: '5', type: 'market',
    status: 'filled', submitted_at: '2026-05-14T15:18:00Z', filled_avg_price: '891.20', _auto: true },
  { id: 'ord_8c1d44', symbol: 'AAPL', side: 'buy', qty: '12', filled_qty: '12', type: 'limit',
    status: 'filled', submitted_at: '2026-05-14T14:02:00Z', filled_avg_price: '210.45' },
  { id: 'ord_77a0e2', symbol: 'TSLA', side: 'sell', qty: '6', filled_qty: '6', type: 'market',
    status: 'filled', submitted_at: '2026-05-13T19:44:00Z', filled_avg_price: '229.18' },
  { id: 'ord_64b9f1', symbol: 'PLTR', side: 'buy', qty: '40', filled_qty: '0', type: 'limit',
    status: 'new', submitted_at: '2026-05-14T17:30:00Z', filled_avg_price: null },
  { id: 'ord_51e2c0', symbol: 'GOOGL', side: 'buy', qty: '20', filled_qty: '20', type: 'market',
    status: 'filled', submitted_at: '2026-05-12T18:11:00Z', filled_avg_price: '171.06', _auto: true },
  { id: 'ord_3a8b22', symbol: 'AMD', side: 'buy', qty: '15', filled_qty: '0', type: 'limit',
    status: 'rejected', submitted_at: '2026-05-11T21:08:00Z', filled_avg_price: null },
  { id: 'ord_22f6d9', symbol: 'MSFT', side: 'buy', qty: '8', filled_qty: '8', type: 'market',
    status: 'filled', submitted_at: '2026-05-10T15:55:00Z', filled_avg_price: '435.82' },
  { id: 'ord_1b03e8', symbol: 'NVDA', side: 'buy', qty: '3', filled_qty: '3', type: 'market',
    status: 'filled', submitted_at: '2026-05-09T16:30:00Z', filled_avg_price: '878.50' },
];

const MOCK_WATCHLIST = [
  { symbol: 'AAPL', price: 212.83, change: 2.41, changePct: 1.146, signals: [
    { type: 'buy', label: 'MACD cross' }, { type: 'hold', label: 'RSI 58' }
  ]},
  { symbol: 'NVDA', price: 893.45, change: 14.22, changePct: 1.617, signals: [
    { type: 'buy', label: 'SMA50>200' }, { type: 'buy', label: 'Bollinger break' }
  ]},
  { symbol: 'GOOGL', price: 174.18, change: -0.62, changePct: -0.355, signals: [
    { type: 'hold', label: 'RSI 51' }
  ]},
  { symbol: 'TSLA', price: 226.50, change: -3.18, changePct: -1.385, signals: [
    { type: 'sell', label: 'MACD cross' }, { type: 'sell', label: 'RSI 31' }
  ]},
  { symbol: 'MSFT', price: 438.10, change: 4.04, changePct: 0.931, signals: [
    { type: 'hold', label: 'RSI 62' }
  ]},
  { symbol: 'AMD', price: 162.74, change: 1.83, changePct: 1.137, signals: [
    { type: 'buy', label: 'Bollinger break' }
  ]},
  { symbol: 'PLTR', price: 24.82, change: 0.91, changePct: 3.804, signals: [
    { type: 'buy', label: 'MACD cross' }, { type: 'buy', label: 'RSI 71' }
  ]},
  { symbol: 'ASML', price: 1042.30, change: -8.14, changePct: -0.775, signals: [
    { type: 'hold', label: 'RSI 49' }
  ]},
];

const MOCK_HELD_BY_FILER = new Set(['NVDA', 'PLTR']);

const MOCK_SIGNAL_LOG = [
  { id: '1', time: new Date(Date.now() - 1000 * 60 * 2),  message: 'Bullish — MACD cross', type: 'buy',  symbol: 'PLTR' },
  { id: '2', time: new Date(Date.now() - 1000 * 60 * 7),  message: 'Bullish — Bollinger break', type: 'buy',  symbol: 'NVDA' },
  { id: '3', time: new Date(Date.now() - 1000 * 60 * 19), message: 'Bearish — RSI 31',     type: 'sell', symbol: 'TSLA' },
  { id: '4', time: new Date(Date.now() - 1000 * 60 * 24), message: 'Bullish — MACD cross', type: 'buy',  symbol: 'AAPL' },
  { id: '5', time: new Date(Date.now() - 1000 * 60 * 41), message: 'Bearish — MACD cross', type: 'sell', symbol: 'TSLA' },
  { id: '6', time: new Date(Date.now() - 1000 * 60 * 58), message: 'Failed to fetch quote', type: 'warn', symbol: 'BRK.B' },
  { id: '7', time: new Date(Date.now() - 1000 * 60 * 92), message: 'Bullish — SMA50 crossed SMA200', type: 'buy', symbol: 'NVDA' },
  { id: '8', time: new Date(Date.now() - 1000 * 60 * 121), message: 'Auto-mirrored from Pelosi disclosure', type: 'info', symbol: 'NVDA' },
];

const MOCK_FILERS = [
  {
    id: 1, name: 'Nancy Pelosi', filer_type: 'congress',
    source_id: 'nancy-pelosi', added_at: '2026-03-12T00:00:00Z',
    transactions: [
      { id: 11, symbol: 'NVDA', transaction_type: 'Purchase', amount_low: 1000000, amount_high: 5000000, trade_date: '2026-05-08' },
      { id: 12, symbol: 'PLTR', transaction_type: 'Purchase', amount_low: 500000, amount_high: 1000000, trade_date: '2026-05-02' },
      { id: 13, symbol: 'GOOGL', transaction_type: 'Sale (Partial)', amount_low: 100000, amount_high: 250000, trade_date: '2026-04-22' },
      { id: 14, symbol: 'AAPL', transaction_type: 'Purchase', amount_low: 250000, amount_high: 500000, trade_date: '2026-04-18' },
    ],
    holdings: [],
  },
  {
    id: 2, name: 'Berkshire Hathaway', filer_type: 'institution',
    source_id: '0001067983', added_at: '2026-02-04T00:00:00Z',
    transactions: [],
    holdings: [
      { id: 21, symbol: 'AAPL', shares: 905560000, value_usd: 174800000000, report_date: '2026-03-31' },
      { id: 22, symbol: 'BAC',  shares: 1032852006, value_usd: 39160000000, report_date: '2026-03-31' },
      { id: 23, symbol: 'AXP',  shares: 151610700, value_usd: 28410000000, report_date: '2026-03-31' },
      { id: 24, symbol: 'KO',   shares: 400000000, value_usd: 25180000000, report_date: '2026-03-31' },
      { id: 25, symbol: 'CVX',  shares: 118610534, value_usd: 19180000000, report_date: '2026-03-31' },
    ],
  },
  {
    id: 3, name: 'Scion Asset Management', filer_type: 'institution',
    source_id: '0001649339', added_at: '2026-01-22T00:00:00Z',
    transactions: [],
    holdings: [
      { id: 31, symbol: 'BABA', shares: 200000, value_usd: 16800000, report_date: '2026-03-31' },
      { id: 32, symbol: 'JD',   shares: 250000, value_usd: 8750000,  report_date: '2026-03-31' },
    ],
  },
];

const MOCK_AUTO_TRADES = [
  { id: 1, symbol: 'NVDA', side: 'buy', qty: '5', source: 'pelosi-mirror',
    source_ref: 'Pelosi Purchase $1M–$5M · 2026-05-08',
    order_id: 'ord_9f3a2b', status: 'submitted', error: null,
    created_at: '2026-05-14T15:18:00' },
  { id: 2, symbol: 'GOOGL', side: 'buy', qty: '20', source: 'pelosi-mirror',
    source_ref: 'Pelosi Purchase $500K–$1M · 2026-05-02',
    order_id: 'ord_51e2c0', status: 'submitted', error: null,
    created_at: '2026-05-12T18:11:00' },
  { id: 3, symbol: 'BRK.B', side: 'buy', qty: '4', source: 'signal-engine',
    source_ref: 'MACD cross + SMA50>200',
    order_id: null, status: 'failed', error: 'insufficient buying power',
    created_at: '2026-05-11T14:02:00' },
  { id: 4, symbol: 'PLTR', side: 'buy', qty: '40', source: 'pelosi-mirror',
    source_ref: 'Pelosi Purchase $500K–$1M · 2026-05-02',
    order_id: 'ord_64b9f1', status: 'submitted', error: null,
    created_at: '2026-05-10T16:45:00' },
];

const MOCK_INSIGHTS = {
  refreshed_at: '2026-05-14 17:30 ET',
  universe_size: 53,
  d7: [
    { symbol: 'PLTR', return_pct: 12.42, current_price: 24.82 },
    { symbol: 'NVDA', return_pct: 8.91,  current_price: 893.45 },
    { symbol: 'AVGO', return_pct: 6.34,  current_price: 1721.40 },
    { symbol: 'AMD',  return_pct: 5.18,  current_price: 162.74 },
    { symbol: 'MU',   return_pct: 4.92,  current_price: 119.20 },
    { symbol: 'MSFT', return_pct: 2.71,  current_price: 438.10 },
    { symbol: 'AAPL', return_pct: 1.83,  current_price: 212.83 },
    { symbol: 'TSLA', return_pct: -4.21, current_price: 226.50 },
  ],
  d14: [
    { symbol: 'PLTR', return_pct: 18.84, current_price: 24.82 },
    { symbol: 'NVDA', return_pct: 14.12, current_price: 893.45 },
    { symbol: 'AMD',  return_pct: 9.83,  current_price: 162.74 },
    { symbol: 'AVGO', return_pct: 8.41,  current_price: 1721.40 },
    { symbol: 'META', return_pct: 6.77,  current_price: 622.10 },
    { symbol: 'MSFT', return_pct: 4.18,  current_price: 438.10 },
    { symbol: 'AAPL', return_pct: 3.02,  current_price: 212.83 },
    { symbol: 'TSLA', return_pct: -8.40, current_price: 226.50 },
  ],
  d30: [
    { symbol: 'NVDA', return_pct: 24.71, current_price: 893.45 },
    { symbol: 'PLTR', return_pct: 22.93, current_price: 24.82 },
    { symbol: 'AVGO', return_pct: 18.22, current_price: 1721.40 },
    { symbol: 'AMD',  return_pct: 15.49, current_price: 162.74 },
    { symbol: 'META', return_pct: 11.30, current_price: 622.10 },
    { symbol: 'MSFT', return_pct: 7.94,  current_price: 438.10 },
    { symbol: 'AAPL', return_pct: 5.41,  current_price: 212.83 },
    { symbol: 'TSLA', return_pct: -11.82, current_price: 226.50 },
  ],
};

// Formatting helpers (mirrors frontend/src/lib/format.ts)
function fmtMoney(n) {
  if (n == null || isNaN(n)) return '$—';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-$' : '$') + formatted;
}
function fmtMoneyShort(n) {
  if (n == null || isNaN(n)) return '$—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n < 0 ? '-$' : '$') + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (n < 0 ? '-$' : '$') + (abs / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n < 0 ? '-$' : '$') + (abs / 1e3).toFixed(1) + 'K';
  return fmtMoney(n);
}
function fmtPct(n) {
  if (n == null || isNaN(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}
function deltaClass(n) {
  if (n == null) return 'neu';
  if (n > 0) return 'pos';
  if (n < 0) return 'neg';
  return 'neu';
}
function relTime(d) {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

window.LedgerData = {
  MOCK_ACCOUNT, MOCK_CLOCK, MOCK_SETTINGS, MOCK_POSITIONS, MOCK_ORDERS,
  MOCK_WATCHLIST, MOCK_HELD_BY_FILER, MOCK_SIGNAL_LOG, MOCK_FILERS,
  MOCK_AUTO_TRADES, MOCK_INSIGHTS,
};
window.LedgerFmt = { fmtMoney, fmtMoneyShort, fmtPct, deltaClass, relTime };
