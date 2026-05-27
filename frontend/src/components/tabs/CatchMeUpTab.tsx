import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { NewsArticle, Order } from '../../types'
import { fmtMoney } from '../../lib/format'

interface Props {
  symbols: string[]
  orders: Order[]
}

type WatchlistArticle = NewsArticle & { forSymbol: string }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function NewsCard({ article, tag }: { article: NewsArticle; tag?: string }) {
  return (
    <a
      href={article.article_url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        textDecoration: 'none',
        padding: '16px 20px',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
        transition: 'border-color 150ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
        }}
      >
        {tag && (
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9,
              letterSpacing: '1.2px',
              textTransform: 'uppercase',
              padding: '2px 7px',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
            }}
          >
            {tag}
          </span>
        )}
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--ink-mute)',
          }}
        >
          {article.publisher.name}
        </span>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--ink-mute)',
            marginLeft: 'auto',
          }}
        >
          {timeAgo(article.published_utc)}
        </span>
      </div>
      <div
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: 15,
          color: 'var(--ink)',
          lineHeight: 1.45,
          marginBottom: article.description ? 6 : 0,
        }}
      >
        {article.title}
      </div>
      {article.description && (
        <div
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: 13,
            fontStyle: 'italic',
            color: 'var(--ink-soft)',
            lineHeight: 1.6,
          }}
        >
          {article.description.length > 160
            ? article.description.slice(0, 160) + '…'
            : article.description}
        </div>
      )}
    </a>
  )
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        paddingBottom: 12,
        borderBottom: '1px solid var(--line)',
        marginBottom: 16,
      }}
    >
      <h2
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontWeight: 400,
          fontSize: 22,
          letterSpacing: '-0.3px',
          margin: 0,
        }}
      >
        {title}
      </h2>
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'var(--ink-mute)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
        }}
      >
        {sub}
      </span>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: 32,
        textAlign: 'center',
        color: 'var(--ink-mute)',
        fontStyle: 'italic',
        fontFamily: 'Fraunces, Georgia, serif',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
      }}
    >
      {text}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            height: 80,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  )
}

const STATUS_COLOR: Record<string, string> = {
  filled: 'var(--green)',
  partially_filled: 'var(--green)',
  rejected: 'var(--red)',
  new: 'var(--ink-soft)',
  accepted: 'var(--ink-soft)',
  pending_new: 'var(--ink-soft)',
  done_for_day: 'var(--ink-soft)',
  canceled: 'var(--ink-mute)',
}

function OrderRow({ order: o }: { order: Order }) {
  const sideColor = o.side === 'buy' ? 'var(--green)' : 'var(--red)'
  const fillPrice = o.filled_avg_price ? fmtMoney(parseFloat(o.filled_avg_price)) : null
  const statusColor = STATUS_COLOR[o.status] ?? 'var(--ink-soft)'
  const time = new Date(o.submitted_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '14px 20px',
        background: 'var(--bg-elev)',
        border: '1px solid var(--line)',
      }}
    >
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--ink-mute)', minWidth: 48 }}>
        {time}
      </span>
      <span style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 17, fontWeight: 500, minWidth: 60 }}>
        {o.symbol}
      </span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: sideColor, textTransform: 'uppercase', minWidth: 36 }}>
        {o.side}
      </span>
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--ink)' }}>
        {parseFloat(o.filled_qty) > 0 ? o.filled_qty : o.qty} sh
      </span>
      {fillPrice && (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--ink-soft)' }}>
          @ {fillPrice}
        </span>
      )}
      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: statusColor, marginLeft: 'auto' }}>
        {o.status.replace(/_/g, ' ')}
      </span>
    </div>
  )
}

export default function CatchMeUpTab({ symbols, orders }: Props) {
  const [marketNews, setMarketNews] = useState<NewsArticle[]>([])
  const [watchlistNews, setWatchlistNews] = useState<WatchlistArticle[]>([])
  const [loadingMarket, setLoadingMarket] = useState(true)
  const [loadingWatchlist, setLoadingWatchlist] = useState(true)

  useEffect(() => {
    api
      .getTickerNews('SPY', 10)
      .then((articles) => setMarketNews(articles.slice(0, 5)))
      .catch(() => {})
      .finally(() => setLoadingMarket(false))
  }, [])

  useEffect(() => {
    if (!symbols.length) {
      setLoadingWatchlist(false)
      return
    }
    Promise.all(
      symbols.map((sym) =>
        api
          .getTickerNews(sym, 5)
          .then((articles) => articles.map((a) => ({ ...a, forSymbol: sym })))
          .catch(() => [] as WatchlistArticle[]),
      ),
    )
      .then((results) => {
        const seen = new Set<string>()
        const deduped = results
          .flat()
          .sort(
            (a, b) =>
              new Date(b.published_utc).getTime() - new Date(a.published_utc).getTime(),
          )
          .filter((a) => {
            if (seen.has(a.id)) return false
            seen.add(a.id)
            return true
          })
          .slice(0, 5)
        setWatchlistNews(deduped)
      })
      .catch(() => {})
      .finally(() => setLoadingWatchlist(false))
  }, [symbols.join(',')])

  const today = new Date()
  const todayStr = today.toDateString()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toDateString()

  const todayOrders = orders.filter((o) => new Date(o.submitted_at).toDateString() === todayStr)
  const yesterdayOrders = orders.filter((o) => new Date(o.submitted_at).toDateString() === yesterdayStr)

  return (
    <div role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 48, marginTop: 32 }}>
      {/* Market News */}
      <section>
        <SectionHeader title="Top Market News" sub="S&P 500 · top 5" />
        {loadingMarket ? (
          <LoadingSkeleton />
        ) : marketNews.length === 0 ? (
          <EmptyState text="No market news available" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {marketNews.map((a) => (
              <NewsCard key={a.id} article={a} />
            ))}
          </div>
        )}
      </section>

      {/* Watchlist News */}
      <section>
        <SectionHeader
          title="Your Watchlist in the News"
          sub={symbols.length ? `${symbols.length} symbol${symbols.length > 1 ? 's' : ''} · top 5` : 'no symbols'}
        />
        {loadingWatchlist ? (
          <LoadingSkeleton />
        ) : watchlistNews.length === 0 ? (
          <EmptyState
            text={
              symbols.length === 0
                ? 'Add symbols to your watchlist to see news here'
                : 'No recent news for your watchlist'
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {watchlistNews.map((a) => (
              <NewsCard key={a.id} article={a} tag={a.forSymbol} />
            ))}
          </div>
        )}
      </section>

      {/* Today's Orders */}
      <section>
        <SectionHeader
          title="Today's Orders"
          sub={today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        />
        {todayOrders.length === 0 ? (
          <EmptyState text="No orders today yet" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todayOrders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>

      {/* Yesterday's Orders */}
      <section>
        <SectionHeader
          title="Yesterday's Orders"
          sub={yesterday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        />
        {yesterdayOrders.length === 0 ? (
          <EmptyState text="No orders from yesterday" />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {yesterdayOrders.map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
