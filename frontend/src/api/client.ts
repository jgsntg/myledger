import type {
  Alert,
  Bar,
  ClockData,
  FilerHolding,
  FilerRefreshResult,
  FilerTransaction,
  Indicators,
  Order,
  TrackedFiler,
  WatchlistEntry,
} from '../types'

const TOKEN = import.meta.env.VITE_API_TOKEN ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  getAccount: () => request<Record<string, unknown>>('/api/account'),
  getPositions: () => request<Record<string, unknown>[]>('/api/positions'),
  getOrders: (limit = 20) =>
    request<Order[]>(`/api/orders?limit=${limit}&status=all`),
  getOrder: (id: string) => request<Record<string, unknown>>(`/api/orders/${id}`),
  submitOrder: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/orders', { method: 'POST', body: JSON.stringify(body) }),

  getSnapshots: (symbols: string[]) =>
    request<Record<string, unknown>>(`/api/snapshots?symbols=${symbols.join(',')}`),

  getBars: (symbol: string, days = 365) =>
    request<Bar[]>(`/api/bars/${symbol}?days=${days}`),

  getClock: () => request<ClockData>('/api/clock'),

  getWatchlist: () => request<WatchlistEntry[]>('/api/watchlist'),
  addToWatchlist: (symbol: string) =>
    request<{ symbol: string; added_at: string }>('/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    }),
  removeFromWatchlist: (symbol: string) =>
    request<void>(`/api/watchlist/${symbol}`, { method: 'DELETE' }),

  getIndicators: (symbol: string) =>
    request<Indicators>(`/api/indicators/${symbol}`),

  getSignalHistory: (symbol: string, days = 30) =>
    request<Record<string, unknown>[]>(`/api/signals/history?symbol=${symbol}&days=${days}`),

  getAlerts: () => request<Alert[]>('/api/alerts'),
  createAlert: (body: { symbol: string; condition: string; threshold: number }) =>
    request<Record<string, unknown>>('/api/alerts', { method: 'POST', body: JSON.stringify(body) }),
  updateAlert: (id: number, body: { active?: boolean; threshold?: number }) =>
    request<Record<string, unknown>>(`/api/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAlert: (id: number) =>
    request<void>(`/api/alerts/${id}`, { method: 'DELETE' }),

  getFilers: () => request<TrackedFiler[]>('/api/filers'),
  createFiler: (body: { name: string; filer_type: string; source_id: string }) =>
    request<TrackedFiler>('/api/filers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteFiler: (id: number) =>
    request<void>(`/api/filers/${id}`, { method: 'DELETE' }),
  refreshFiler: (id: number) =>
    request<FilerRefreshResult>(`/api/filers/${id}/refresh`, { method: 'POST' }),
  getFilerTransactions: (id: number) =>
    request<FilerTransaction[]>(`/api/filers/${id}/transactions`),
  getFilerHoldings: (id: number) =>
    request<FilerHolding[]>(`/api/filers/${id}/holdings`),
}
