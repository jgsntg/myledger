export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return sign + n.toFixed(2) + '%'
}

export function deltaClass(n: number | null | undefined): string {
  if (!n || Math.abs(n) < 0.005) return 'flat'
  return n > 0 ? 'pos' : 'neg'
}

export function rsiNote(v: number | null): string {
  if (v === null || v === undefined) return 'Insufficient data'
  if (v < 30) return 'Oversold zone'
  if (v > 70) return 'Overbought zone'
  if (v < 45) return 'Bearish momentum'
  if (v > 55) return 'Bullish momentum'
  return 'Neutral'
}

export function macdNote(m: { histogram: number } | null): string {
  if (!m) return 'Insufficient data'
  if (m.histogram > 0) return 'Momentum positive'
  if (m.histogram < 0) return 'Momentum negative'
  return 'Crossing'
}

export function bbNote(price: number, bb: { upper: number; lower: number } | null): string {
  if (!bb) return 'Insufficient data'
  if (price > bb.upper) return 'Stretched above band'
  if (price < bb.lower) return 'Stretched below band'
  const pos = (price - bb.lower) / (bb.upper - bb.lower)
  return `Currently at ${(pos * 100).toFixed(0)}% of band range`
}
