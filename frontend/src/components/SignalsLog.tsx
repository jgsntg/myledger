import { SignalLogEntry } from '../types'

interface Props {
  entries: SignalLogEntry[]
}

export default function SignalsLog({ entries }: Props) {
  return (
    <aside>
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
          Signals Log
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
          Real-time
        </span>
      </div>

      <div
        style={{
          background: 'var(--bg-elev)',
          border: '1px solid var(--line)',
          position: 'sticky',
          top: 100,
          alignSelf: 'start',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <h3
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 18,
            }}
          >
            Recent activity
          </h3>
          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: 'var(--accent)',
            }}
          >
            {entries.length} event{entries.length === 1 ? '' : 's'}
          </span>
        </div>

        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          {entries.length === 0 ? (
            <div
              style={{
                padding: '32px 22px',
                textAlign: 'center',
                color: 'var(--ink-mute)',
                fontStyle: 'italic',
                fontFamily: 'Fraunces, Georgia, serif',
              }}
            >
              No signals yet — add stocks to begin
            </div>
          ) : (
            entries.map((e) => (
              <div
                key={e.id}
                style={{
                  padding: '14px 22px',
                  borderBottom: '1px solid var(--line-soft)',
                  fontSize: 13,
                }}
              >
                <div
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 10,
                    color: 'var(--ink-mute)',
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  {e.time.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
                <div
                  style={{
                    color:
                      e.type === 'buy'
                        ? 'var(--green)'
                        : e.type === 'sell'
                          ? 'var(--red)'
                          : 'var(--ink)',
                    lineHeight: 1.4,
                  }}
                >
                  {e.symbol && (
                    <span
                      style={{
                        fontFamily: 'Fraunces, Georgia, serif',
                        fontWeight: 500,
                        color: 'var(--accent)',
                      }}
                    >
                      {e.symbol}{' '}
                    </span>
                  )}
                  {e.message}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
