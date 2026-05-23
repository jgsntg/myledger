import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api/client'
import AppHeader, { TABS, type TabId } from './components/AppHeader'
import PortfolioChart from './components/PortfolioChart'
import TaxImpactStrip from './components/TaxImpactStrip'
import SettingsDrawer from './components/SettingsDrawer'
import TradeModal from './components/TradeModal'
import WatchlistTab from './components/tabs/WatchlistTab'
import PositionsTab from './components/tabs/PositionsTab'
import FilersTab from './components/tabs/FilersTab'
import DiscoverTab from './components/tabs/DiscoverTab'
import GlossaryTab from './components/tabs/GlossaryTab'
import {
  AccountData,
  AppSettings,
  AutoTradeEntry,
  ClockData,
  Order,
  Position,
  SignalLogEntry,
  StockData,
  WatchlistEntry,
} from './types'

interface TradeTarget {
  symbol: string
  presetSide?: 'buy' | 'sell'
  presetQty?: string
  sourceNote?: string
}

let logIdCounter = 0
function mkLogId() {
  return String(++logIdCounter)
}

export default function App() {
  const [symbols, setSymbols] = useState<string[]>([])
  const [stockData, setStockData] = useState<Record<string, StockData | null>>({})
  const [account, setAccount] = useState<AccountData | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [clock, setClock] = useState<ClockData | null>(null)
  const [signalLog, setSignalLog] = useState<SignalLogEntry[]>([])
  const [tradeTarget, setTradeTarget] = useState<TradeTarget | null>(null)
  const [heldSymbols, setHeldSymbols] = useState<Set<string>>(new Set())
  const [connected, setConnected] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings>({
    trading_mode: 'manual',
    alpaca_env: 'paper',
    default_trade_usd: 500,
    tax_short_term_rate: 0.37,
    tax_long_term_rate: 0.20,
    tax_long_term_days: 365,
    insights_extra_symbols: '',
  })
  const [showSettings, setShowSettings] = useState(false)
  const [autoTrades, setAutoTrades] = useState<AutoTradeEntry[]>([])
  const [symbolNames, setSymbolNames] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const hash = window.location.hash.slice(1) as TabId
    return TABS.some((t) => t.id === hash) ? hash : 'watchlist'
  })

  useEffect(() => {
    window.location.hash = activeTab
  }, [activeTab])

  // Track previous signals per symbol to detect transitions
  const prevSignals = useRef<Record<string, Set<string>>>({})

  function addLog(
    message: string,
    type: SignalLogEntry['type'],
    symbol: string | null = null,
  ) {
    const entry: SignalLogEntry = {
      id: mkLogId(),
      time: new Date(),
      message,
      type,
      symbol,
    }
    setSignalLog((prev) => [entry, ...prev].slice(0, 50))
  }

  const refreshAccount = useCallback(async () => {
    try {
      const [acct, pos, ord] = await Promise.all([
        api.getAccount() as Promise<AccountData>,
        api.getPositions() as Promise<Position[]>,
        api.getOrders(20) as Promise<Order[]>,
      ])
      setAccount(acct)
      setPositions(pos)
      setOrders(ord)
      setConnected(true)
    } catch (e) {
      console.error('Account refresh failed:', e)
    }
  }, [])

  const refreshStockData = useCallback(
    async (syms: string[]) => {
      if (!syms.length) return

      try {
        const snapshots = (await api.getSnapshots(syms)) as Record<string, Record<string, unknown>>

        await Promise.all(
          syms.map(async (sym) => {
            try {
              const [barsRaw, indRaw] = await Promise.all([
                api.getBars(sym, 365),
                api.getIndicators(sym),
              ])

              const snap = snapshots[sym]
              if (!snap) return

              const latestTrade = snap.latestTrade as { p: number } | undefined
              const minuteBar = snap.minuteBar as { c: number } | undefined
              const dailyBar = snap.dailyBar as { c: number } | undefined
              const prevDailyBar = snap.prevDailyBar as { c: number } | undefined

              const price =
                latestTrade?.p ?? minuteBar?.c ?? dailyBar?.c ?? 0
              const prevClose =
                prevDailyBar?.c ??
                (barsRaw.length >= 2 ? barsRaw[barsRaw.length - 2].c : price)
              const change = price - prevClose
              const changePct = prevClose ? (change / prevClose) * 100 : 0

              const fresh: StockData = {
                symbol: sym,
                price,
                change,
                changePct,
                prevClose,
                bars: barsRaw,
                indicators: indRaw,
                snapshot: snap as StockData['snapshot'],
              }

              // Detect new signals
              const newLabels = new Set(indRaw.signals.map((s) => s.label))
              const oldLabels = prevSignals.current[sym] ?? new Set()
              for (const sig of indRaw.signals) {
                if (!oldLabels.has(sig.label) && sig.type !== 'hold') {
                  const verb = sig.type === 'buy' ? 'Bullish' : 'Bearish'
                  addLog(`${verb} — ${sig.label}`, sig.type, sym)
                }
              }
              prevSignals.current[sym] = newLabels

              setStockData((prev) => ({ ...prev, [sym]: fresh }))
            } catch (e) {
              console.error(`Failed refreshing ${sym}:`, e)
              addLog(`Failed to fetch ${sym}`, 'warn', sym)
            }
          }),
        )
      } catch (e) {
        console.error('Snapshot refresh failed:', e)
      }
    },
    [],
  )

  const refreshAutoTrades = useCallback(async () => {
    try {
      const trades = await api.getAutoTrades()
      setAutoTrades(trades)
    } catch (e) {
      console.error('Auto-trade log refresh failed:', e)
    }
  }, [])

  async function handleMarkAuto(orderId: string) {
    await api.backfillAutoTrade(orderId)
    await refreshAutoTrades()
  }

  async function toggleTradingMode() {
    if (appSettings.alpaca_env === 'live') return
    const next = appSettings.trading_mode === 'auto' ? 'manual' : 'auto'
    try {
      const updated = await api.updateSettings({ trading_mode: next })
      setAppSettings(updated)
    } catch (e) {
      console.error('Failed to update trading mode:', e)
    }
  }

  // Bootstrap: load watchlist, clock, settings, then data
  useEffect(() => {
    async function init() {
      try {
        const [watchlist, clockData, settingsData] = await Promise.all([
          api.getWatchlist(),
          api.getClock(),
          api.getSettings(),
        ])
        const syms = watchlist.map((e: WatchlistEntry) => e.symbol)
        setSymbols(syms)
        setClock(clockData)
        setAppSettings(settingsData)

        // Seed skeleton entries
        setStockData(Object.fromEntries(syms.map((s: string) => [s, null])))

        await Promise.all([refreshAccount(), refreshStockData(syms), refreshAutoTrades()])

        // Fetch company names non-blocking — UI works fine without them
        if (syms.length) {
          api.getTickerNames(syms).then(setSymbolNames).catch(() => {})
        }
      } catch (e) {
        console.error('Init failed:', e)
      }
    }
    init()
  }, [refreshAccount, refreshStockData, refreshAutoTrades])

  // Periodic refresh: clock every 30s, stocks every 30s, account every 20s
  useEffect(() => {
    const clockTimer = setInterval(async () => {
      try {
        const c = await api.getClock()
        setClock(c)
      } catch {}
    }, 30_000)

    const stockTimer = setInterval(() => {
      setSymbols((syms) => {
        refreshStockData(syms)
        return syms
      })
    }, 30_000)

    const accountTimer = setInterval(refreshAccount, 20_000)
    const autoTradeTimer = setInterval(refreshAutoTrades, 30_000)

    return () => {
      clearInterval(clockTimer)
      clearInterval(stockTimer)
      clearInterval(accountTimer)
      clearInterval(autoTradeTimer)
    }
  }, [refreshAccount, refreshStockData, refreshAutoTrades])

  async function handleAddSymbol(symbol: string) {
    await api.addToWatchlist(symbol)
    setSymbols((prev) => [...prev, symbol])
    setStockData((prev) => ({ ...prev, [symbol]: null }))
    refreshStockData([symbol])
    api.getTickerNames([symbol]).then((names) => setSymbolNames((prev) => ({ ...prev, ...names }))).catch(() => {})
  }

  async function handleRemoveSymbol(symbol: string) {
    await api.removeFromWatchlist(symbol)
    setSymbols((prev) => prev.filter((s) => s !== symbol))
    setStockData((prev) => {
      const next = { ...prev }
      delete next[symbol]
      return next
    })
    delete prevSignals.current[symbol]
  }

  function openTrade(
    symbol: string,
    presetSide?: 'buy' | 'sell',
    presetQty?: string,
    sourceNote?: string,
  ) {
    setTradeTarget({ symbol, presetSide, presetQty, sourceNote })
  }

  const autoOrderIds = new Set(
    autoTrades.map((t) => t.order_id).filter(Boolean) as string[],
  )

  return (
    <>
      <AppHeader
        isConnected={connected}
        clock={clock}
        tradingMode={appSettings.trading_mode}
        alpacaEnv={appSettings.alpaca_env}
        onToggleTradingMode={toggleTradingMode}
        onOpenSettings={() => setShowSettings(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main
        style={{
          maxWidth: 1600,
          margin: '0 auto',
          width: '100%',
          padding: '28px 32px 80px',
        }}
      >
        <PortfolioChart account={account} positions={positions} />
        <TaxImpactStrip account={account} positions={positions} settings={appSettings} />

        {activeTab === 'watchlist' && (
          <WatchlistTab
            symbols={symbols}
            stockData={stockData}
            signalLog={signalLog}
            heldSymbols={heldSymbols}
            symbolNames={symbolNames}
            onAdd={handleAddSymbol}
            onRemove={handleRemoveSymbol}
            onTrade={(sym) => openTrade(sym)}
          />
        )}
        {activeTab === 'positions' && (
          <PositionsTab
            positions={positions}
            orders={orders}
            autoOrderIds={autoOrderIds}
            autoTrades={autoTrades}
            onTrade={(sym, side, qty) => openTrade(sym, side, qty)}
            onMarkAuto={handleMarkAuto}
          />
        )}
        {activeTab === 'filers' && (
          <FilersTab
            autoTrades={autoTrades}
            tradingMode={appSettings.trading_mode}
            onMirror={(symbol, side, qty, sourceNote) =>
              openTrade(symbol, side, qty, sourceNote)
            }
            onHeldSymbolsChange={setHeldSymbols}
          />
        )}
        {activeTab === 'discover' && (
          <DiscoverTab
            settings={appSettings}
            watchlistSymbols={symbols}
            positions={positions}
            onSettingsUpdate={setAppSettings}
            onAddToWatchlist={handleAddSymbol}
            onRemoveFromWatchlist={handleRemoveSymbol}
            onTrade={(sym) => openTrade(sym)}
          />
        )}
        {activeTab === 'glossary' && <GlossaryTab />}

        <div
          style={{
            marginTop: 40,
            padding: '16px 22px',
            border: '1px dashed var(--line)',
            color: 'var(--ink-mute)',
            fontSize: 12,
            fontStyle: 'italic',
            fontFamily: 'Fraunces, Georgia, serif',
            lineHeight: 1.6,
          }}
        >
          A note on the signals: RSI, MACD, moving-average crossovers, and Bollinger Bands are
          descriptive indicators of recent price behavior, not predictions. They tell you what the
          math says about the past — not what the market will do next. This dashboard is a thinking
          aid, not financial advice. Trade your own judgment.
        </div>
      </main>

      <SettingsDrawer
        open={showSettings}
        onClose={() => setShowSettings(false)}
        settings={appSettings}
        onSave={async (patch) => {
          const updated = await api.updateSettings(patch)
          setAppSettings(updated)
        }}
      />

      {tradeTarget && (
        <TradeModal
          symbol={tradeTarget.symbol}
          presetSide={tradeTarget.presetSide}
          presetQty={tradeTarget.presetQty}
          sourceNote={tradeTarget.sourceNote}
          stockData={stockData}
          account={account}
          onClose={() => setTradeTarget(null)}
          onOrderFilled={refreshAccount}
        />
      )}
    </>
  )
}
