import { useState, type CSSProperties } from 'react'
import { AppSettings } from '../types'

interface Props {
  settings: AppSettings
  onSave: (patch: Partial<AppSettings>) => Promise<void>
}

const RISK_LABELS: Record<number, { short: string; description: string; color: string }> = {
  1:  { short: 'Most Conservative', description: 'Minimize losses above all else. Evaluator must approve every trade. Smaller positions.', color: '#4ade80' },
  2:  { short: 'Conservative',       description: 'Avoid trades flagged by the evaluator. Reduced position sizes.', color: '#86efac' },
  3:  { short: 'Conservative',       description: 'Evaluator approval required. Cautious sizing.', color: '#bbf7d0' },
  4:  { short: 'Moderate',           description: 'Evaluator is advisory. Slightly below standard sizing.', color: '#fde68a' },
  5:  { short: 'Balanced',           description: 'Standard behavior. Evaluator result is logged but does not block. Default sizing.', color: '#fbbf24' },
  6:  { short: 'Moderate',           description: 'Evaluator is advisory. Slightly larger positions.', color: '#fb923c' },
  7:  { short: 'Aggressive',         description: 'Evaluator skipped. Larger positions to capture upside faster.', color: '#f87171' },
  8:  { short: 'Aggressive',         description: 'Evaluator skipped. Significantly larger positions.', color: '#ef4444' },
  9:  { short: 'Very Aggressive',    description: 'Evaluator skipped. Near-maximum position sizing.', color: '#dc2626' },
  10: { short: 'Most Aggressive',    description: 'Maximize profit at all costs. Evaluator bypassed. Double default position size.', color: '#b91c1c' },
}

export default function SettingsPanel({ settings, onSave }: Props) {
  const [tradeUsd, setTradeUsd] = useState(String(settings.default_trade_usd))
  const [shortRate, setShortRate] = useState(String(Math.round(settings.tax_short_term_rate * 100)))
  const [longRate, setLongRate] = useState(String(Math.round(settings.tax_long_term_rate * 100)))
  const [longDays, setLongDays] = useState(String(settings.tax_long_term_days))
  const [riskLevel, setRiskLevel] = useState(settings.risk_level ?? 5)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await onSave({
        default_trade_usd: parseFloat(tradeUsd),
        tax_short_term_rate: parseFloat(shortRate) / 100,
        tax_long_term_rate: parseFloat(longRate) / 100,
        tax_long_term_days: parseInt(longDays, 10),
        risk_level: riskLevel,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const riskInfo = RISK_LABELS[riskLevel]

  return (
    <div style={panelStyle}>
      {/* ── Risk Dial ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
          <label style={labelStyle}>Risk Level</label>
          <span style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            color: riskInfo.color,
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}>
            {riskLevel} — {riskInfo.short}
          </span>
        </div>

        {/* Slider */}
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={riskLevel}
            onChange={(e) => setRiskLevel(Number(e.target.value))}
            style={{
              width: '100%',
              appearance: 'none',
              height: 3,
              outline: 'none',
              cursor: 'pointer',
              background: `linear-gradient(to right, ${riskInfo.color} 0%, ${riskInfo.color} ${(riskLevel - 1) / 9 * 100}%, var(--line) ${(riskLevel - 1) / 9 * 100}%, var(--line) 100%)`,
              border: 'none',
            }}
          />
        </div>

        {/* Tick labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          color: 'var(--ink-mute)',
          letterSpacing: '0.5px',
          marginBottom: 10,
        }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <span
              key={n}
              style={{
                color: n === riskLevel ? riskInfo.color : 'var(--ink-mute)',
                fontWeight: n === riskLevel ? 700 : 400,
                cursor: 'pointer',
              }}
              onClick={() => setRiskLevel(n)}
            >
              {n}
            </span>
          ))}
        </div>

        {/* End labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          letterSpacing: '1px',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}>
          <span style={{ color: '#4ade80' }}>Conservative</span>
          <span style={{ color: '#fbbf24' }}>Balanced</span>
          <span style={{ color: '#b91c1c' }}>Aggressive</span>
        </div>

        {/* Description */}
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10,
          color: 'var(--ink-soft)',
          lineHeight: 1.6,
          borderLeft: `2px solid ${riskInfo.color}`,
          paddingLeft: 10,
        }}>
          {riskInfo.description}
        </div>

        {/* Size multiplier hint */}
        <div style={{ ...hintStyle, marginTop: 8 }}>
          {riskLevel <= 3
            ? `Position size: ${[50, 65, 80][riskLevel - 1]}% of default trade amount — evaluator must approve`
            : riskLevel >= 7
            ? `Position size: ${[140, 160, 180, 200][riskLevel - 7]}% of default trade amount — evaluator bypassed`
            : riskLevel === 5
            ? 'Position size: 100% of default trade amount (standard)'
            : riskLevel === 4
            ? 'Position size: 90% of default trade amount'
            : 'Position size: 120% of default trade amount'}
        </div>
      </div>

      <div style={{ borderBottom: '1px solid var(--line)', marginBottom: 24 }} />

      {/* ── Trade size + Tax ── */}
      <div style={rowStyle}>
        <div style={groupStyle}>
          <label style={labelStyle}>Auto-trade size</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={prefixStyle}>$</span>
            <input
              type="number"
              min="1"
              step="50"
              value={tradeUsd}
              onChange={(e) => setTradeUsd(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={hintStyle}>used for signal + alert auto-trades; risk level multiplier applied on top</div>
        </div>

        <div style={dividerStyle} />

        <div style={groupStyle}>
          <label style={labelStyle}>Tax rates</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={hintStyle}>Short-term</span>
              <input
                type="number"
                min="1"
                max="99"
                step="1"
                value={shortRate}
                onChange={(e) => setShortRate(e.target.value)}
                style={{ ...inputStyle, width: 54 }}
              />
              <span style={prefixStyle}>%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={hintStyle}>Long-term</span>
              <input
                type="number"
                min="1"
                max="99"
                step="1"
                value={longRate}
                onChange={(e) => setLongRate(e.target.value)}
                style={{ ...inputStyle, width: 54 }}
              />
              <span style={prefixStyle}>%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={hintStyle}>LT threshold</span>
              <input
                type="number"
                min="1"
                step="1"
                value={longDays}
                onChange={(e) => setLongDays(e.target.value)}
                style={{ ...inputStyle, width: 64 }}
              />
              <span style={prefixStyle}>days</span>
            </div>
          </div>
          <div style={hintStyle}>used in trade evaluator — hold / caution / proceed recommendations</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 20, gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={saveButtonStyle}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && <span style={{ color: 'var(--green)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>Saved</span>}
          {error && <span style={{ color: 'var(--red)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{error}</span>}
        </div>
      </div>
    </div>
  )
}

const panelStyle: CSSProperties = {
  background: 'var(--bg-elev)',
  border: '1px solid var(--line)',
  padding: '18px 24px',
  marginBottom: 28,
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 28,
  flexWrap: 'wrap',
}

const groupStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
}

const labelStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: 'var(--ink-mute)',
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
}

const hintStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: 'var(--ink-mute)',
}

const prefixStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12,
  color: 'var(--ink-soft)',
}

const inputStyle: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--line)',
  color: 'var(--ink)',
  padding: '7px 10px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 12,
  outline: 'none',
  width: 90,
}

const dividerStyle: CSSProperties = {
  width: 1,
  background: 'var(--line)',
  alignSelf: 'stretch',
  margin: '0 4px',
}

const saveButtonStyle: CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: '1px solid var(--accent)',
  padding: '8px 18px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: '1.4px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontWeight: 600,
}
