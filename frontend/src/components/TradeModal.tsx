import { useEffect, useState } from 'react'
import { AccountData, EvaluationResult, StockData, TradePayload } from '../types'
import { fmtMoney } from '../lib/format'
import { api } from '../api/client'
import TradeEvaluation from './TradeEvaluation'

interface Props {
  symbol: string | null
  presetSide?: 'buy' | 'sell'
  presetQty?: string
  sourceNote?: string
  stockData: Record<string, StockData | null>
  account: AccountData | null
  onClose: () => void
  onOrderFilled: () => void
}

const TERMINAL = new Set(['filled', 'canceled', 'expired', 'rejected', 'done_for_day', 'replaced'])

export default function TradeModal({
  symbol,
  presetSide,
  presetQty,
  sourceNote,
  stockData,
  account,
  onClose,
  onOrderFilled,
}: Props) {
  const [side, setSide] = useState<'buy' | 'sell'>(presetSide ?? 'buy')
  const [qty, setQty] = useState(presetQty ?? '1')
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market')
  const [limitPrice, setLimitPrice] = useState('')
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null)
  const [evalLoading, setEvalLoading] = useState(false)

  useEffect(() => {
    if (symbol) {
      setSide(presetSide ?? 'buy')
      setQty(presetQty ?? '1')
      setOrderType('market')
      setLimitPrice(stockData[symbol]?.price.toFixed(2) ?? '')
      setFeedback(null)
      setEvaluation(null)
    }
  }, [symbol, presetSide, presetQty])

  // Re-evaluate when symbol or side changes
  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setEvaluation(null)
    setEvalLoading(true)
    api.evaluateTrade(symbol, side, qty)
      .then((result) => { if (!cancelled) setEvaluation(result) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEvalLoading(false) })
    return () => { cancelled = true }
  }, [symbol, side])

  if (!symbol) return null

  const stock = stockData[symbol]
  const price = stock?.price ?? null
  const bp = account ? parseFloat(account.buying_power) : null
  const estCost = parseFloat(qty) * (orderType === 'limit' ? parseFloat(limitPrice) || 0 : (price ?? 0))

  async function handleSubmit() {
    if (!symbol) return
    const numQty = parseFloat(qty)
    if (!numQty || numQty <= 0) {
      setFeedback({ ok: false, msg: 'Quantity must be greater than zero.' })
      return
    }
    if (orderType === 'limit' && (!parseFloat(limitPrice) || parseFloat(limitPrice) <= 0)) {
      setFeedback({ ok: false, msg: 'Limit price required for limit orders.' })
      return
    }

    const payload: TradePayload = {
      symbol,
      qty: numQty.toString(),
      side,
      type: orderType,
      time_in_force: 'day',
    }
    if (orderType === 'limit') payload.limit_price = parseFloat(limitPrice).toFixed(2)

    setSubmitting(true)
    try {
      const result = await api.submitOrder(payload as unknown as Record<string, unknown>)
      const orderId = result.id as string
      setFeedback({ ok: true, msg: `Order submitted · ID ${orderId.slice(0, 8)}… · Status: ${result.status}` })
      pollOrder(orderId)
    } catch (e) {
      setFeedback({ ok: false, msg: (e as Error).message })
      setSubmitting(false)
    }
  }

  async function pollOrder(orderId: string) {
    const intervals = [...Array(10).fill(1000), ...Array(10).fill(2000)]
    for (const delay of intervals) {
      await new Promise((r) => setTimeout(r, delay))
      try {
        const order = await api.getOrder(orderId)
        const status = order.status as string
        const filledQty = parseFloat((order.filled_qty as string) || '0')
        const fillPriceRaw = order.filled_avg_price as string | null
        const fillStr = fillPriceRaw ? ` @ ${fmtMoney(parseFloat(fillPriceRaw))}` : ''

        if (status === 'filled') {
          setFeedback({ ok: true, msg: `Filled · ${filledQty} ${symbol}${fillStr}` })
          setSubmitting(false)
          onOrderFilled()
          return
        }
        if (TERMINAL.has(status)) {
          const reason = (order.reject_reason as string) || 'see Recent Orders for details'
          setFeedback({ ok: false, msg: `Order ${status.replace('_', ' ')}: ${reason}` })
          setSubmitting(false)
          onOrderFilled()
          return
        }
        setFeedback({
          ok: true,
          msg: `Status: ${status.replace('_', ' ')}${filledQty > 0 ? ` · ${filledQty}/${order.qty} filled` : ''}…`,
        })
      } catch {
        // polling error — keep trying
      }
    }
    setFeedback({ ok: true, msg: 'Order still pending — check Recent Orders for updates.' })
    setSubmitting(false)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          width: '90%',
          maxWidth: 480,
          padding: 32,
        }}
      >
        <h2
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontWeight: 400,
            fontSize: 24,
            marginBottom: 8,
          }}
        >
          Place Order · {symbol}
        </h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
          Paper trading — no real money at risk.
        </p>

        {sourceNote && (
          <div
            style={{
              borderLeft: '2px solid var(--accent)',
              background: 'rgba(212, 165, 116, 0.08)',
              color: 'var(--ink-soft)',
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 12,
              lineHeight: 1.5,
              fontFamily: 'Fraunces, Georgia, serif',
              fontStyle: 'italic',
            }}
          >
            {sourceNote}
          </div>
        )}

        {/* Side toggle */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            border: '1px solid var(--line)',
            marginBottom: 16,
          }}
        >
          {(['buy', 'sell'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              style={{
                background: side === s ? (s === 'buy' ? 'var(--green)' : 'var(--red)') : 'transparent',
                border: 'none',
                color: side === s ? 'var(--bg)' : 'var(--ink-soft)',
                padding: 12,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Qty + order type */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label
              style={{
                display: 'block',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--ink-mute)',
                marginBottom: 6,
                marginTop: 14,
              }}
            >
              Quantity
            </label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              min={0}
              step={0.0001}
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                padding: '10px 12px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--ink-mute)',
                marginBottom: 6,
                marginTop: 14,
              }}
            >
              Order Type
            </label>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as 'market' | 'limit')}
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                padding: '10px 12px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </div>
        </div>

        {/* Limit price */}
        {orderType === 'limit' && (
          <div>
            <label
              style={{
                display: 'block',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'var(--ink-mute)',
                marginBottom: 6,
                marginTop: 14,
              }}
            >
              Limit Price
            </label>
            <input
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
              min={0}
              step={0.01}
              style={{
                width: '100%',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                color: 'var(--ink)',
                padding: '10px 12px',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Summary */}
        <div
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            padding: '16px 18px',
            margin: '16px 0',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          {[
            { label: 'Symbol', val: symbol },
            { label: 'Last Price', val: price != null ? fmtMoney(price) : '—' },
            { label: 'Est. Cost', val: fmtMoney(estCost) },
            { label: 'Buying Power', val: bp != null ? fmtMoney(bp) : '—' },
          ].map(({ label, val }) => (
            <div key={label}>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9,
                  color: 'var(--ink-mute)',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                {label}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 15 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Trade evaluation */}
        <TradeEvaluation evaluation={evaluation} loading={evalLoading} />

        {/* Warning */}
        <div
          style={{
            background: 'rgba(242, 201, 76, 0.08)',
            borderLeft: '2px solid var(--amber)',
            padding: '10px 14px',
            fontSize: 12,
            color: 'var(--ink-soft)',
            fontFamily: 'Fraunces, Georgia, serif',
            fontStyle: 'italic',
          }}
        >
          Review carefully before submitting — orders cannot be modified once filled.
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            style={{
              padding: '12px 14px',
              marginTop: 14,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              borderLeft: `2px solid ${feedback.ok ? 'var(--green)' : 'var(--red)'}`,
              background: feedback.ok ? 'rgba(111, 207, 151, 0.08)' : 'rgba(235, 87, 87, 0.08)',
              color: feedback.ok ? 'var(--green)' : 'var(--red)',
            }}
          >
            {feedback.msg}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              border: '1px solid var(--line)',
              background: 'transparent',
              color: 'var(--ink-soft)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '10px 20px',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              letterSpacing: '1.5px',
              textTransform: 'uppercase',
              cursor: submitting ? 'not-allowed' : 'pointer',
              border: '1px solid var(--accent)',
              background: 'var(--accent)',
              color: 'var(--bg)',
              fontWeight: 600,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Submitting…' : 'Submit Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
