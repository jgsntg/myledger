import { useEffect, useState } from 'react'
import { Alert, Bar, Indicators, NewsArticle, SignalEvent, TickerDetails } from '../types'
import { fmtMoney, rsiNote, macdNote, bbNote } from '../lib/format'
import { api } from '../api/client'

interface Props {
  symbol: string
  price: number
  isUp: boolean
  bars: Bar[]
  indicators: Indicators | null
}

type Tab = 'indicators' | 'history' | 'alerts' | 'news'

// ── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ bars, isUp }: { bars: Bar[]; isUp: boolean }) {
  if (!bars.length) return null
  const w = 320, h = 180, pad = 8
  const closes = bars.slice(-60).map((b) => b.c)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const stepX = (w - pad * 2) / Math.max(closes.length - 1, 1)
  const points = closes.map((p, i) => {
    const x = pad + i * stepX
    const y = pad + (h - pad * 2) * (1 - (p - min) / range)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const color = isUp ? '#6fcf97' : '#eb5757'
  const fill  = isUp ? 'rgba(111, 207, 151, 0.08)' : 'rgba(235, 87, 87, 0.08)'
  const areaPoints = `${pad},${h - pad} ${points} ${pad + (closes.length - 1) * stepX},${h - pad}`

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: 16 }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
        60-Day Price
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" preserveAspectRatio="none">
        <polygon points={areaPoints} fill={fill} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', marginTop: 8 }}>
        <span>Low {fmtMoney(min)}</span>
        <span>High {fmtMoney(max)}</span>
      </div>
    </div>
  )
}

// ── Indicator card ─────────────────────────────────────────────────────────

function IndicatorCard({ label, value, note, span2 }: { label: string; value: string; note: string; span2?: boolean }) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '14px 16px', gridColumn: span2 ? 'span 2' : undefined }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: span2 ? 13 : 16, fontWeight: 500 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4, fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif' }}>{note}</div>
    </div>
  )
}

// ── Signal history tab ─────────────────────────────────────────────────────

function SignalHistory({ symbol }: { symbol: string }) {
  const [events, setEvents] = useState<SignalEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getSignalHistory(symbol, 30)
      .then((rows) => setEvents(rows as unknown as SignalEvent[]))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false))
  }, [symbol])

  if (loading) {
    return <div style={{ padding: '24px 0', color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>Loading…</div>
  }

  if (!events.length) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-mute)', fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif', fontSize: 15 }}>
        No signal events in the last 30 days.
        <div style={{ fontSize: 12, marginTop: 8 }}>The scanner logs transitions when a signal first fires during market hours.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
      {events.map((e, i) => {
        const color = e.signal_type === 'buy' ? 'var(--green)' : e.signal_type === 'sell' ? 'var(--red)' : 'var(--ink-soft)'
        const dt = new Date(e.triggered_at)
        return (
          <div key={i} style={{ background: 'var(--bg-elev)', padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center' }}>
            <div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color, fontWeight: 500 }}>{e.signal_label}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--ink-mute)', marginLeft: 12 }}>@ {fmtMoney(e.price_at_signal)}</span>
              {e.rsi_at_signal != null && (
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', marginLeft: 12 }}>RSI {e.rsi_at_signal.toFixed(1)}</span>
              )}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', textAlign: 'right', whiteSpace: 'nowrap' }}>
              {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
              {dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Alerts tab ─────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  price_above: 'Price above',
  price_below: 'Price below',
  rsi_above:   'RSI above',
  rsi_below:   'RSI below',
}

function AlertsPanel({ symbol }: { symbol: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [condition, setCondition] = useState<Alert['condition']>('price_above')
  const [threshold, setThreshold] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function loadAlerts() {
    api.getAlerts()
      .then((rows) => setAlerts((rows as unknown as Alert[]).filter((a) => a.symbol === symbol)))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAlerts() }, [symbol])

  async function handleCreate() {
    const val = parseFloat(threshold)
    if (!val || val <= 0) { setError('Enter a valid threshold.'); return }
    setSaving(true)
    setError(null)
    try {
      await api.createAlert({ symbol, condition, threshold: val })
      setThreshold('')
      loadAlerts()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(alert: Alert) {
    await api.updateAlert(alert.id, { active: !alert.active })
    loadAlerts()
  }

  async function handleDelete(id: number) {
    await api.deleteAlert(id)
    loadAlerts()
  }

  return (
    <div>
      {/* Create form */}
      <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '16px', marginBottom: 16 }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          New Alert
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>Condition</div>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as Alert['condition'])}
              style={{ width: '100%', background: 'var(--bg-elev)', border: '1px solid var(--line)', color: 'var(--ink)', padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, outline: 'none', cursor: 'pointer' }}
            >
              {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 6 }}>
              {condition.startsWith('rsi') ? 'RSI value' : 'Price ($)'}
            </div>
            <input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder={condition.startsWith('rsi') ? '30' : '200.00'}
              style={{ width: '100%', background: 'var(--bg-elev)', border: '1px solid var(--line)', color: 'var(--ink)', padding: '8px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, outline: 'none' }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{ background: 'var(--accent)', color: 'var(--bg)', border: 'none', padding: '8px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: saving ? 0.6 : 1 }}
          >
            Add
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 8, color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{error}</div>
        )}
      </div>

      {/* Alert list */}
      {loading ? (
        <div style={{ color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>Loading…</div>
      ) : alerts.length === 0 ? (
        <div style={{ color: 'var(--ink-mute)', fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif', fontSize: 14 }}>No alerts set for {symbol}.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
          {alerts.map((a) => (
            <div key={a.id} style={{ background: 'var(--bg-elev)', padding: '11px 14px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center' }}>
              <div>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: a.active ? 'var(--ink)' : 'var(--ink-mute)' }}>
                  {CONDITION_LABELS[a.condition]} {a.condition.startsWith('rsi') ? a.threshold : fmtMoney(a.threshold)}
                </span>
                {a.last_triggered_at && (
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--amber)', marginLeft: 10 }}>
                    last fired {new Date(a.last_triggered_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleToggle(a)}
                title={a.active ? 'Pause alert' : 'Activate alert'}
                style={{ background: 'transparent', border: '1px solid var(--line)', color: a.active ? 'var(--green)' : 'var(--ink-mute)', padding: '4px 10px', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}
              >
                {a.active ? 'On' : 'Off'}
              </button>
              <button
                onClick={() => handleDelete(a.id)}
                title="Delete alert"
                style={{ background: 'transparent', border: 'none', color: 'var(--ink-mute)', fontSize: 16, cursor: 'pointer', padding: '2px 4px' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--red)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-mute)')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── News & company tab ─────────────────────────────────────────────────────

function fmtMarketCap(n: number | null): string {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

function NewsPanel({ symbol }: { symbol: string }) {
  const [details, setDetails] = useState<TickerDetails | null>(null)
  const [news, setNews]       = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      api.getTickerDetails(symbol),
      api.getTickerNews(symbol, 10),
    ])
      .then(([d, n]) => { setDetails(d); setNews(n) })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [symbol])

  if (loading) {
    return <div style={{ padding: '24px 0', color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>Loading…</div>
  }

  if (error) {
    return <div style={{ padding: '24px 0', color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{error}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Company profile */}
      {details && (
        <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 600 }}>{details.name}</span>
            {details.sic_description && (
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', background: 'var(--bg-elev)', border: '1px solid var(--line)', padding: '2px 8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                {details.sic_description}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 32, marginBottom: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 3 }}>Market Cap</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 500 }}>{fmtMarketCap(details.market_cap ?? null)}</div>
            </div>
            {details.primary_exchange && (
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 3 }}>Exchange</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 500 }}>{details.primary_exchange}</div>
              </div>
            )}
            {details.list_date && (
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--ink-mute)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 3 }}>Listed</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 500 }}>{details.list_date}</div>
              </div>
            )}
          </div>
          {details.description && (
            <p style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.65, margin: 0, marginBottom: details.homepage_url ? 12 : 0 }}>
              {details.description.length > 400 ? details.description.slice(0, 400) + '…' : details.description}
            </p>
          )}
          {details.homepage_url && (
            <a
              href={details.homepage_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--accent)', textDecoration: 'none', letterSpacing: '0.5px' }}
            >
              {details.homepage_url.replace(/^https?:\/\//, '')} ↗
            </a>
          )}
        </div>
      )}

      {/* News feed */}
      <div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 12 }}>
          Recent News
        </div>
        {news.length === 0 ? (
          <div style={{ color: 'var(--ink-mute)', fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif', fontSize: 14 }}>
            No recent news for {symbol}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--line)', border: '1px solid var(--line)' }}>
            {news.map((article) => {
              const dt = new Date(article.published_utc)
              const ago = Math.round((Date.now() - dt.getTime()) / 3600000)
              const timeLabel = ago < 24
                ? `${ago}h ago`
                : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return (
                <a
                  key={article.id}
                  href={article.article_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ background: 'var(--bg-elev)', padding: '14px 16px', textDecoration: 'none', display: 'block' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {article.publisher.name}
                    </span>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {timeLabel}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 14, color: 'var(--ink)', lineHeight: 1.4, marginBottom: article.description ? 4 : 0 }}>
                    {article.title}
                  </div>
                  {article.description && (
                    <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                      {article.description.length > 160 ? article.description.slice(0, 160) + '…' : article.description}
                    </div>
                  )}
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export default function StockDetail({ symbol, price, isUp, bars, indicators: ind }: Props) {
  const [tab, setTab] = useState<Tab>('indicators')

  function TabBtn({ id, label }: { id: Tab; label: string }) {
    const active = tab === id
    return (
      <button
        onClick={() => setTab(id)}
        style={{
          background: active ? 'var(--bg-card)' : 'transparent',
          border: 'none',
          borderBottom: active ? '1px solid var(--accent)' : '1px solid transparent',
          color: active ? 'var(--ink)' : 'var(--ink-mute)',
          padding: '8px 16px',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          cursor: 'pointer',
          fontWeight: active ? 600 : 400,
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ borderTop: '1px solid var(--line)', background: 'var(--bg-card)' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)', background: 'var(--bg-elev)', paddingLeft: 22 }}>
        <TabBtn id="indicators" label="Indicators" />
        <TabBtn id="history"    label="Signal History" />
        <TabBtn id="alerts"     label="Alerts" />
        <TabBtn id="news"       label="News" />
      </div>

      <div style={{ padding: '24px 22px' }}>
        {tab === 'indicators' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <Sparkline bars={bars} isUp={isUp} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <IndicatorCard label="RSI (14)" value={ind?.rsi != null ? ind.rsi.toFixed(1) : '—'} note={rsiNote(ind?.rsi ?? null)} />
              <IndicatorCard label="50-day MA" value={fmtMoney(ind?.sma50 ?? null)} note={ind?.sma50 != null ? (price > ind.sma50 ? 'Above trend' : 'Below trend') : '—'} />
              <IndicatorCard label="200-day MA" value={fmtMoney(ind?.sma200 ?? null)} note={ind?.sma200 != null ? (price > ind.sma200 ? 'Long-term up' : 'Long-term down') : '—'} />
              <IndicatorCard label="MACD" value={ind?.macd != null ? ind.macd.histogram.toFixed(2) : '—'} note={macdNote(ind?.macd ?? null)} />
              <IndicatorCard
                label="Bollinger Bands (20, 2σ)"
                value={ind?.bollinger != null ? `${fmtMoney(ind.bollinger.lower)} · ${fmtMoney(ind.bollinger.middle)} · ${fmtMoney(ind.bollinger.upper)}` : '—'}
                note={bbNote(price, ind?.bollinger ?? null)}
                span2
              />
            </div>
          </div>
        )}

        {tab === 'history' && <SignalHistory symbol={symbol} />}
        {tab === 'alerts'  && <AlertsPanel  symbol={symbol} />}
        {tab === 'news'    && <NewsPanel     symbol={symbol} />}
      </div>
    </div>
  )
}
