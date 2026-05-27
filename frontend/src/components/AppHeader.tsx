import { type CSSProperties } from 'react'
import { ClockData } from '../types'
import Header from './Header'

export const TABS = [
  { id: 'catch-up', label: 'Catch Me Up', sub: 'Daily briefing' },
  { id: 'watchlist', label: 'Watchlist', sub: 'Quotes & signals' },
  { id: 'positions', label: 'Positions', sub: 'Holdings & orders' },
  { id: 'filers', label: 'Filers', sub: 'Smart money' },
  { id: 'discover', label: 'Discover', sub: 'Top performers' },
  { id: 'glossary', label: 'Glossary', sub: 'Learn the terms' },
] as const

export type TabId = (typeof TABS)[number]['id']

interface Props {
  isConnected: boolean
  clock: ClockData | null
  tradingMode: 'auto' | 'manual'
  alpacaEnv: string
  onToggleTradingMode: () => void
  onOpenSettings: () => void
  activeTab: TabId
  onTabChange: (id: TabId) => void
}

export default function AppHeader({
  isConnected,
  clock,
  tradingMode,
  alpacaEnv,
  onToggleTradingMode,
  onOpenSettings,
  activeTab,
  onTabChange,
}: Props) {
  return (
    <header
      style={{
        background: 'var(--bg)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderBottom: '1px solid var(--line)',
      }}
    >
      <Header
        isConnected={isConnected}
        clock={clock}
        tradingMode={tradingMode}
        alpacaEnv={alpacaEnv}
        onToggleTradingMode={onToggleTradingMode}
        onOpenSettings={onOpenSettings}
      />

      <div
        role="tablist"
        style={{
          display: 'flex',
          padding: '0 32px',
          maxWidth: 1600,
          margin: '0 auto',
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              style={{
                ...tabButtonStyle,
                borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              }}
            >
              <span
                style={{
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontSize: 18,
                  color: isActive ? 'var(--ink)' : 'var(--ink-soft)',
                  fontStyle: isActive ? 'italic' : 'normal',
                  transition: 'color 150ms ease',
                }}
              >
                {tab.label}
              </span>
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 9,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: 'var(--ink-mute)',
                }}
              >
                {tab.sub}
              </span>
            </button>
          )
        })}
      </div>
    </header>
  )
}

const tabButtonStyle: CSSProperties = {
  padding: '14px 22px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  alignItems: 'flex-start',
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  marginBottom: -1,
  cursor: 'pointer',
}
