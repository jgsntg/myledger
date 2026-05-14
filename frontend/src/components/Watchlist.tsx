import { useState } from 'react'
import { StockData } from '../types'
import StockRow from './StockRow'

interface Props {
  symbols: string[]
  stockData: Record<string, StockData | null>
  onAdd: (symbol: string) => Promise<void>
  onRemove: (symbol: string) => void
  onTrade: (symbol: string) => void
  heldSymbols?: Set<string>
}

export default function Watchlist({
  symbols,
  stockData,
  onAdd,
  onRemove,
  onTrade,
  heldSymbols,
}: Props) {
  const [input, setInput] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    const sym = input.trim().toUpperCase()
    if (!sym) return
    if (symbols.includes(sym)) {
      setInput('')
      return
    }
    setAdding(true)
    setError(null)
    try {
      await onAdd(sym)
      setInput('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <section>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <h2
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontWeight: 400,
            fontSize: 22,
            letterSpacing: '-0.3px',
          }}
        >
          Watchlist & Signals
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
          Click a row for indicators
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="Add symbol (e.g. AAPL)"
          maxLength={6}
          style={{
            flex: 1,
            background: 'var(--bg-elev)',
            border: '1px solid var(--line)',
            color: 'var(--ink)',
            padding: '10px 14px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            letterSpacing: 1,
            textTransform: 'uppercase',
            outline: 'none',
          }}
          onFocus={(e) =>
            ((e.currentTarget as HTMLInputElement).style.borderColor = 'var(--accent)')
          }
          onBlur={(e) =>
            ((e.currentTarget as HTMLInputElement).style.borderColor = 'var(--line)')
          }
        />
        <button
          onClick={handleAdd}
          disabled={adding}
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            border: 'none',
            padding: '10px 20px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            cursor: adding ? 'not-allowed' : 'pointer',
            fontWeight: 600,
            opacity: adding ? 0.6 : 1,
          }}
        >
          {adding ? 'Adding…' : 'Add'}
        </button>
      </div>

      {error && (
        <div
          style={{
            color: 'var(--red)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            marginBottom: 12,
            padding: '8px 12px',
            background: 'rgba(235, 87, 87, 0.08)',
            border: '1px solid rgba(235, 87, 87, 0.3)',
          }}
        >
          {error}
        </div>
      )}

      {symbols.length === 0 ? (
        <div
          style={{
            padding: '60px 22px',
            textAlign: 'center',
            background: 'var(--bg-elev)',
            border: '1px dashed var(--line)',
          }}
        >
          <h3
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 20,
              marginBottom: 8,
            }}
          >
            Your watchlist is empty
          </h3>
          <p style={{ color: 'var(--ink-mute)', fontSize: 13 }}>
            Add a ticker above to begin tracking signals.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            background: 'var(--line)',
            border: '1px solid var(--line)',
          }}
        >
          {symbols.map((sym) => (
            <StockRow
              key={sym}
              symbol={sym}
              data={stockData[sym] ?? null}
              isExpanded={expanded === sym}
              onToggle={() => setExpanded(expanded === sym ? null : sym)}
              onTrade={onTrade}
              onRemove={onRemove}
              heldByFiler={heldSymbols?.has(sym)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
