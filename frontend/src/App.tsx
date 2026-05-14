import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api/client'
import Header from './components/Header'
import PortfolioSummary from './components/PortfolioSummary'
import Watchlist from './components/Watchlist'
import SignalsLog from './components/SignalsLog'
import PositionsTable from './components/PositionsTable'
import OrdersTable from './components/OrdersTable'
import TradeModal from './components/TradeModal'
import {
  AccountData,
  Bar,
  ClockData,
  Indicators,
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
  const [connected, setConnected] = useState(false)

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
                api.getBars(sym, 365) as Promise<Bar[]>,
                api.getIndicators(sym) as Promise<Indicators>,
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

  // Bootstrap: load watchlist, clock, then data
  useEffect(() => {
    async function init() {
      try {
        const [watchlist, clockData] = await Promise.all([
          api.getWatchlist(),
          api.getClock() as Promise<ClockData>,
        ])
        const syms = watchlist.map((e: WatchlistEntry) => e.symbol)
        setSymbols(syms)
        setClock(clockData)

        // Seed skeleton entries
        setStockData(Object.fromEntries(syms.map((s: string) => [s, null])))

        await Promise.all([refreshAccount(), refreshStockData(syms)])
      } catch (e) {
        console.error('Init failed:', e)
      }
    }
    init()
  }, [refreshAccount, refreshStockData])

  // Periodic refresh: clock every 30s, stocks every 30s, account every 20s
  useEffect(() => {
    const clockTimer = setInterval(async () => {
      try {
        const c = (await api.getClock()) as ClockData
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

    return () => {
      clearInterval(clockTimer)
      clearInterval(stockTimer)
      clearInterval(accountTimer)
    }
  }, [refreshAccount, refreshStockData])

  async function handleAddSymbol(symbol: string) {
    await api.addToWatchlist(symbol)
    setSymbols((prev) => [...prev, symbol])
    setStockData((prev) => ({ ...prev, [symbol]: null }))
    refreshStockData([symbol])
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

  function openTrade(symbol: string, presetSide?: 'buy' | 'sell', presetQty?: string) {
    setTradeTarget({ symbol, presetSide, presetQty })
  }

  return (
    <>
      <Header isConnected={connected} clock={clock} onConnect={() => {}} />

      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '32px' }}>
        <PortfolioSummary account={account} positions={positions} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 380px',
            gap: 28,
          }}
        >
          <Watchlist
            symbols={symbols}
            stockData={stockData}
            onAdd={handleAddSymbol}
            onRemove={handleRemoveSymbol}
            onTrade={(sym) => openTrade(sym)}
          />

          <SignalsLog entries={signalLog} />
        </div>

        <PositionsTable
          positions={positions}
          onTrade={(sym, side, qty) => openTrade(sym, side, qty)}
        />

        <OrdersTable orders={orders} />

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
      </div>

      {tradeTarget && (
        <TradeModal
          symbol={tradeTarget.symbol}
          presetSide={tradeTarget.presetSide}
          presetQty={tradeTarget.presetQty}
          stockData={stockData}
          account={account}
          onClose={() => setTradeTarget(null)}
          onOrderFilled={refreshAccount}
        />
      )}
    </>
  )
}
