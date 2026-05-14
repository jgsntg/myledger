import { Signal, StockData } from '../types'
import { fmtMoney, fmtPct, deltaClass } from '../lib/format'
import StockDetail from './StockDetail'

interface Props {
  symbol: string
  data: StockData | null
  isExpanded: boolean
  onToggle: () => void
  onTrade: (symbol: string) => void
  onRemove: (symbol: string) => void
  heldByFiler?: boolean
}

function SignalBadge({ sig }: { sig: Signal }) {
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    buy: {
      bg: 'rgba(111, 207, 151, 0.12)',
      color: 'var(--green)',
      border: 'rgba(111, 207, 151, 0.3)',
    },
    sell: {
      bg: 'rgba(235, 87, 87, 0.12)',
      color: 'var(--red)',
      border: 'rgba(235, 87, 87, 0.3)',
    },
    hold: {
      bg: 'rgba(160, 156, 147, 0.08)',
      color: 'var(--ink-soft)',
      border: 'var(--line)',
    },
  }
  const c = colors[sig.type] ?? colors.hold
  return (
    <span
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 9,
        letterSpacing: 1,
        textTransform: 'uppercase',
        padding: '4px 8px',
        border: `1px solid ${c.border}`,
        borderRadius: 2,
        background: c.bg,
        color: c.color,
      }}
    >
      {sig.label}
    </span>
  )
}

export default function StockRow({
  symbol,
  data,
  isExpanded,
  onToggle,
  onTrade,
  onRemove,
  heldByFiler = false,
}: Props) {
  const dClass = deltaClass(data?.change ?? null)
  const priceColor =
    dClass === 'pos' ? 'var(--green)' : dClass === 'neg' ? 'var(--red)' : 'var(--ink)'

  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          background: isExpanded ? 'var(--bg-card)' : 'var(--bg-elev)',
          padding: '18px 22px',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 1fr 1.6fr 70px 40px',
          gap: 16,
          alignItems: 'center',
          cursor: 'pointer',
          transition: 'background .15s',
        }}
        onMouseEnter={(e) =>
          !isExpanded && ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg-card)')
        }
        onMouseLeave={(e) =>
          !isExpanded && ((e.currentTarget as HTMLDivElement).style.background = 'var(--bg-elev)')
        }
      >
        {/* Symbol + name */}
        <div>
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: '-0.3px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{symbol}</span>
            {heldByFiler && (
              <span
                title="Held by a tracked 13F filer"
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  color: '#7fb7ff',
                  border: '1px solid rgba(127, 183, 255, 0.4)',
                  background: 'rgba(127, 183, 255, 0.1)',
                  padding: '3px 6px',
                  borderRadius: 2,
                }}
              >
                13F
              </span>
            )}
          </div>
          {data && (
            <div
              style={{
                fontSize: 11,
                color: 'var(--ink-mute)',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginTop: 2,
              }}
            >
              {symbol}
            </div>
          )}
        </div>

        {/* Price */}
        {data ? (
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 18,
              fontWeight: 500,
              color: priceColor,
            }}
          >
            {fmtMoney(data.price)}
          </div>
        ) : (
          <div className="skeleton" style={{ height: 18, width: 80 }} />
        )}

        {/* Change */}
        {data ? (
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 13,
              color: priceColor,
            }}
          >
            {fmtPct(data.changePct)}{' '}
            <span style={{ color: 'var(--ink-mute)' }}>
              {data.change >= 0 ? '+' : ''}
              {data.change.toFixed(2)}
            </span>
          </div>
        ) : (
          <div className="skeleton" style={{ height: 13, width: 60 }} />
        )}

        {/* Signals */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {data?.indicators?.signals.map((s) => (
            <SignalBadge key={s.label} sig={s} />
          ))}
        </div>

        {/* Trade button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onTrade(symbol)
          }}
          disabled={!data}
          style={{
            background: 'transparent',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            padding: '6px 10px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            cursor: data ? 'pointer' : 'not-allowed',
            fontWeight: 600,
            opacity: data ? 1 : 0.3,
          }}
          onMouseEnter={(e) => {
            if (data) {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--accent)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--bg)'
            }
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
          }}
        >
          Trade
        </button>

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove(symbol)
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--ink-mute)',
            fontSize: 18,
            cursor: 'pointer',
            padding: 4,
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = 'var(--red)')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.color = 'var(--ink-mute)')
          }
        >
          ×
        </button>
      </div>

      {/* Expanded detail panel */}
      <div className={`detail-panel${isExpanded ? ' open' : ''}`}>
        {isExpanded && data && (
          <StockDetail
            symbol={symbol}
            price={data.price}
            isUp={data.change >= 0}
            bars={data.bars}
            indicators={data.indicators}
          />
        )}
      </div>
    </div>
  )
}
