# Design Notes

The prototype committed to a specific aesthetic: **editorial financial newspaper meets Bloomberg Terminal**. Dark, restrained, serif-led, monospace for numbers. Preserve this — don't drift toward generic SaaS dashboard.

## Color palette

```css
--bg:         #0e0e10;   /* near-black base */
--bg-elev:    #16161a;   /* elevated cards */
--bg-card:    #1a1a1f;   /* second elevation */
--line:       #26262d;   /* primary border */
--line-soft:  #1f1f25;   /* subtle internal divider */
--ink:        #e8e6e1;   /* warm off-white text */
--ink-soft:   #a09c93;   /* secondary text */
--ink-mute:   #6b6860;   /* tertiary / labels */
--accent:     #d4a574;   /* warm gold — used very sparingly for CTAs and active states */
--green:      #6fcf97;   /* gains, buy signals */
--red:        #eb5757;   /* losses, sell signals */
--amber:      #f2c94c;   /* warnings, mock mode */
--blue:       #56a3f0;   /* reserved, unused so far */
```

Warm neutrals throughout — no pure white, no pure gray. The accent gold is intentional: most financial UIs reach for blue or green; warm gold reads as "editorial" and "premium" without being garish.

## Typography

Three faces, each with a clear job:

- **Display: Fraunces** (variable serif). Headings, large numbers, occasional italic for accent. The italic variant is used liberally — it's where the "editorial" flavor comes from. Loaded from Google Fonts with optical sizing.
- **Body: Inter Tight** (sans). Anywhere body text appears. Tight tracking, modern.
- **Mono: JetBrains Mono.** All numbers, prices, percentages, tickers in compact contexts, labels. Strong opinion: never set prices in proportional fonts. Monospace makes them scannable in tables and reduces visual jitter on updates.

## Layout principles

- **Hairline borders, never shadows.** 1px lines at `--line` for separation. Shadows feel App Store; lines feel print.
- **Grid backgrounds for tables.** Use `gap: 1px; background: var(--line)` on the parent and solid backgrounds on cells to fake table borders cheaply.
- **Labels are uppercase mono at 10-11px with 1.5px letter-spacing.** They read as datelines and ticker tape, not as button labels.
- **Numbers in larger sizes (28px+) use Fraunces, not mono.** This is the one exception — display numbers want personality; data-table numbers want order.

## Motion

Minimal. Two specific moves:

- **Status dot pulse.** When connected live, the green dot pulses (2s ease in/out). Conveys "live data flowing" without being noisy.
- **Detail panel reveal.** `max-height` transition (0.3s ease) when expanding a stock row. Slides open vertically.

No page-load animations, no scroll-triggered effects, no parallax. This is a data tool, not a marketing site.

## Components that need design love when ported to React

- **Stock row + expanded detail.** Currently CSS grid with hand-tuned column widths. Will need to become a controlled component. Keep the grid; resist turning it into a wrapped card layout.
- **Trade modal.** Buy/sell toggle uses solid green/red active states. This is intentional — fast visual confirmation of intent matters when handling money.
- **Signals log.** Right rail, sticky positioning. Cards with time + message. Color the message text (green/red) not the whole card.
- **Disclaimer footer.** Dashed border, italic Fraunces. This visual language signals "advisory / read me carefully" without being a yellow warning box.

## What to avoid

- **Glassmorphism, neumorphism, "modern" gradients.** This UI is intentionally flat and architectural.
- **Emoji in UI labels.** The ⚙ and × are deliberately the only glyphs that aren't text. Don't add 📈 next to "Stocks" or similar.
- **Hover effects that move elements.** Buttons can change color; nothing should translate or scale on hover.
- **Bright/saturated buttons.** The accent gold is the brightest CTA color, and it's used sparingly. Resist the urge to make Buy buttons bright green by default.
- **Generic shadcn/ui out of the box.** If using shadcn, theme it heavily to match. Don't ship default styles.

## Reference

If the project ends up needing examples to point at: the visual lineage here is the printed Financial Times, classic Bloomberg Terminal, and the Sublime Text dark theme. Lots of intentional restraint.
