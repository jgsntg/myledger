import { useEffect, useState } from 'react'
import { ClockData } from '../types'

interface Props {
  isConnected: boolean
  clock: ClockData | null
  onOpenSettings: () => void
  tradingMode: 'auto' | 'manual'
  alpacaEnv: string
  onToggleTradingMode: () => void
}

export default function Header({ isConnected, clock, onOpenSettings, tradingMode, alpacaEnv, onToggleTradingMode }: Props) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const marketStatus = clock
    ? clock.is_open
      ? 'Open'
      : 'Closed'
    : '—'

  return (
    <div
      style={{
        padding: '18px 32px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        maxWidth: 1600,
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display, Fraunces, Georgia, serif)',
            fontWeight: 400,
            fontSize: 28,
            letterSpacing: '-0.5px',
            fontStyle: 'italic',
          }}
        >
          <span style={{ color: 'var(--accent)' }}>L</span>edger
        </h1>
        <span
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            color: 'var(--ink-mute)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            borderLeft: '1px solid var(--line)',
            paddingLeft: 14,
          }}
        >
          Portfolio Intelligence
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 11,
          color: 'var(--ink-soft)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isConnected ? 'var(--green)' : 'var(--ink-mute)',
              boxShadow: isConnected ? '0 0 8px var(--green)' : 'none',
            }}
            className={isConnected ? 'status-dot-live' : ''}
          />
          {isConnected ? 'LIVE · ALPACA' : 'CONNECTING'}
        </div>

        <div>Market: {marketStatus}</div>

        <div>{time.toLocaleTimeString('en-US', { hour12: false })}</div>

        <button
          onClick={onToggleTradingMode}
          title={alpacaEnv === 'live' ? 'Auto-trading is locked to manual in live mode' : undefined}
          style={{
            background: tradingMode === 'auto' ? 'var(--green)' : 'transparent',
            border: `1px solid ${tradingMode === 'auto' ? 'var(--green)' : 'var(--line)'}`,
            color: tradingMode === 'auto' ? '#000' : 'var(--ink-soft)',
            padding: '6px 14px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            cursor: alpacaEnv === 'live' ? 'not-allowed' : 'pointer',
            opacity: alpacaEnv === 'live' ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {tradingMode === 'auto' && (
            <span
              style={{
                display: 'inline-block',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#000',
              }}
              className="status-dot-live"
            />
          )}
          {tradingMode === 'auto' ? 'AUTO' : 'MANUAL'}
        </button>

        <button
          onClick={onOpenSettings}
          style={{
            background: 'transparent',
            border: '1px solid var(--line)',
            color: 'var(--ink-soft)',
            padding: '6px 12px',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          ⚙ Settings
        </button>
      </div>
    </div>
  )
}
