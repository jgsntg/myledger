import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { api } from '../api/client'
import { fmtMoney } from '../lib/format'
import {
  FilerHolding,
  FilerTransaction,
  SnapshotData,
  TrackedFiler,
} from '../types'

interface Props {
  onMirror: (symbol: string, side: 'buy' | 'sell', qty: string, sourceNote: string) => void
  onHeldSymbolsChange: (symbols: Set<string>) => void
}

type FilerType = 'congress' | 'institution'

function txSide(transactionType: string): 'buy' | 'sell' {
  return transactionType.toLowerCase().includes('sale') ? 'sell' : 'buy'
}

function midpoint(low: number | null, high: number | null): number | null {
  if (low == null && high == null) return null
  if (low != null && high != null) return (low + high) / 2
  if (low != null) return low * 2
  return high
}

function fmtDate(value: string | null): string {
  if (!value) return '—'
  const dateOnly = value.slice(0, 10)
  const [year, month, day] = dateOnly.split('-').map(Number)
  const d =
    year && month && day
      ? new Date(year, month - 1, day)
      : new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function titleFromSourceId(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function sourceNote(
  filer: TrackedFiler,
  tx: FilerTransaction,
  qty: string,
  price: number | null,
): string {
  const amount = midpoint(tx.amount_low, tx.amount_high)
  const pieces = [`Mirroring ${filer.name}`, tx.transaction_type, fmtDate(tx.trade_date)]
  if (amount != null && price != null) {
    pieces.push(`est. ${qty} shares (${fmtMoney(amount)} / ${fmtMoney(price)})`)
  } else {
    pieces.push(`est. ${qty} share${qty === '1' ? '' : 's'}`)
  }
  return pieces.join(' · ')
}

export default function TrackedFilersSection({ onMirror, onHeldSymbolsChange }: Props) {
  const [filers, setFilers] = useState<TrackedFiler[]>([])
  const [transactions, setTransactions] = useState<Record<number, FilerTransaction[]>>({})
  const [holdings, setHoldings] = useState<Record<number, FilerHolding[]>>({})
  const [expanded, setExpanded] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [filerType, setFilerType] = useState<FilerType>('congress')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [mirroringId, setMirroringId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const emitHeldSymbols = useCallback(
    (nextHoldings: Record<number, FilerHolding[]>) => {
      const symbols = new Set<string>()
      Object.values(nextHoldings).forEach((items) => {
        items.forEach((holding) => symbols.add(holding.symbol))
      })
      onHeldSymbolsChange(symbols)
    },
    [onHeldSymbolsChange],
  )

  const loadFilerDetails = useCallback(
    async (filer: TrackedFiler, nextHoldings?: Record<number, FilerHolding[]>) => {
      const [txRows, holdingRows] = await Promise.all([
        api.getFilerTransactions(filer.id),
        api.getFilerHoldings(filer.id),
      ])
      setTransactions((prev) => ({ ...prev, [filer.id]: txRows }))
      setHoldings((prev) => {
        const merged = { ...(nextHoldings ?? prev), [filer.id]: holdingRows }
        emitHeldSymbols(merged)
        return merged
      })
    },
    [emitHeldSymbols],
  )

  const loadFilers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await api.getFilers()
      setFilers(rows)
      const nextHoldings: Record<number, FilerHolding[]> = {}
      await Promise.all(
        rows.map(async (filer) => {
          const holdingRows = await api.getFilerHoldings(filer.id)
          nextHoldings[filer.id] = holdingRows
        }),
      )
      setHoldings(nextHoldings)
      emitHeldSymbols(nextHoldings)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [emitHeldSymbols])

  useEffect(() => {
    loadFilers()
  }, [loadFilers])

  async function handleAdd() {
    const nameInput = name.trim()
    const sourceInput = sourceId.trim().toLowerCase()
    const nameLooksLikeSource =
      !sourceInput &&
      (filerType === 'institution' ? /^\d+$/.test(nameInput) : nameInput.includes('-'))
    const cleanSource = nameLooksLikeSource ? nameInput.toLowerCase() : sourceInput
    const cleanName = nameLooksLikeSource ? titleFromSourceId(cleanSource) : nameInput || titleFromSourceId(cleanSource)
    if (!cleanSource) {
      setError('Enter a Quiver slug or institutional CIK.')
      return
    }

    setAdding(true)
    setError(null)
    setMessage(null)
    try {
      const filer = await api.createFiler({
        name: cleanName,
        filer_type: filerType,
        source_id: cleanSource,
      })
      setFilers((prev) => [filer, ...prev])
      setName('')
      setSourceId('')
      setMessage(`${filer.name} is now tracked.`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  async function handleRefresh(filer: TrackedFiler) {
    setBusyId(filer.id)
    setError(null)
    setMessage(null)
    try {
      const result = await api.refreshFiler(filer.id)
      await loadFilerDetails(filer)
      const count =
        filer.filer_type === 'congress'
          ? result.transactions_inserted
          : result.holdings_inserted
      setMessage(`${filer.name} refreshed. ${count} new item${count === 1 ? '' : 's'}.`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(filer: TrackedFiler) {
    setBusyId(filer.id)
    setError(null)
    try {
      await api.deleteFiler(filer.id)
      setFilers((prev) => prev.filter((item) => item.id !== filer.id))
      setTransactions((prev) => {
        const next = { ...prev }
        delete next[filer.id]
        return next
      })
      setHoldings((prev) => {
        const next = { ...prev }
        delete next[filer.id]
        emitHeldSymbols(next)
        return next
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleToggle(filer: TrackedFiler) {
    const nextExpanded = expanded === filer.id ? null : filer.id
    setExpanded(nextExpanded)
    if (nextExpanded && !transactions[filer.id]) {
      setBusyId(filer.id)
      try {
        await loadFilerDetails(filer)
      } catch (e) {
        setError((e as Error).message)
      } finally {
        setBusyId(null)
      }
    }
  }

  async function handleMirror(filer: TrackedFiler, tx: FilerTransaction) {
    setMirroringId(tx.id)
    setError(null)
    try {
      const snapshots = (await api.getSnapshots([tx.symbol])) as Record<string, SnapshotData>
      const snap = snapshots[tx.symbol]
      const price = snap?.latestTrade?.p ?? snap?.minuteBar?.c ?? snap?.dailyBar?.c ?? null
      const amount = midpoint(tx.amount_low, tx.amount_high)
      const qty = amount && price ? Math.max(1, Math.floor(amount / price)).toString() : '1'
      onMirror(tx.symbol, txSide(tx.transaction_type), qty, sourceNote(filer, tx, qty, price))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setMirroringId(null)
    }
  }

  return (
    <section style={{ marginTop: 34 }}>
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
          Tracked Filers
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
          Manual mirror only
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 180px 1fr 120px',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          style={inputStyle}
        />
        <select
          value={filerType}
          onChange={(e) => setFilerType(e.target.value as FilerType)}
          style={inputStyle}
        >
          <option value="congress">Congress</option>
          <option value="institution">13F</option>
        </select>
        <input
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          placeholder={filerType === 'congress' ? 'nancy-pelosi' : 'CIK'}
          style={inputStyle}
        />
        <button onClick={handleAdd} disabled={adding} style={primaryButtonStyle}>
          {adding ? 'Adding…' : 'Track'}
        </button>
      </div>

      {(error || message) && (
        <div
          style={{
            color: error ? 'var(--red)' : 'var(--green)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            marginBottom: 12,
            padding: '8px 12px',
            background: error ? 'rgba(235, 87, 87, 0.08)' : 'rgba(111, 207, 151, 0.08)',
            border: error ? '1px solid rgba(235, 87, 87, 0.3)' : '1px solid rgba(111, 207, 151, 0.3)',
          }}
        >
          {error ?? message}
        </div>
      )}

      {loading ? (
        <div className="skeleton" style={{ height: 78, width: '100%' }} />
      ) : filers.length === 0 ? (
        <div
          style={{
            padding: '34px 22px',
            textAlign: 'center',
            background: 'var(--bg-elev)',
            border: '1px dashed var(--line)',
            color: 'var(--ink-mute)',
            fontSize: 13,
          }}
        >
          Track a congressional slug or institutional CIK to review disclosed activity here.
        </div>
      ) : (
        <div style={{ background: 'var(--line)', border: '1px solid var(--line)' }}>
          {filers.map((filer) => {
            const isOpen = expanded === filer.id
            const txRows = transactions[filer.id] ?? []
            const holdingRows = holdings[filer.id] ?? []
            return (
              <div key={filer.id} style={{ background: 'var(--bg-elev)', marginBottom: 1 }}>
                <div
                  onClick={() => handleToggle(filer)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 120px 1fr 96px 88px',
                    gap: 14,
                    alignItems: 'center',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    background: isOpen ? 'var(--bg-card)' : 'var(--bg-elev)',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18 }}>
                      {filer.name}
                    </div>
                    <div style={mutedMonoStyle}>{filer.source_id}</div>
                  </div>
                  <div style={pillStyle}>{filer.filer_type === 'congress' ? 'Congress' : '13F'}</div>
                  <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
                    {filer.filer_type === 'congress'
                      ? `${txRows.length} transactions`
                      : `${holdingRows.length} holdings`}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRefresh(filer)
                    }}
                    disabled={busyId === filer.id}
                    style={secondaryButtonStyle}
                  >
                    {busyId === filer.id ? 'Sync…' : 'Sync'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(filer)
                    }}
                    disabled={busyId === filer.id}
                    style={ghostButtonStyle}
                  >
                    Remove
                  </button>
                </div>

                {isOpen && (
                  <div style={{ padding: '0 20px 18px' }}>
                    {filer.filer_type === 'congress' ? (
                      txRows.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {txRows.slice(0, 12).map((tx) => (
                            <div key={tx.id} style={detailRowStyle}>
                              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                                {tx.symbol}
                              </div>
                              <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
                                {tx.transaction_type}
                              </div>
                              <div style={{ color: 'var(--ink-mute)', fontSize: 12 }}>
                                {fmtDate(tx.trade_date)}
                              </div>
                              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                                {tx.amount_low != null ? fmtMoney(tx.amount_low) : '—'}
                                {tx.amount_high != null && tx.amount_high !== tx.amount_low
                                  ? ` - ${fmtMoney(tx.amount_high)}`
                                  : ''}
                              </div>
                              <button
                                onClick={() => handleMirror(filer, tx)}
                                disabled={mirroringId === tx.id}
                                style={primaryButtonStyle}
                              >
                                {mirroringId === tx.id ? 'Quote…' : 'Mirror'}
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={emptyStyle}>No transactions yet. Sync this filer to fetch disclosures.</div>
                      )
                    ) : holdingRows.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {holdingRows.slice(0, 16).map((holding) => (
                          <div key={holding.id} style={detailRowStyle}>
                            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>
                              {holding.symbol}
                            </div>
                            <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
                              {holding.shares != null ? holding.shares.toLocaleString() : '—'} shares
                            </div>
                            <div style={{ color: 'var(--ink-soft)', fontSize: 13 }}>
                              {fmtMoney(holding.value_usd)}
                            </div>
                            <div style={{ color: 'var(--ink-mute)', fontSize: 12 }}>
                              {fmtDate(holding.report_date)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={emptyStyle}>
                        13F lookup is scaffolded; holdings will appear after EDGAR XML parsing is added.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

const inputStyle: CSSProperties = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--line)',
  color: 'var(--ink)',
  padding: '10px 12px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12,
  outline: 'none',
}

const primaryButtonStyle: CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: '1px solid var(--accent)',
  padding: '9px 14px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontWeight: 600,
}

const secondaryButtonStyle: CSSProperties = {
  background: 'transparent',
  color: 'var(--accent)',
  border: '1px solid var(--accent)',
  padding: '8px 12px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontWeight: 600,
}

const ghostButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--ink-mute)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
}

const mutedMonoStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: 'var(--ink-mute)',
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  marginTop: 4,
}

const pillStyle: CSSProperties = {
  width: 'fit-content',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: 'var(--ink-soft)',
  border: '1px solid var(--line)',
  padding: '4px 8px',
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
}

const detailRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px 1.2fr 140px 1fr 94px',
  gap: 12,
  alignItems: 'center',
  padding: '12px 14px',
  background: 'var(--bg)',
  border: '1px solid var(--line-soft)',
}

const emptyStyle: CSSProperties = {
  padding: '22px 14px',
  color: 'var(--ink-mute)',
  fontSize: 13,
  background: 'var(--bg)',
  border: '1px dashed var(--line)',
}
