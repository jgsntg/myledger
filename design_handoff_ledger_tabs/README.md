# Handoff: Ledger — Tabbed Reorganization

## Overview

The current `frontend/src/App.tsx` renders every section as one long vertically-stacked page: header → portfolio summary → watchlist+signals → positions → orders → tracked filers → auto-trade log → market insights → disclaimer. This handoff reorganizes that single screen into a **persistent shell + 4 tabs**, with **Settings moved to a right-side drawer**.

The visual design (colors, typography, spacing, component styling) does **not** change. This is a structural reorganization that reuses every existing component as-is.

## About the design files

The files in `prototype/` are an **HTML/JSX design reference**, not production code to copy. They demonstrate the target layout, tab structure, persistent header, drawer, and tab transitions using mock data. Your job is to apply this structure to the existing React + TypeScript + Tailwind + Vite app at `frontend/`, reusing the existing components in `frontend/src/components/`.

## Fidelity

**High-fidelity.** The prototype uses the exact design tokens already defined in `frontend/src/index.css` and `frontend/tailwind.config.js`. Match it pixel-for-pixel — but you almost certainly don't need to touch the leaf components (tables, rows, log entries) themselves; only the layout that wraps them changes.

## What stays the same

All existing components keep their current implementations:

- `Header.tsx` — keep the top row (logo, market status, time, AUTO/MANUAL toggle, Settings button). **Remove `onConnect` toggling the settings panel inline**; settings now opens a drawer.
- `PortfolioSummary.tsx` — keep the four `SummaryCell`s but the wrapper becomes a persistent strip (see below).
- `Watchlist.tsx`, `StockRow.tsx`, `StockDetail.tsx`, `SignalsLog.tsx` — used inside the Watchlist tab.
- `PositionsTable.tsx`, `OrdersTable.tsx` — used inside the Positions tab.
- `TrackedFilersSection.tsx`, `AutoTradeLog.tsx` — used inside the Filers tab.
- `MarketInsights.tsx` — used inside the Discover tab.
- `SettingsPanel.tsx` — render the panel **inside a drawer**, not inline below the header.
- `TradeModal.tsx` — stays as a global overlay, no change.

## New / changed files

### 1. `App.tsx` — refactor

Replace the current return JSX. Keep all the state, callbacks, and effects unchanged. The only new state is `activeTab` and `showSettings` is reused for the drawer.

```tsx
const [activeTab, setActiveTab] = useState<TabId>('watchlist')

return (
  <>
    <AppHeader
      isConnected={connected}
      clock={clock}
      tradingMode={appSettings.trading_mode}
      alpacaEnv={appSettings.alpaca_env}
      onToggleTradingMode={toggleTradingMode}
      onOpenSettings={() => setShowSettings(true)}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />

    <main className="mx-auto w-full max-w-[1600px] px-8 pt-7 pb-20">
      <PortfolioStrip account={account} positions={positions} />

      {activeTab === 'watchlist' && (
        <WatchlistTab
          symbols={symbols}
          stockData={stockData}
          signalLog={signalLog}
          heldSymbols={heldSymbols}
          onAdd={handleAddSymbol}
          onRemove={handleRemoveSymbol}
          onTrade={(sym) => openTrade(sym)}
        />
      )}
      {activeTab === 'positions' && (
        <PositionsTab
          positions={positions}
          orders={orders}
          autoOrderIds={new Set(autoTrades.map(t => t.order_id).filter(Boolean) as string[])}
          onTrade={(sym, side, qty) => openTrade(sym, side, qty)}
        />
      )}
      {activeTab === 'filers' && (
        <FilersTab
          autoTrades={autoTrades}
          tradingMode={appSettings.trading_mode}
          onMirror={(symbol, side, qty, note) => openTrade(symbol, side, qty, note)}
          onHeldSymbolsChange={setHeldSymbols}
        />
      )}
      {activeTab === 'discover' && (
        <DiscoverTab
          settings={appSettings}
          watchlistSymbols={symbols}
          onSettingsUpdate={setAppSettings}
          onAddToWatchlist={handleAddSymbol}
          onTrade={(sym) => openTrade(sym)}
        />
      )}

      <Disclaimer />
    </main>

    <SettingsDrawer
      open={showSettings}
      onClose={() => setShowSettings(false)}
      settings={appSettings}
      onSave={async (patch) => {
        const updated = await api.updateSettings(patch)
        setAppSettings(updated)
      }}
    />

    {tradeTarget && (
      <TradeModal
        symbol={tradeTarget.symbol}
        presetSide={tradeTarget.presetSide}
        presetQty={tradeTarget.presetQty}
        sourceNote={tradeTarget.sourceNote}
        stockData={stockData}
        account={account}
        onClose={() => setTradeTarget(null)}
        onOrderFilled={refreshAccount}
      />
    )}
  </>
)
```

### 2. `components/AppHeader.tsx` — new, replaces the wrapper around `Header`

This is the existing `Header.tsx` plus a tab bar below it. The whole thing is `position: sticky; top: 0` so the tabs follow the user as they scroll.

- Top row: identical to current `Header.tsx`. Settings button should call `onOpenSettings` (passed as a prop) instead of toggling.
- Bottom row: tab bar.

**Tab bar markup:**

```tsx
const TABS = [
  { id: 'watchlist', label: 'Watchlist', sub: 'Quotes & signals' },
  { id: 'positions', label: 'Positions', sub: 'Holdings & orders' },
  { id: 'filers',    label: 'Filers',    sub: 'Smart money' },
  { id: 'discover',  label: 'Discover',  sub: 'Top performers' },
] as const
export type TabId = typeof TABS[number]['id']
```

Each tab:
- Padding: `14px 22px 16px`
- `display: flex; flex-direction: column; gap: 4px; align-items: flex-start`
- Bottom border: `2px solid transparent` (active: `2px solid var(--accent)`)
- `margin-bottom: -1px` so the active underline sits on top of the header's bottom border
- Label: Fraunces 18px, color `var(--ink-soft)` (active: `var(--ink)` + `font-style: italic`)
- Sub: JetBrains Mono 9px, letter-spacing 1.5px, uppercase, color `var(--ink-mute)`
- Hover (inactive): label color → `var(--ink)`, no border change

Tab bar container: `display: flex; padding: 0 32px; max-width: 1600px; margin: 0 auto`.

### 3. `components/PortfolioStrip.tsx` — extracted from `PortfolioSummary.tsx`

Identical content to the current `PortfolioSummary` but **drop the section header** ("The Portfolio" / "Paper Account · Updated Live") — the strip is now the persistent anchor above the tabs, not a section. The four `SummaryCell`s render unchanged inside the same 4-column grid.

- `margin-bottom: 36px` between the strip and the tab content below
- Cell padding bumps slightly to `22px 26px` (was `20px 24px`)
- Cell value font-size becomes `30px` (was `28px`) since the strip carries more visual weight now

### 4. `components/tabs/WatchlistTab.tsx` — new wrapper

```tsx
<div className="grid grid-cols-[1fr_380px] gap-8 items-start">
  <Watchlist ... />
  <div className="sticky top-[140px]">
    <SignalsLog entries={signalLog} />
  </div>
</div>
```

`top-[140px]` is the height of the sticky header (logo row ~68px + tab row ~52px + borders). Adjust if the header height changes.

### 5. `components/tabs/PositionsTab.tsx` — new wrapper

```tsx
<div className="flex flex-col gap-11">
  <PositionsTable positions={positions} onTrade={onTrade} />
  <OrdersTable orders={orders} autoOrderIds={autoOrderIds} />
</div>
```

Both existing components already render their own section heads. The gap between them is `44px` (gap-11).

### 6. `components/tabs/FilersTab.tsx` — new wrapper

```tsx
<div className="flex flex-col gap-11">
  <TrackedFilersSection onMirror={onMirror} onHeldSymbolsChange={onHeldSymbolsChange} />
  <AutoTradeLog entries={autoTrades} tradingMode={tradingMode} />
</div>
```

`AutoTradeLog`'s section header should be upgraded to match the other section heads — its current `<h2>` uses mono 11px uppercase rather than the Fraunces 22-26px italic used elsewhere. Use the standard pattern:

```tsx
<div className="flex justify-between items-baseline mb-4 pb-3 border-b border-line">
  <h2 className="font-display text-[26px] italic">Auto-Trade Log</h2>
  <span className={pillClass(tradingMode === 'auto' ? 'green' : 'neu')}>
    {tradingMode === 'auto' ? 'active' : 'inactive'}
  </span>
</div>
```

### 7. `components/tabs/DiscoverTab.tsx` — new wrapper

Just renders `<MarketInsights ... />`. No additional wrapper needed; pass through props from `App.tsx`.

The prototype shows top performers as a **4-up card grid** with sparklines, which is a visual upgrade over the current single-column rank list. Consider this an optional enhancement — keeping `MarketInsights.tsx` as-is is acceptable for the first pass. If you do the grid, see "Optional: Discover card grid" below.

### 8. `components/SettingsDrawer.tsx` — new wrapper around existing `SettingsPanel`

A right-side slide-in panel.

- Scrim: `position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 100`. Animate opacity 200ms.
- Drawer: `position: fixed; top: 0; right: 0; bottom: 0; width: 420px; max-width: 92vw; background: var(--bg-elev); border-left: 1px solid var(--line); transform: translateX(100%); transition: transform 0.25s ease`. When open, `transform: translateX(0)`.
- Drawer head: `padding: 22px 26px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: flex-start`. Contains a "Configuration" eyebrow + "Settings" Fraunces italic title and a close button.
- Drawer body: `padding: 22px 26px; overflow-y: auto; flex: 1`. Renders `<SettingsPanel settings onSave>` inside.
- Close button: `30×30px`, transparent bg, `1px solid var(--line)`, `font-size: 18px`. Hover → ink color.
- Closes on scrim click and on Esc key.

## Tab → component mapping (summary)

| Tab | Existing components used | Layout |
|---|---|---|
| **Watchlist** | `Watchlist` + `SignalsLog` | 2-col grid `1fr 380px`, gap 32px, signals sticky |
| **Positions** | `PositionsTable` + `OrdersTable` | vertical stack, gap 44px |
| **Filers** | `TrackedFilersSection` + `AutoTradeLog` | vertical stack, gap 44px |
| **Discover** | `MarketInsights` | single section |

The trailing disclaimer (`<div>` with "A note on the signals…") stays at the bottom of `<main>`, shared across all tabs.

## Header height for sticky offset

After the tab bar is in place the sticky header is approximately:
- Top row: 18px top pad + 30px logo line-height + 14px bottom pad ≈ 62px
- Tab row: 14px top + 18px label line + 4px gap + 9px sub + 16px bottom ≈ 61px
- Plus 1px bottom border

Round to **`top: 124px`** for sticky elements inside `<main>` (e.g. the signals log) and **`top: 140px`** if you want a comfortable gap. The prototype uses 140.

## State management

No new app-level state is needed beyond `activeTab`. Everything else (account, positions, orders, signals, autoTrades, settings) is already in `App.tsx` and is passed to whichever tab needs it. Tab content unmounts when not active — that's fine; the parent owns the state.

Persisting active tab in the URL (e.g. `#watchlist`) is a nice-to-have. Suggested approach:

```tsx
const [activeTab, setActiveTab] = useState<TabId>(() => {
  const hash = window.location.hash.slice(1) as TabId
  return TABS.some(t => t.id === hash) ? hash : 'watchlist'
})
useEffect(() => { window.location.hash = activeTab }, [activeTab])
```

## Design tokens

All tokens already exist in `frontend/src/index.css` and `frontend/tailwind.config.js`. **Do not change them.** They are:

```
--bg:        #0e0e10
--bg-elev:   #16161a
--bg-card:   #1a1a1f
--line:      #26262d
--line-soft: #1f1f25
--ink:       #e8e6e1
--ink-soft:  #a09c93
--ink-mute:  #6b6860
--accent:    #d4a574
--green:     #6fcf97
--red:       #eb5757
--amber:     #f2c94c
--blue:      #56a3f0   /* prototype uses #7fb7ff for 13F pill — either is acceptable */
```

Fonts:
- Display: Fraunces (italic 400/500), used for h1/h2, ticker symbols, large numbers
- Body: Inter Tight (400/500/600), default body text
- Mono: JetBrains Mono (400/500/600), labels, prices, timestamps, eyebrows

## Animations & transitions

- Drawer open/close: `transform 250ms ease`, scrim `opacity 200ms`
- Tab change: no transition required; content swaps instantly. If desired, add a 100ms fade on the `<main>` content.
- Tab hover: 150ms color transition on label
- Existing `.detail-panel` max-height transition for stock detail expansion: keep as-is

## Responsive behavior

The current app is desktop-only (`max-width: 1600px`, fixed grid columns). Maintain this; no responsive work needed in this pass. The watchlist 2-column grid (`1fr 380px`) and the 4-column portfolio strip both look OK down to ~1100px viewport — below that, both should stack, but this is out of scope unless the user asks.

## Accessibility notes

- Tab bar should use `role="tablist"`, each tab `role="tab"` with `aria-selected`. Each tab panel `role="tabpanel"`.
- Drawer should trap focus while open and restore focus to the Settings button on close.
- Drawer close on Esc key.
- The portfolio strip is a `<section aria-label="Portfolio summary">`.

## Optional: Discover card grid

If you want to upgrade `MarketInsights.tsx`'s rank table into the card grid shown in the prototype:

- 4-column grid (`grid-template-columns: repeat(4, 1fr)`), 1px gap on `var(--line)` background, 1px border, identical to the portfolio strip pattern
- Card: `padding: 22px 22px 20px; background: var(--bg-elev)`, hover → `var(--bg-card)`
- Card content (top→bottom): rank badge (mono 11px, absolute top-right), symbol (Fraunces 26px), return (mono 22px bold colored green/red), price (mono 12px muted), sparkline (140×36, accent color), action row (`Watch` ghost + `Trade` accent button)
- Sparkline: use a small SVG sparkline component; data can come from the existing `bars` array on `StockData` or be added to the `InsightEntry` type as `price_series: number[]` from a new backend endpoint

## Files in this bundle

- `prototype/Ledger Tabs.html` — the entry HTML
- `prototype/ledger.css` — full styling for the prototype (use as a reference; the real app uses Tailwind + the existing index.css)
- `prototype/ledger-app.jsx` — main React component, header, tab routing, tweaks panel
- `prototype/ledger-views.jsx` — tab view components (Watchlist, Positions, Filers, Discover) and shared bits (Pill, SignalBadge, Sparkline, SectionHead)
- `prototype/ledger-data.jsx` — mock data shaped to match `frontend/src/types/index.ts`
- `README.md` — this file

## Files in `frontend/` you will touch

- `frontend/src/App.tsx` — refactor (return JSX only)
- `frontend/src/components/Header.tsx` — minor: replace `onConnect` toggle with `onOpenSettings`
- `frontend/src/components/PortfolioSummary.tsx` — split: extract `PortfolioStrip.tsx`, drop the section title
- `frontend/src/components/SettingsPanel.tsx` — no internal change; rendered inside the new drawer
- `frontend/src/components/AutoTradeLog.tsx` — minor: upgrade `<h2>` to match standard section head style

Files to create:
- `frontend/src/components/AppHeader.tsx`
- `frontend/src/components/PortfolioStrip.tsx`
- `frontend/src/components/SettingsDrawer.tsx`
- `frontend/src/components/tabs/WatchlistTab.tsx`
- `frontend/src/components/tabs/PositionsTab.tsx`
- `frontend/src/components/tabs/FilersTab.tsx`
- `frontend/src/components/tabs/DiscoverTab.tsx`

## Out of scope

- Any backend / API changes
- Responsive / mobile layout
- Authentication, error boundaries, loading skeletons (existing skeleton classes remain in use)
- The "accent hue" and "density" tweaks shown in the prototype's Tweaks panel — these were exploration aids, not requirements
