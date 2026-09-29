// Единая обёртка над fetch для всех обращений к API сервера.
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError((data as { error?: string }).error || `Ошибка ${res.status}`, res.status)
  return data as T
}

const body = (data: unknown) => JSON.stringify(data)

export const api = {
  auth: {
    me: () => json<{ user: unknown }>('/api/auth/me'),
    login: (email: string, password: string) =>
      json<{ user: unknown }>('/api/auth/login', { method: 'POST', body: body({ email, password }) }),
    logout: () => json<unknown>('/api/auth/logout', { method: 'POST' }),
  },
  journal: {
    list: () => json<{ entries: unknown[] }>('/api/journal'),
    create: (entry: unknown) => json<unknown>('/api/journal', { method: 'POST', body: body(entry) }),
    update: (id: string, entry: unknown) => json<unknown>(`/api/journal/${id}`, { method: 'PATCH', body: body(entry) }),
    remove: (id: string) => json<unknown>(`/api/journal/${id}`, { method: 'DELETE' }),
  },
  documents: {
    preview: (text: string) => json<unknown>('/api/documents/preview', { method: 'POST', body: body({ text }) }),
    create: (requestId: string, draft: unknown) =>
      json<unknown>('/api/documents/create', { method: 'POST', body: body({ requestId, draft }) }),
  },
  users: {
    list: () => json<{ users: unknown[] }>('/api/users'),
    create: (form: unknown) => json<unknown>('/api/users', { method: 'POST', body: body(form) }),
    update: (id: string, data: object) => json<unknown>(`/api/users/${id}`, { method: 'PATCH', body: body(data) }),
  },
}
