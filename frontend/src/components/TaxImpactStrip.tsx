import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { fmtMoney } from '../lib/format'
import { AccountData, AppSettings, Position, RealizedPnl } from '../types'

// Tax situation: MFJ ~$600K, FL (no state tax), 2 kids (credit phased out above $400K)
// NIIT (3.8%) applies — MAGI well above the $250K MFJ threshold
// Short-term: 35% marginal federal + 3.8% NIIT = 38.8%
// Long-term:  20% LTCG rate    + 3.8% NIIT = 23.8%
// Recommended rates to enter in Settings: ST 38.8% / LT 23.8%

const RECOMMENDED_ST = 0.388
const RECOMMENDED_LT = 0.238
const NIIT_RATE = 0.038
const RATE_TOLERANCE = 0.005 // within 0.5% is close enough

interface Props {
  account: AccountData | null
  positions: Position[]
  settings: AppSettings
}

function afterTax(gross: number, rate: number): number {
  return gross * (1 - rate)
}

function signed(n: number): string {
  const s = fmtMoney(Math.abs(n))
  return (n >= 0 ? '+' : '-') + s
}

function deltaColor(n: number) {
  return n > 0 ? 'var(--green)' : n < 0 ? 'var(--red)' : 'var(--ink-soft)'
}

export default function TaxImpactStrip({ account, positions, settings }: Props) {
  const stRate = settings.tax_short_term_rate
  const ltRate = settings.tax_long_term_rate
  const ltDays = settings.tax_long_term_days ?? 365

  const [realized, setRealized] = useState<RealizedPnl | null>(null)
  const [realizedLoading, setRealizedLoading] = useState(true)

  useEffect(() => {
    api.getRealizedPnl(ltDays)
      .then(setRealized)
      .catch(() => setRealized(null))
      .finally(() => setRealizedLoading(false))
  }, [ltDays])

  const totalUnrealized = positions.reduce(
    (sum, p) => sum + parseFloat(p.unrealized_pl || '0'),
    0,
  )

  const eq = account ? parseFloat(account.equity) : null
  const lastEq = account ? parseFloat(account.last_equity) : null
  const dayPL = eq !== null && lastEq !== null ? eq - lastEq : null

  const unrealizedST = afterTax(totalUnrealized, stRate)
  const unrealizedLT = afterTax(totalUnrealized, ltRate)
  const ltBenefit = unrealizedLT - unrealizedST

  const dayAfterTax = dayPL !== null ? afterTax(dayPL, stRate) : null
  const dayTaxDrag = dayPL !== null ? dayPL - (dayAfterTax ?? 0) : null

  // Blended after-tax for realized: ST portion at ST rate, LT portion at LT rate
  const realizedAfterTax = realized
    ? afterTax(realized.short_term, stRate) + afterTax(realized.long_term, ltRate)
    : null
  const realizedTaxDrag = realized && realizedAfterTax !== null
    ? realized.total_realized - realizedAfterTax
    : null

  const stOff = Math.abs(stRate - RECOMMENDED_ST) > RATE_TOLERANCE
  const ltOff = Math.abs(ltRate - RECOMMENDED_LT) > RATE_TOLERANCE
  const ratesNeedUpdate = stOff || ltOff

  return (
    <section aria-label="Tax impact" style={{ marginBottom: 36 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <h2
          style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontWeight: 400,
            fontSize: 18,
            letterSpacing: '-0.2px',
          }}
        >
          Tax Exposure
        </h2>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 9,
            letterSpacing: '1px',
            textTransform: 'uppercase',
            color: 'var(--ink-mute)',
          }}
        >
          <span>FL · No state tax</span>
          <span style={{ color: 'var(--line)' }}>·</span>
          <span>NIIT 3.8% included</span>
          <span style={{ color: 'var(--line)' }}>·</span>
          <span>MFJ</span>
        </div>
      </div>

      {/* Rate mismatch notice */}
      {ratesNeedUpdate && (
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--amber)',
            border: '1px solid var(--amber)',
            padding: '7px 12px',
            marginBottom: 12,
            lineHeight: 1.6,
          }}
        >
          Your configured rates ({Math.round(stRate * 1000) / 10}% ST / {Math.round(ltRate * 1000) / 10}% LT) don't reflect your full tax picture.
          {' '}Recommended for your situation: <strong>38.8% short-term</strong> (35% bracket + 3.8% NIIT) and{' '}
          <strong>23.8% long-term</strong> (20% LTCG + 3.8% NIIT). Update in Settings.
        </div>
      )}

      {/* Main grid — 3 columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
          gap: 0,
          background: 'var(--line)',
          border: '1px solid var(--line)',
        }}
      >
        {/* Unrealized block */}
        <div style={{ background: 'var(--bg-elev)', padding: '18px 22px' }}>
          <div style={labelStyle}>Unrealized P&amp;L</div>
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: '-0.5px',
              color: deltaColor(totalUnrealized),
              marginBottom: 12,
            }}
          >
            {signed(totalUnrealized)}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <TaxRow
              label={`If sold today · ${(stRate * 100).toFixed(1)}% ST`}
              value={unrealizedST}
              gross={totalUnrealized}
            />
            <TaxRow
              label={`If held 1yr+ · ${(ltRate * 100).toFixed(1)}% LT`}
              value={unrealizedLT}
              gross={totalUnrealized}
            />
            {totalUnrealized > 0 && (
              <div
                style={{
                  marginTop: 4,
                  paddingTop: 8,
                  borderTop: '1px solid var(--line-soft)',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: 'var(--green)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Benefit of waiting for LT</span>
                <span>+{fmtMoney(ltBenefit)}</span>
              </div>
            )}
          </div>

          <div style={{ ...noteStyle, marginTop: 12 }}>
            Positions may be short- or long-term — both scenarios shown.
          </div>
        </div>

        {/* Divider */}
        <div style={{ background: 'var(--line)' }} />

        {/* Today's P&L block */}
        <div style={{ background: 'var(--bg-elev)', padding: '18px 22px' }}>
          <div style={labelStyle}>Today's P&amp;L</div>
          <div
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: '-0.5px',
              color: dayPL !== null ? deltaColor(dayPL) : 'var(--ink-mute)',
              marginBottom: 12,
            }}
          >
            {dayPL !== null ? signed(dayPL) : '—'}
          </div>

          {dayPL !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <TaxRow
                label={`After ${(stRate * 100).toFixed(1)}% short-term tax`}
                value={dayAfterTax!}
                gross={dayPL}
              />
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  color: 'var(--ink-mute)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Tax drag</span>
                <span style={{ color: dayPL >= 0 ? 'var(--red)' : 'var(--green)' }}>
                  {dayPL >= 0 ? '-' : '+'}{fmtMoney(Math.abs(dayTaxDrag!))}
                </span>
              </div>
            </div>
          )}

          <div style={{ ...noteStyle, marginTop: 12 }}>
            Today's movement is short-term by definition.
          </div>

          {/* NIIT breakdown */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: '1px solid var(--line-soft)',
            }}
          >
            <div style={labelStyle}>NIIT Exposure (3.8%)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {totalUnrealized !== 0 && (
                <div style={niitRowStyle}>
                  <span>On unrealized gains</span>
                  <span style={{ color: totalUnrealized > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {totalUnrealized > 0 ? '-' : '+'}{fmtMoney(Math.abs(totalUnrealized * NIIT_RATE))}
                  </span>
                </div>
              )}
              {dayPL !== null && dayPL !== 0 && (
                <div style={niitRowStyle}>
                  <span>On today's P&amp;L</span>
                  <span style={{ color: dayPL > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {dayPL > 0 ? '-' : '+'}{fmtMoney(Math.abs(dayPL * NIIT_RATE))}
                  </span>
                </div>
              )}
              {realized && realized.total_realized !== 0 && (
                <div style={niitRowStyle}>
                  <span>On realized gains</span>
                  <span style={{ color: realized.total_realized > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {realized.total_realized > 0 ? '-' : '+'}{fmtMoney(Math.abs(realized.total_realized * NIIT_RATE))}
                  </span>
                </div>
              )}
            </div>
            <div style={{ ...noteStyle, marginTop: 6 }}>
              MAGI well above $250K MFJ threshold — NIIT applies to all investment income.
              Already included in the rates above.
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ background: 'var(--line)' }} />

        {/* Realized P&L block */}
        <div style={{ background: 'var(--bg-elev)', padding: '18px 22px' }}>
          <div style={labelStyle}>Realized P&amp;L</div>

          {realizedLoading ? (
            <div style={{ color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginTop: 8 }}>
              Loading…
            </div>
          ) : realized === null ? (
            <div style={{ color: 'var(--ink-mute)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, marginTop: 8 }}>
              Unavailable
            </div>
          ) : (
            <>
              <div
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: 28,
                  fontWeight: 400,
                  letterSpacing: '-0.5px',
                  color: deltaColor(realized.total_realized),
                  marginBottom: 12,
                }}
              >
                {realized.total_realized === 0 ? '—' : signed(realized.total_realized)}
              </div>

              {realized.total_realized !== 0 && realizedAfterTax !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <TaxRow
                    label="After blended tax"
                    value={realizedAfterTax}
                    gross={realized.total_realized}
                  />
                  {realized.short_term !== 0 && (
                    <div style={niitRowStyle}>
                      <span>Short-term portion</span>
                      <span style={{ color: deltaColor(realized.short_term) }}>
                        {signed(realized.short_term)}
                      </span>
                    </div>
                  )}
                  {realized.long_term !== 0 && (
                    <div style={niitRowStyle}>
                      <span>Long-term portion</span>
                      <span style={{ color: deltaColor(realized.long_term) }}>
                        {signed(realized.long_term)}
                      </span>
                    </div>
                  )}
                  {realizedTaxDrag !== null && realizedTaxDrag !== 0 && (
                    <div
                      style={{
                        marginTop: 4,
                        paddingTop: 8,
                        borderTop: '1px solid var(--line-soft)',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        color: 'var(--ink-mute)',
                      }}
                    >
                      <span>Tax owed</span>
                      <span style={{ color: realized.total_realized > 0 ? 'var(--red)' : 'var(--green)' }}>
                        {realized.total_realized > 0 ? '-' : '+'}{fmtMoney(Math.abs(realizedTaxDrag))}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Per-symbol breakdown */}
              {realized.by_symbol.length > 0 && (
                <div
                  style={{
                    marginTop: 14,
                    paddingTop: 10,
                    borderTop: '1px solid var(--line-soft)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={labelStyle}>By Symbol</div>
                  {realized.by_symbol.slice(0, 6).map(s => (
                    <div key={s.symbol} style={niitRowStyle}>
                      <span style={{ color: 'var(--ink-soft)' }}>{s.symbol}</span>
                      <span style={{ color: deltaColor(s.realized_pl) }}>
                        {signed(s.realized_pl)}
                        {s.long_term !== 0 && (
                          <span style={{ color: 'var(--ink-mute)', fontSize: 9 }}> LT</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {realized.by_symbol.length > 6 && (
                    <div style={{ ...noteStyle, marginTop: 2 }}>
                      +{realized.by_symbol.length - 6} more symbols
                    </div>
                  )}
                </div>
              )}

              <div style={{ ...noteStyle, marginTop: 12 }}>
                FIFO matching · {realized.fills_analyzed} fills analyzed
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function TaxRow({
  label,
  value,
  gross,
}: {
  label: string
  value: number
  gross: number
}) {
  const saved = value - gross
  return (
    <div
      style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      <span style={{ color: 'var(--ink-mute)', flexShrink: 0 }}>{label}</span>
      <span
        style={{
          color: value > 0 ? 'var(--green)' : value < 0 ? 'var(--red)' : 'var(--ink-soft)',
          whiteSpace: 'nowrap',
        }}
      >
        {signed(value)}{' '}
        <span style={{ color: saved < 0 ? 'var(--red)' : saved > 0 ? 'var(--green)' : 'var(--ink-mute)', fontSize: 9 }}>
          ({saved >= 0 ? '+' : ''}{fmtMoney(Math.abs(saved))} tax {saved >= 0 ? 'save' : 'owed'})
        </span>
      </span>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: 'var(--ink-mute)',
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  marginBottom: 6,
}

const noteStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 9,
  color: 'var(--ink-mute)',
  lineHeight: 1.5,
  fontStyle: 'italic',
}

const niitRowStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  display: 'flex',
  justifyContent: 'space-between',
  color: 'var(--ink-soft)',
}
