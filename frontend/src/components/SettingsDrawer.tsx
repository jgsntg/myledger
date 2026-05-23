import { useEffect, useRef, type CSSProperties } from 'react'
import { AppSettings } from '../types'
import SettingsPanel from './SettingsPanel'

interface Props {
  open: boolean
  onClose: () => void
  settings: AppSettings
  onSave: (patch: Partial<AppSettings>) => Promise<void>
}

export default function SettingsDrawer({ open, onClose, settings, onSave }: Props) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    lastFocusedRef.current = document.activeElement as HTMLElement | null
    closeBtnRef.current?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      lastFocusedRef.current?.focus?.()
    }
  }, [open, onClose])

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
          zIndex: 100,
        }}
      />

      <aside
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          maxWidth: '92vw',
          background: 'var(--bg-elev)',
          borderLeft: '1px solid var(--line)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '22px 26px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: 'var(--ink-mute)',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Configuration
            </div>
            <h2
              style={{
                fontFamily: 'Fraunces, Georgia, serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 26,
                letterSpacing: '-0.3px',
              }}
            >
              Settings
            </h2>
          </div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close settings"
            style={closeBtnStyle}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '22px 26px',
            overflowY: 'auto',
            flex: 1,
          }}
        >
          <SettingsPanel
            key={`${settings.default_trade_usd}-${settings.tax_short_term_rate}-${settings.tax_long_term_rate}-${settings.tax_long_term_days}-${settings.risk_level}-${settings.allow_short_selling}`}
            settings={settings}
            onSave={onSave}
          />
        </div>
      </aside>
    </>
  )
}

const closeBtnStyle: CSSProperties = {
  width: 30,
  height: 30,
  background: 'transparent',
  border: '1px solid var(--line)',
  color: 'var(--ink-soft)',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
