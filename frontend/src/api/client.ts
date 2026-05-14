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
    request<Record<string, unknown>[]>(`/api/orders?limit=${limit}&status=all`),
  getOrder: (id: string) => request<Record<string, unknown>>(`/api/orders/${id}`),
  submitOrder: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>('/api/orders', { method: 'POST', body: JSON.stringify(body) }),

  getSnapshots: (symbols: string[]) =>
    request<Record<string, unknown>>(`/api/snapshots?symbols=${symbols.join(',')}`),

  getBars: (symbol: string, days = 365) =>
    request<Record<string, unknown>[]>(`/api/bars/${symbol}?days=${days}`),

  getClock: () => request<Record<string, unknown>>('/api/clock'),

  getWatchlist: () => request<{ symbol: string; added_at: string }[]>('/api/watchlist'),
  addToWatchlist: (symbol: string) =>
    request<{ symbol: string; added_at: string }>('/api/watchlist', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    }),
  removeFromWatchlist: (symbol: string) =>
    request<void>(`/api/watchlist/${symbol}`, { method: 'DELETE' }),

  getIndicators: (symbol: string) =>
    request<Record<string, unknown>>(`/api/indicators/${symbol}`),

  getSignalHistory: (symbol: string, days = 30) =>
    request<Record<string, unknown>[]>(`/api/signals/history?symbol=${symbol}&days=${days}`),
}
