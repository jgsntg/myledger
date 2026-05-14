import { AccountData, Position } from '../types'
import { fmtMoney, fmtPct, deltaClass } from '../lib/format'

interface Props {
  account: AccountData | null
  positions: Position[]
}

function SummaryCell({
  label,
  value,
  delta,
  deltaColorClass,
}: {
  label: string
  value: string
  delta: string
  deltaColorClass?: string
}) {
  return (
    <div
      style={{
        background: 'var(--bg-elev)',
        padding: '22px 26px',
      }}
    >
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'var(--ink-mute)',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: 30,
          fontWeight: 400,
          letterSpacing: '-0.5px',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 12,
          marginTop: 4,
          color:
            deltaColorClass === 'pos'
              ? 'var(--green)'
              : deltaColorClass === 'neg'
                ? 'var(--red)'
                : 'var(--ink-soft)',
        }}
      >
        {delta}
      </div>
    </div>
  )
}

export default function PortfolioStrip({ account, positions }: Props) {
  const eq = account ? parseFloat(account.equity) : null
  const lastEq = account ? parseFloat(account.last_equity) : null
  const bp = account ? parseFloat(account.buying_power) : null

  const pl = eq !== null && lastEq !== null ? eq - lastEq : null
  const plPct = lastEq && pl !== null ? (pl / lastEq) * 100 : null

  const plLabel =
    pl !== null
      ? (pl >= 0 ? '+' : '') + fmtMoney(Math.abs(pl)).replace('$', pl < 0 ? '-$' : '+$')
      : '—'

  return (
    <section aria-label="Portfolio summary" style={{ marginBottom: 36 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--line)',
          border: '1px solid var(--line)',
        }}
      >
        <SummaryCell
          label="Total Equity"
          value={eq !== null ? fmtMoney(eq) : '$—'}
          delta={plPct !== null ? fmtPct(plPct) : 'Connect to view P&L'}
          deltaColorClass={pl !== null ? deltaClass(pl) : undefined}
        />
        <SummaryCell
          label="Buying Power"
          value={bp !== null ? fmtMoney(bp) : '$—'}
          delta="Cash available"
        />
        <SummaryCell
          label="Day's P&L"
          value={pl !== null ? plLabel : '$—'}
          delta={plPct !== null ? fmtPct(plPct) : '—'}
          deltaColorClass={pl !== null ? deltaClass(pl) : undefined}
        />
        <SummaryCell
          label="Open Positions"
          value={String(positions.length)}
          delta="Active holdings"
        />
      </div>
    </section>
  )
}
