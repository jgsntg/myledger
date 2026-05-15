import { useState, type CSSProperties } from 'react'
import { api } from '../api/client'
import { Position } from '../types'

interface Props {
  positions: Position[]
  sectorMap: Record<string, string>
}

interface CardState {
  narrative: string | null
  loading: boolean
  error: string | null
  generatedAt: string | null
}

const blank: CardState = { narrative: null, loading: false, error: null, generatedAt: null }

function NarrativeCard({
  title,
  hint,
  state,
  onGenerate,
}: {
  title: string
  hint: string
  state: CardState
  onGenerate: () => void
}) {
  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <div>
          <div style={cardTitleStyle}>{title}</div>
          <div style={hintStyle}>{hint}</div>
        </div>
        <button
          onClick={onGenerate}
          disabled={state.loading}
          style={state.loading ? { ...generateBtnStyle, opacity: 0.5, cursor: 'default' } : generateBtnStyle}
        >
          {state.loading ? 'Generating…' : state.narrative ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {state.error && (
        <div style={errorStyle}>{state.error}</div>
      )}

      {state.narrative && (
        <>
          <div style={narrativeStyle}>{state.narrative}</div>
          <div style={timestampStyle}>Generated {state.generatedAt}</div>
        </>
      )}

      {!state.narrative && !state.loading && !state.error && (
        <div style={placeholderStyle}>
          Click Generate to produce a narrative based on your current positions.
        </div>
      )}

      {state.loading && (
        <div style={placeholderStyle}>Asking Claude…</div>
      )}
    </div>
  )
}

export default function AiNarratives({ positions, sectorMap }: Props) {
  const [briefing, setBriefing] = useState<CardState>(blank)
  const [risk, setRisk] = useState<CardState>(blank)

  function positionPayload() {
    return positions.map((p) => ({
      symbol: p.symbol,
      qty: p.qty,
      market_value: p.market_value,
      unrealized_pl: p.unrealized_pl,
      unrealized_plpc: p.unrealized_plpc,
    }))
  }

  async function handleBriefing() {
    setBriefing((s) => ({ ...s, loading: true, error: null }))
    try {
      const { narrative } = await api.generateBriefing(positionPayload())
      setBriefing({ narrative, loading: false, error: null, generatedAt: new Date().toLocaleTimeString() })
    } catch (e) {
      setBriefing((s) => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }

  async function handleRisk() {
    setRisk((s) => ({ ...s, loading: true, error: null }))
    try {
      const { narrative } = await api.generateRiskNarrative(positionPayload(), sectorMap)
      setRisk({ narrative, loading: false, error: null, generatedAt: new Date().toLocaleTimeString() })
    } catch (e) {
      setRisk((s) => ({ ...s, loading: false, error: (e as Error).message }))
    }
  }

  if (positions.length === 0) return null

  return (
    <section style={{ marginTop: 8 }}>
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
        <h2 style={sectionTitleStyle}>AI Narratives</h2>
        <span style={hintStyle}>on-demand · powered by Claude</span>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <NarrativeCard
          title="Portfolio Briefing"
          hint="P&L summary · notable movers · concentration"
          state={briefing}
          onGenerate={handleBriefing}
        />
        <NarrativeCard
          title="Risk Analysis"
          hint="sector concentration · balance · skew"
          state={risk}
          onGenerate={handleRisk}
        />
      </div>
    </section>
  )
}

const cardStyle: CSSProperties = {
  flex: '1 1 340px',
  background: 'var(--bg-elev)',
  border: '1px solid var(--line)',
  padding: '18px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

const cardHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
}

const cardTitleStyle: CSSProperties = {
  fontFamily: 'Fraunces, Georgia, serif',
  fontWeight: 400,
  fontSize: 16,
  letterSpacing: '-0.2px',
  marginBottom: 4,
}

const sectionTitleStyle: CSSProperties = {
  fontFamily: 'Fraunces, Georgia, serif',
  fontWeight: 400,
  fontSize: 22,
  letterSpacing: '-0.3px',
}

const hintStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: 'var(--ink-mute)',
  letterSpacing: '0.8px',
}

const narrativeStyle: CSSProperties = {
  fontFamily: 'Fraunces, Georgia, serif',
  fontSize: 15,
  lineHeight: 1.65,
  color: 'var(--ink)',
}

const placeholderStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  color: 'var(--ink-mute)',
  fontStyle: 'italic',
  padding: '10px 0',
}

const timestampStyle: CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: 'var(--ink-mute)',
  letterSpacing: '0.6px',
}

const errorStyle: CSSProperties = {
  color: 'var(--red)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  padding: '8px 12px',
  background: 'rgba(235, 87, 87, 0.08)',
  border: '1px solid rgba(235, 87, 87, 0.3)',
}

const generateBtnStyle: CSSProperties = {
  background: 'var(--accent)',
  color: 'var(--bg)',
  border: '1px solid var(--accent)',
  padding: '7px 14px',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  letterSpacing: '1.2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontWeight: 600,
  flexShrink: 0,
}
