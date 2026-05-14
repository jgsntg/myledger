import { useState, type CSSProperties } from 'react'
import { AppSettings } from '../types'

interface Props {
  settings: AppSettings
  onSave: (patch: Partial<AppSettings>) => Promise<void>
}

export default function SettingsPanel({ settings, onSave }: Props) {
  const [tradeUsd, setTradeUsd] = useState(String(settings.default_trade_usd))
  const [shortRate, setShortRate] = useState(String(Math.round(settings.tax_short_term_rate * 100)))
  const [longRate, setLongRate] = useState(String(Math.round(settings.tax_long_term_rate * 100)))
  const [longDays, setLongDays] = useState(String(settings.tax_long_term_days))
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
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={panelStyle}>
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
          <div style={hintStyle}>used for signal + alert auto-trades; filer trades use reported amount</div>
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
