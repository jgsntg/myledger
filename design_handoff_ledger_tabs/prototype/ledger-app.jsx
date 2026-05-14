/* global React, ReactDOM */
const { useState, useEffect, useRef } = React;

const TABS = [
  { id: 'watchlist', label: 'Watchlist', sub: 'Quotes & signals' },
  { id: 'positions', label: 'Positions', sub: 'Holdings & orders' },
  { id: 'filers',    label: 'Filers',    sub: 'Smart money' },
  { id: 'discover',  label: 'Discover',  sub: 'Top performers' },
];

function useTweaks(defaults) {
  const [tweaks, setTweaks] = useState(defaults);
  const setTweak = (a, b) => {
    setTweaks((prev) => {
      const next = typeof a === 'object' ? { ...prev, ...a } : { ...prev, [a]: b };
      try {
        window.parent.postMessage({ type: '__edit_mode_set_keys', edits: next }, '*');
      } catch {}
      return next;
    });
  };
  return [tweaks, setTweak];
}

function Header({ clock, mode, env, onToggleMode, onOpenSettings, tabId, onTabChange, tweaks }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const marketStatus = clock?.is_open ? 'Open' : 'Closed';

  return (
    <header className="app-header" data-screen-label="App header">
      <div className="header-top">
        <div className="brand">
          <h1 className="logo">
            <span className="logo-accent">L</span>edger
          </h1>
          <span className="brand-sub mono">Portfolio Intelligence</span>
        </div>

        <div className="header-meta mono">
          <div className="live-pill">
            <span className="dot dot-live" />
            LIVE · ALPACA
          </div>
          <div>Market: <span className="ink">{marketStatus}</span></div>
          <div>{time.toLocaleTimeString('en-US', { hour12: false })}</div>
          <button
            onClick={onToggleMode}
            title={env === 'live' ? 'Auto-trading locked in live mode' : undefined}
            className={`mode-toggle ${mode === 'auto' ? 'mode-auto' : ''}`}
          >
            {mode === 'auto' && <span className="dot dot-black dot-live" />}
            {mode === 'auto' ? 'AUTO' : 'MANUAL'}
          </button>
          <button onClick={onOpenSettings} className="settings-btn">⚙ Settings</button>
        </div>
      </div>

      <nav className={`tabs tabs-${tweaks.tabStyle}`} role="tablist" data-screen-label="Tab bar">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tabId === t.id}
            onClick={() => onTabChange(t.id)}
            className={`tab ${tabId === t.id ? 'tab-on' : ''}`}
          >
            <span className="tab-label display">{t.label}</span>
            {tweaks.tabStyle !== 'compact' && <span className="tab-sub mono">{t.sub}</span>}
          </button>
        ))}
      </nav>
    </header>
  );
}

function App() {
  const [tweaks, setTweak] = useTweaks(/*EDITMODE-BEGIN*/{
    "tabStyle": "spacious",
    "density": "regular",
    "signalsSticky": true,
    "stripPosition": "above-tabs",
    "accentHue": "sand"
  }/*EDITMODE-END*/);

  const [tab, setTab] = useState('watchlist');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tradeTarget, setTradeTarget] = useState(null);
  const [mode, setMode] = useState(window.LedgerData.MOCK_SETTINGS.trading_mode);

  // Tweaks edit mode wiring
  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    function onMsg(e) {
      const d = e?.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === '__activate_edit_mode') setEditMode(true);
      if (d.type === '__deactivate_edit_mode') setEditMode(false);
    }
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const openTrade = (symbol, presetSide, presetQty, sourceNote) =>
    setTradeTarget({ symbol, presetSide, presetQty, sourceNote });

  // Apply accent hue
  useEffect(() => {
    const map = {
      sand:   '#d4a574',
      moss:   '#9bb87a',
      slate:  '#8aa0b8',
      brick:  '#c47a6b',
    };
    document.documentElement.style.setProperty('--accent', map[tweaks.accentHue] || map.sand);
  }, [tweaks.accentHue]);

  const stripFirst = tweaks.stripPosition === 'above-tabs';

  return (
    <div className={`app density-${tweaks.density}`}>
      <Header
        clock={window.LedgerData.MOCK_CLOCK}
        mode={mode}
        env={window.LedgerData.MOCK_SETTINGS.alpaca_env}
        onToggleMode={() => setMode((m) => m === 'auto' ? 'manual' : 'auto')}
        onOpenSettings={() => setSettingsOpen(true)}
        tabId={tab}
        onTabChange={setTab}
        tweaks={tweaks}
      />

      <main className="app-main">
        {stripFirst && (
          <PortfolioStrip account={window.LedgerData.MOCK_ACCOUNT} positions={window.LedgerData.MOCK_POSITIONS} />
        )}

        <div className="tab-panel" role="tabpanel">
          {tab === 'watchlist' && (
            <WatchlistTab
              density={tweaks.density}
              signalsSticky={tweaks.signalsSticky}
              onTrade={openTrade}
            />
          )}
          {tab === 'positions' && (
            <>
              {!stripFirst && (
                <PortfolioStrip account={window.LedgerData.MOCK_ACCOUNT} positions={window.LedgerData.MOCK_POSITIONS} />
              )}
              <PositionsTab onTrade={openTrade} />
            </>
          )}
          {tab === 'filers'   && <FilersTab onMirror={openTrade} tradingMode={mode} />}
          {tab === 'discover' && <DiscoverTab onTrade={openTrade} />}
        </div>

        <footer className="app-footer">
          A note on the signals: RSI, MACD, moving-average crossovers, and Bollinger Bands are
          descriptive indicators of recent price behavior, not predictions. They tell you what the
          math says about the past — not what the market will do next. This dashboard is a thinking
          aid, not financial advice. Trade your own judgment.
        </footer>
      </main>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={{ ...window.LedgerData.MOCK_SETTINGS, trading_mode: mode }}
      />

      <TradeModal
        open={!!tradeTarget}
        target={tradeTarget}
        onClose={() => setTradeTarget(null)}
      />

      {editMode && (
        <TweaksPanel
          tweaks={tweaks}
          setTweak={setTweak}
          onClose={() => {
            setEditMode(false);
            try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch {}
          }}
        />
      )}
    </div>
  );
}

function TweaksPanel({ tweaks, setTweak, onClose }) {
  return (
    <div className="tweaks">
      <div className="tweaks-head">
        <h3 className="display">Tweaks</h3>
        <button onClick={onClose} className="x-btn">×</button>
      </div>

      <TweakSection label="Tab style">
        <Segmented
          options={[['spacious','Spacious'],['compact','Compact']]}
          value={tweaks.tabStyle}
          onChange={(v) => setTweak('tabStyle', v)}
        />
      </TweakSection>

      <TweakSection label="Row density">
        <Segmented
          options={[['regular','Regular'],['dense','Dense']]}
          value={tweaks.density}
          onChange={(v) => setTweak('density', v)}
        />
      </TweakSection>

      <TweakSection label="Signals sidebar" sub="Stick the log to the right of the watchlist or stack it below">
        <Segmented
          options={[[true,'Sticky'],[false,'Stacked']]}
          value={tweaks.signalsSticky}
          onChange={(v) => setTweak('signalsSticky', v)}
        />
      </TweakSection>

      <TweakSection label="Portfolio strip" sub="Where the equity / P&L cards live">
        <Segmented
          options={[['above-tabs','Above tabs (persistent)'],['in-positions','Positions tab only']]}
          value={tweaks.stripPosition}
          onChange={(v) => setTweak('stripPosition', v)}
          vertical
        />
      </TweakSection>

      <TweakSection label="Accent hue">
        <div className="swatches">
          {[
            ['sand', '#d4a574'],
            ['moss', '#9bb87a'],
            ['slate', '#8aa0b8'],
            ['brick', '#c47a6b'],
          ].map(([id, color]) => (
            <button
              key={id}
              className={`swatch ${tweaks.accentHue === id ? 'swatch-on' : ''}`}
              style={{ background: color }}
              onClick={() => setTweak('accentHue', id)}
              title={id}
            />
          ))}
        </div>
      </TweakSection>

      <div className="tweaks-note italic mono">
        Tab order and grouping logic is fixed in this mock — tweaks adjust visual chrome only.
      </div>
    </div>
  );
}

function TweakSection({ label, sub, children }) {
  return (
    <div className="tweak-section">
      <div className="tweak-label">{label}</div>
      {sub && <div className="tweak-sub">{sub}</div>}
      <div className="tweak-control">{children}</div>
    </div>
  );
}

function Segmented({ options, value, onChange, vertical }) {
  return (
    <div className={`seg ${vertical ? 'seg-vert' : ''}`}>
      {options.map(([v, label]) => (
        <button
          key={String(v)}
          className={`seg-btn ${value === v ? 'seg-on' : ''}`}
          onClick={() => onChange(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
