/* global React */
const { useState, useMemo } = React;
const { fmtMoney, fmtMoneyShort, fmtPct, deltaClass, relTime } = window.LedgerFmt;
const D = window.LedgerData;

// ---------- Shared bits ----------

function SectionHead({ title, eyebrow, right, sub }) {
  return (
    <div className="sec-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2 className="sec-title">{title}</h2>
        {sub && <div className="sec-sub">{sub}</div>}
      </div>
      {right && <div className="sec-right">{right}</div>}
    </div>
  );
}

function Pill({ children, tone = 'neu', subtle = false }) {
  return <span className={`pill pill-${tone} ${subtle ? 'pill-subtle' : ''}`}>{children}</span>;
}

function Btn({ children, variant = 'ghost', onClick, disabled, title, style }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`btn btn-${variant}`}
      style={style}
    >
      {children}
    </button>
  );
}

function SignalBadge({ sig }) {
  return <span className={`sig sig-${sig.type}`}>{sig.label}</span>;
}

function Sparkline({ points, up, width = 96, height = 28 }) {
  if (!points || points.length === 0) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((p - min) / span) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <path d={path} fill="none" stroke={up ? 'var(--green)' : 'var(--red)'} strokeWidth="1.4" />
    </svg>
  );
}

// Tiny deterministic sparkline generator
function sparkFor(symbol, up) {
  const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const pts = [];
  let v = 50;
  for (let i = 0; i < 24; i++) {
    const n = Math.sin((seed + i) * 1.7) * 6 + Math.cos((seed + i) * 0.9) * 4;
    v += n + (up ? 0.6 : -0.6);
    pts.push(v);
  }
  return pts;
}

// ---------- Portfolio strip (persistent) ----------

function PortfolioStrip({ account, positions }) {
  const eq = parseFloat(account.equity);
  const lastEq = parseFloat(account.last_equity);
  const bp = parseFloat(account.buying_power);
  const pl = eq - lastEq;
  const plPct = (pl / lastEq) * 100;
  const dc = deltaClass(pl);

  return (
    <section className="strip" data-screen-label="Portfolio strip">
      <div className="strip-cell">
        <div className="cell-label">Total Equity</div>
        <div className="cell-value display">{fmtMoney(eq)}</div>
        <div className={`cell-delta delta-${dc}`}>
          {fmtPct(plPct)} <span className="muted">today</span>
        </div>
      </div>
      <div className="strip-cell">
        <div className="cell-label">Buying Power</div>
        <div className="cell-value display">{fmtMoney(bp)}</div>
        <div className="cell-delta">Cash available</div>
      </div>
      <div className="strip-cell">
        <div className="cell-label">Day's P&amp;L</div>
        <div className={`cell-value display delta-${dc}`}>
          {pl >= 0 ? '+' : ''}{fmtMoney(Math.abs(pl)).replace('$','$')}
        </div>
        <div className={`cell-delta delta-${dc}`}>{fmtPct(plPct)}</div>
      </div>
      <div className="strip-cell">
        <div className="cell-label">Open Positions</div>
        <div className="cell-value display">{positions.length}</div>
        <div className="cell-delta">Active holdings</div>
      </div>
    </section>
  );
}

// ---------- Watchlist tab ----------

function WatchlistTab({ density, signalsSticky, onTrade }) {
  const [input, setInput] = useState('');
  const [expanded, setExpanded] = useState(null);

  return (
    <div className={`grid-2col ${signalsSticky ? '' : 'grid-stacked'}`}>
      <section data-screen-label="Watchlist">
        <SectionHead
          title="Watchlist & Signals"
          eyebrow="Markets"
          sub="Real-time quotes and technical signals on your tracked tickers"
          right={<span className="meta">Click a row for indicators</span>}
        />

        <div className="add-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            placeholder="Add symbol (e.g. AAPL)"
            maxLength={6}
            className="input mono"
          />
          <Btn variant="accent" onClick={() => setInput('')}>Add</Btn>
        </div>

        <div className="rows">
          {D.MOCK_WATCHLIST.map((row) => {
            const up = row.change >= 0;
            const isOpen = expanded === row.symbol;
            return (
              <div key={row.symbol} className={`row ${isOpen ? 'row-open' : ''} ${density}`}>
                <div
                  className="row-main"
                  onClick={() => setExpanded(isOpen ? null : row.symbol)}
                >
                  <div className="col-sym">
                    <span className="sym display">{row.symbol}</span>
                    {D.MOCK_HELD_BY_FILER.has(row.symbol) && (
                      <Pill tone="blue" subtle>13F</Pill>
                    )}
                  </div>
                  <div className={`col-price mono ${up ? 'delta-pos' : 'delta-neg'}`}>
                    {fmtMoney(row.price)}
                  </div>
                  <div className={`col-change mono ${up ? 'delta-pos' : 'delta-neg'}`}>
                    {fmtPct(row.changePct)}
                    <span className="muted">{' '}{row.change >= 0 ? '+' : ''}{row.change.toFixed(2)}</span>
                  </div>
                  <div className="col-spark">
                    <Sparkline points={sparkFor(row.symbol, up)} up={up} />
                  </div>
                  <div className="col-sigs">
                    {row.signals.map((s) => <SignalBadge key={s.label} sig={s} />)}
                  </div>
                  <div className="col-actions">
                    <Btn variant="accent-ghost" onClick={(e) => { e.stopPropagation(); onTrade(row.symbol); }}>
                      Trade
                    </Btn>
                  </div>
                </div>
                {isOpen && (
                  <div className="row-detail">
                    <div className="detail-grid">
                      <DetailMetric label="RSI (14)" value="58.2" tone="neu" />
                      <DetailMetric label="SMA 50" value={fmtMoney(row.price * 0.96)} />
                      <DetailMetric label="SMA 200" value={fmtMoney(row.price * 0.88)} />
                      <DetailMetric label="MACD" value="+1.42" tone="pos" />
                      <DetailMetric label="Bollinger U" value={fmtMoney(row.price * 1.04)} />
                      <DetailMetric label="Bollinger L" value={fmtMoney(row.price * 0.93)} />
                    </div>
                    <div className="placeholder-chart">
                      <span className="mono muted">PRICE CHART · 365D</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <aside className={signalsSticky ? 'aside-sticky' : ''}>
        <SectionHead title="Signals Log" eyebrow="Live" right={<span className="meta">{D.MOCK_SIGNAL_LOG.length} events</span>} />
        <div className="log-card">
          {D.MOCK_SIGNAL_LOG.map((e) => (
            <div key={e.id} className="log-row">
              <div className="log-time mono">{e.time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} · <span className="muted">{relTime(e.time)}</span></div>
              <div className={`log-msg log-${e.type}`}>
                {e.symbol && <span className="log-sym">{e.symbol}</span>} {e.message}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function DetailMetric({ label, value, tone }) {
  return (
    <div className="detail-metric">
      <div className="cell-label">{label}</div>
      <div className={`detail-val mono ${tone ? 'delta-' + tone : ''}`}>{value}</div>
    </div>
  );
}

// ---------- Positions tab ----------

function PositionsTab({ onTrade }) {
  const positions = D.MOCK_POSITIONS;
  const orders = D.MOCK_ORDERS;

  return (
    <div className="stack">
      <section data-screen-label="Open Positions">
        <SectionHead
          title="Open Positions"
          eyebrow="Holdings"
          right={<span className="meta">{positions.length} positions</span>}
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {['Symbol','Qty','Avg Entry','Current','Market Value','P&L','P&L %',''].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const upl = parseFloat(p.unrealized_pl);
                const uplPct = parseFloat(p.unrealized_plpc) * 100;
                const dc = deltaClass(upl);
                return (
                  <tr key={p.symbol}>
                    <td className="cell-sym display">{p.symbol}</td>
                    <td className="mono">{p.qty}</td>
                    <td className="mono">{fmtMoney(parseFloat(p.avg_entry_price))}</td>
                    <td className="mono">{fmtMoney(parseFloat(p.current_price))}</td>
                    <td className="mono">{fmtMoney(parseFloat(p.market_value))}</td>
                    <td className={`mono delta-${dc}`}>{upl >= 0 ? '+' : ''}{fmtMoney(upl)}</td>
                    <td className={`mono delta-${dc}`}>{fmtPct(uplPct)}</td>
                    <td className="cell-actions">
                      <Btn variant="accent-ghost" onClick={() => onTrade(p.symbol, 'sell', p.qty)}>Close</Btn>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section data-screen-label="Recent Orders">
        <SectionHead
          title="Recent Orders"
          eyebrow="Activity"
          right={<span className="meta">Last 20 · all statuses</span>}
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {['Submitted','Symbol','Side','Qty','Type','Fill Price','Status','Source'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const t = new Date(o.submitted_at);
                return (
                  <tr key={o.id}>
                    <td className="mono muted">{t.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="cell-sym display">{o.symbol}</td>
                    <td className={`mono cap ${o.side === 'buy' ? 'delta-pos' : 'delta-neg'}`}>{o.side}</td>
                    <td className="mono">{o.qty}</td>
                    <td className="mono cap">{o.type}</td>
                    <td className="mono">{o.filled_avg_price ? fmtMoney(parseFloat(o.filled_avg_price)) : '—'}</td>
                    <td className={`mono cap status-${o.status}`}>{o.status.replace('_',' ')}</td>
                    <td>
                      {o._auto
                        ? <Pill tone="green" subtle>AUTO</Pill>
                        : <span className="mono muted small">manual</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------- Filers tab ----------

function FilersTab({ onMirror, tradingMode }) {
  const [expanded, setExpanded] = useState(D.MOCK_FILERS[0].id);
  const filers = D.MOCK_FILERS;
  const autoTrades = D.MOCK_AUTO_TRADES;

  return (
    <div className="stack">
      <section data-screen-label="Tracked Filers">
        <SectionHead
          title="Tracked Filers"
          eyebrow="Smart Money"
          sub="Congressional disclosures and 13F holdings — mirror trades manually or auto-sync"
          right={<span className="meta">Manual mirror only</span>}
        />

        <div className="filer-add">
          <input className="input mono" placeholder="Name" />
          <select className="input mono">
            <option>Congress</option>
            <option>13F</option>
          </select>
          <input className="input mono" placeholder="nancy-pelosi or CIK" />
          <Btn variant="accent">Track</Btn>
        </div>

        <div className="filer-list">
          {filers.map((f) => {
            const isOpen = expanded === f.id;
            const count = f.filer_type === 'congress' ? f.transactions.length : f.holdings.length;
            return (
              <div key={f.id} className={`filer ${isOpen ? 'filer-open' : ''}`}>
                <div className="filer-head" onClick={() => setExpanded(isOpen ? null : f.id)}>
                  <div>
                    <div className="filer-name display">{f.name}</div>
                    <div className="cell-label">{f.source_id}</div>
                  </div>
                  <Pill tone="neu" subtle>{f.filer_type === 'congress' ? 'Congress' : '13F'}</Pill>
                  <div className="muted">
                    {f.filer_type === 'congress' ? `${count} transactions` : `${count} holdings`}
                  </div>
                  <Btn variant="accent-ghost" onClick={(e) => e.stopPropagation()}>Sync</Btn>
                  <Btn variant="ghost" onClick={(e) => e.stopPropagation()}>Remove</Btn>
                  <span className="filer-caret mono">{isOpen ? '−' : '+'}</span>
                </div>

                {isOpen && (
                  <div className="filer-body">
                    {f.filer_type === 'congress' ? (
                      <div className="sub-table">
                        <div className="sub-thead mono">
                          <div>Symbol</div><div>Type</div><div>Date</div><div>Amount</div><div></div>
                        </div>
                        {f.transactions.map((tx) => (
                          <div key={tx.id} className="sub-row">
                            <div className="display sym-sm">{tx.symbol}</div>
                            <div>{tx.transaction_type}</div>
                            <div className="muted mono">{new Date(tx.trade_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                            <div className="mono">{fmtMoneyShort(tx.amount_low)} – {fmtMoneyShort(tx.amount_high)}</div>
                            <Btn variant="accent" onClick={() => onMirror(tx.symbol, tx.transaction_type.toLowerCase().includes('sale') ? 'sell' : 'buy', '1', `Mirroring ${f.name} · ${tx.transaction_type} · ${tx.trade_date}`)}>Mirror</Btn>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="sub-table">
                        <div className="sub-thead mono">
                          <div>Symbol</div><div>Shares</div><div>Value</div><div>Report Date</div>
                        </div>
                        {f.holdings.map((h) => (
                          <div key={h.id} className="sub-row sub-row-4">
                            <div className="display sym-sm">{h.symbol}</div>
                            <div className="mono">{h.shares.toLocaleString()}</div>
                            <div className="mono">{fmtMoneyShort(h.value_usd)}</div>
                            <div className="muted mono">{new Date(h.report_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section data-screen-label="Auto-Trade Log">
        <SectionHead
          title="Auto-Trade Log"
          eyebrow="Automation"
          right={<Pill tone={tradingMode === 'auto' ? 'green' : 'neu'} subtle>{tradingMode === 'auto' ? 'active' : 'inactive'}</Pill>}
        />
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {['Time','Symbol','Side','Qty','Source','Trigger','Order ID','Status'].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {autoTrades.map((e) => {
                const t = new Date(e.created_at);
                return (
                  <tr key={e.id}>
                    <td className="mono muted">{t.toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}</td>
                    <td className="cell-sym display">{e.symbol}</td>
                    <td className={`mono cap ${e.side === 'buy' ? 'delta-pos' : 'delta-neg'}`}>{e.side}</td>
                    <td className="mono">{e.qty}</td>
                    <td className="mono">{e.source}</td>
                    <td className="mono muted ellipsis">{e.source_ref}</td>
                    <td className="mono muted small">{e.order_id ? e.order_id.slice(0,8) + '…' : '—'}</td>
                    <td>
                      {e.status === 'submitted'
                        ? <span className="delta-pos mono">✓</span>
                        : <span className="delta-neg mono small" title={e.error}>✗ {e.error}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ---------- Discover tab ----------

function DiscoverTab({ onTrade }) {
  const [period, setPeriod] = useState('7');
  const [newSym, setNewSym] = useState('');
  const data = D.MOCK_INSIGHTS;
  const list = period === '7' ? data.d7 : period === '14' ? data.d14 : data.d30;
  const extras = D.MOCK_SETTINGS.insights_extra_symbols.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="stack" data-screen-label="Discover">
      <section>
        <SectionHead
          title="Market Insights"
          eyebrow="Discover"
          sub="Top performers across the 50-stock default universe plus your custom symbols"
          right={
            <div className="row-right">
              <span className="meta">{data.universe_size} symbols · as of {data.refreshed_at}</span>
              <Btn variant="ghost">Refresh</Btn>
            </div>
          }
        />

        <div className="period-tabs">
          {['7','14','30'].map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`period-tab ${period === p ? 'period-tab-on' : ''}`}>
              {p}D
            </button>
          ))}
        </div>

        <div className="insights-grid">
          {list.map((entry, idx) => {
            const positive = entry.return_pct >= 0;
            return (
              <div key={entry.symbol} className="insight-card">
                <div className="insight-rank mono">{String(idx + 1).padStart(2, '0')}</div>
                <div className="insight-sym display">{entry.symbol}</div>
                <div className={`insight-ret mono ${positive ? 'delta-pos' : 'delta-neg'}`}>
                  {positive ? '+' : ''}{entry.return_pct.toFixed(2)}%
                </div>
                <div className="insight-price mono muted">{fmtMoney(entry.current_price)}</div>
                <div className="insight-spark">
                  <Sparkline points={sparkFor(entry.symbol, positive)} up={positive} width={140} height={36} />
                </div>
                <div className="insight-actions">
                  <Btn variant="ghost">Watch</Btn>
                  <Btn variant="accent" onClick={() => onTrade(entry.symbol)}>Trade</Btn>
                </div>
              </div>
            );
          })}
        </div>

        <div className="universe-card">
          <div className="cell-label">Custom universe symbols</div>
          <div className="universe-row">
            {extras.map((s) => (
              <span key={s} className="chip mono">{s}<button className="chip-x">×</button></span>
            ))}
            <input value={newSym} onChange={(e) => setNewSym(e.target.value.toUpperCase())} placeholder="TICKER" className="input mono input-sm" />
            <Btn variant="accent">Add</Btn>
          </div>
          <div className="meta italic">Added symbols are included alongside the 50-stock default universe.</div>
        </div>
      </section>
    </div>
  );
}

// ---------- Settings drawer ----------

function SettingsDrawer({ open, onClose, settings, onChange }) {
  return (
    <div className={`drawer-scrim ${open ? 'open' : ''}`} onClick={onClose}>
      <div className={`drawer ${open ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Configuration</div>
            <h2 className="sec-title">Settings</h2>
          </div>
          <button className="x-btn" onClick={onClose}>×</button>
        </div>

        <div className="drawer-body">
          <SettingsGroup title="Trading">
            <SettingsRow label="Default trade size" value={`$${settings.default_trade_usd}`} />
            <SettingsRow label="Alpaca environment" value={settings.alpaca_env.toUpperCase()} />
            <SettingsRow label="Trading mode" value={settings.trading_mode.toUpperCase()} />
          </SettingsGroup>
          <SettingsGroup title="Tax assumptions">
            <SettingsRow label="Short-term rate" value={`${(settings.tax_short_term_rate * 100).toFixed(0)}%`} />
            <SettingsRow label="Long-term rate" value={`${(settings.tax_long_term_rate * 100).toFixed(0)}%`} />
            <SettingsRow label="Long-term threshold" value={`${settings.tax_long_term_days} days`} />
          </SettingsGroup>
          <SettingsGroup title="Insights universe">
            <SettingsRow label="Extra symbols" value={settings.insights_extra_symbols || '—'} />
          </SettingsGroup>
          <div className="meta italic" style={{ marginTop: 16, fontFamily: 'var(--font-display)' }}>
            Live settings would be editable here. Mock view.
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <div className="settings-group">
      <div className="cell-label">{title}</div>
      <div className="settings-rows">{children}</div>
    </div>
  );
}

function SettingsRow({ label, value }) {
  return (
    <div className="settings-row">
      <div>{label}</div>
      <div className="mono">{value}</div>
    </div>
  );
}

// ---------- Trade modal ----------

function TradeModal({ open, target, onClose }) {
  if (!open || !target) return null;
  const watch = D.MOCK_WATCHLIST.find((w) => w.symbol === target.symbol) || { price: 100, change: 0, changePct: 0 };
  const up = watch.change >= 0;
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">Place Order</div>
            <h2 className="sec-title display">{target.symbol}</h2>
            <div className={`mono ${up ? 'delta-pos' : 'delta-neg'}`}>{fmtMoney(watch.price)} · {fmtPct(watch.changePct)}</div>
          </div>
          <button className="x-btn" onClick={onClose}>×</button>
        </div>
        {target.sourceNote && (
          <div className="modal-source-note">{target.sourceNote}</div>
        )}
        <div className="modal-body">
          <div className="side-toggle">
            <button className={`side-btn ${(target.presetSide || 'buy') === 'buy' ? 'side-buy' : ''}`}>BUY</button>
            <button className={`side-btn ${target.presetSide === 'sell' ? 'side-sell' : ''}`}>SELL</button>
          </div>
          <div className="form-row">
            <label className="cell-label">Quantity</label>
            <input className="input mono" defaultValue={target.presetQty || '10'} />
          </div>
          <div className="form-row">
            <label className="cell-label">Order Type</label>
            <select className="input mono"><option>Market</option><option>Limit</option></select>
          </div>
          <div className="form-row">
            <label className="cell-label">Time in Force</label>
            <select className="input mono"><option>DAY</option><option>GTC</option></select>
          </div>
          <div className="modal-eval">
            <div className="cell-label">Evaluation</div>
            <div className="eval-line">
              <Pill tone="green" subtle>PROCEED</Pill>
              <span className="muted">No wash-sale risk · estimated tax $0 (no position)</span>
            </div>
          </div>
          <div className="modal-actions">
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
            <Btn variant="accent">Submit Order</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  PortfolioStrip, WatchlistTab, PositionsTab, FilersTab, DiscoverTab,
  SettingsDrawer, TradeModal,
});
