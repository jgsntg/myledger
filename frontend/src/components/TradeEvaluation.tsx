import { EvaluationResult } from '../types'

interface Props {
  evaluation: EvaluationResult | null
  loading: boolean
}

const COLORS = {
  proceed: { border: 'var(--green)', bg: 'rgba(111,207,151,0.07)', text: 'var(--green)', label: 'PROCEED' },
  caution: { border: 'var(--amber)', bg: 'rgba(242,201,76,0.07)', text: 'var(--amber)', label: 'CAUTION' },
  hold:    { border: 'var(--red)',   bg: 'rgba(235,87,87,0.07)',   text: 'var(--red)',   label: 'HOLD' },
} as const

const mono: React.CSSProperties = { fontFamily: 'JetBrains Mono, monospace' }

export default function TradeEvaluation({ evaluation, loading }: Props) {
  if (loading) {
    return (
      <div
        style={{
          ...mono,
          fontSize: 11,
          color: 'var(--ink-mute)',
          padding: '12px 14px',
          border: '1px solid var(--line)',
          marginBottom: 16,
        }}
      >
        Evaluating trade…
      </div>
    )
  }

  if (!evaluation) return null

  const c = COLORS[evaluation.recommendation] ?? COLORS.proceed

  return (
    <div
      style={{
        border: `1px solid ${c.border}`,
        background: c.bg,
        padding: '12px 14px',
        marginBottom: 16,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span
          style={{
            ...mono,
            fontSize: 10,
            letterSpacing: 1.5,
            fontWeight: 700,
            color: c.text,
          }}
        >
          {c.label}
        </span>
        {evaluation.holding_days !== null && (
          <span style={{ ...mono, fontSize: 10, color: 'var(--ink-mute)' }}>
            {evaluation.is_long_term ? 'Long-term' : 'Short-term'} · {evaluation.holding_days}d held
            {evaluation.days_to_long_term != null && ` · ${evaluation.days_to_long_term}d to LT`}
          </span>
        )}
      </div>

      {/* Reasons */}
      <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
        {evaluation.reasons.map((r, i) => (
          <li
            key={i}
            style={{
              ...mono,
              fontSize: 11,
              color: 'var(--ink-soft)',
              lineHeight: 1.6,
              listStyle: 'disc',
            }}
          >
            {r}
          </li>
        ))}
      </ul>

      {/* Tax summary line */}
      {evaluation.estimated_gain_usd !== null && (
        <div
          style={{
            ...mono,
            fontSize: 10,
            color: 'var(--ink-mute)',
            marginTop: 8,
            paddingTop: 8,
            borderTop: '1px solid var(--line)',
            display: 'flex',
            gap: 16,
          }}
        >
          <span>
            Est. gain:{' '}
            <span style={{ color: (evaluation.estimated_gain_usd ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {(evaluation.estimated_gain_usd ?? 0) >= 0 ? '+' : ''}
              ${Math.abs(evaluation.estimated_gain_usd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
          {evaluation.estimated_tax_usd !== null && (
            <span>
              Est. tax: <span style={{ color: 'var(--amber)' }}>${evaluation.estimated_tax_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              {evaluation.tax_rate_used !== null && ` @ ${Math.round(evaluation.tax_rate_used * 100)}%`}
            </span>
          )}
          {evaluation.wash_sale_risk && (
            <span style={{ color: 'var(--amber)' }}>⚠ Wash-sale risk</span>
          )}
        </div>
      )}
    </div>
  )
}
