import type {
  Article,
  ArticleIdea,
  ArticleIdeaStatus,
  Client,
  ClientPost,
  ClientPostSummary,
  CorpusStatus,
  ConnectionCheckResult,
  ClientMaterial,
  CreateWpCategoryInput,
  DashboardPayload,
  Job,
  LoginResult,
  PerfilCliente,
  PerfilClienteView,
  UpdateWpCategoryInput,
  WpAuthorOption,
  WpCategoryOption,
  WpTagOption,
} from '@publisher-p12/types'
import { getAuthHeader } from './auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:8787'

async function apiFetch<T>(path: string, options: RequestInit = {}, skipAuth = false): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (!skipAuth) {
    const auth = getAuthHeader()
    if (auth) headers.Authorization = auth
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401 && !skipAuth) {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('publisher_auth')
      window.location.href = '/login'
    }
    throw new Error('Sessão expirada')
  }

  if (res.status === 429) {
    const err = await res.json().catch(() => ({}))
    const bloqueado = (err as { bloqueado_ate?: string }).bloqueado_ate
    throw new Error(
      bloqueado
        ? `Acesso bloqueado até ${new Date(bloqueado).toLocaleString('pt-BR')}`
        : 'Muitas tentativas. Tente novamente mais tarde.',
    )
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(
      (err as { error?: string; erro?: string }).error ??
        (err as { erro?: string }).erro ??
        'Erro na API',
    )
  }
  return res.json() as Promise<T>
}

export const api = {
  auth: {
    login: async (user: string, pass: string): Promise<LoginResult> => {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass }),
      })
      const data = (await res.json()) as LoginResult
      return data
    },
  },
  dashboard: {
    get: () => apiFetch<DashboardPayload>('/dashboard'),
  },
  clients: {
    list: () => apiFetch<Client[]>('/clients'),
    get: (id: string) => apiFetch<Client>(`/clients/${id}`),
    create: (body: unknown) => apiFetch<Client>('/clients', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      apiFetch<Client>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    testConnection: (id: string) =>
      apiFetch<ConnectionCheckResult>(`/clients/${id}/test-connection`, { method: 'POST' }),
    perfil: (id: string) => apiFetch<PerfilClienteView>(`/clients/${id}/perfil`),
    savePerfil: (id: string, perfil: PerfilCliente) =>
      apiFetch<PerfilClienteView>(`/clients/${id}/perfil`, {
        method: 'PUT',
        body: JSON.stringify(perfil),
      }),
    syncSitemap: (id: string) =>
      apiFetch<{ count: number; synced: number; duration_ms?: number; sitemaps_fetched?: number }>(
        `/clients/${id}/sync-sitemap`,
        { method: 'POST' },
      ),
    wpCategories: (id: string) => apiFetch<WpCategoryOption[]>(`/clients/${id}/wp/categories`),
    createWpCategory: (id: string, body: CreateWpCategoryInput) =>
      apiFetch<WpCategoryOption>(`/clients/${id}/wp/categories`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    updateWpCategory: (id: string, categoryId: number, body: UpdateWpCategoryInput) =>
      apiFetch<WpCategoryOption>(`/clients/${id}/wp/categories/${categoryId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    deleteWpCategory: (id: string, categoryId: number) =>
      apiFetch<{ ok: boolean }>(`/clients/${id}/wp/categories/${categoryId}`, {
        method: 'DELETE',
      }),
    wpTags: (id: string) => apiFetch<WpTagOption[]>(`/clients/${id}/wp/tags`),
    wpAuthors: (id: string) => apiFetch<WpAuthorOption[]>(`/clients/${id}/wp/authors`),
  },
  materials: {
    list: (clientId: string) => apiFetch<ClientMaterial[]>(`/clients/${clientId}/materials`),
    upload: (clientId: string, file: File) => {
      const form = new FormData()
      form.append('file', file)
      return apiFetch<ClientMaterial>(`/clients/${clientId}/materials`, {
        method: 'POST',
        body: form,
      })
    },
    delete: (clientId: string, materialId: string) =>
      apiFetch<{ ok: boolean }>(`/clients/${clientId}/materials/${materialId}`, {
        method: 'DELETE',
      }),
    download: async (clientId: string, materialId: string, filename: string) => {
      const res = await fetch(`${API_URL}/clients/${clientId}/materials/${materialId}/download`, {
        headers: { Authorization: getAuthHeader() },
      })
      if (!res.ok) throw new Error('Falha ao baixar arquivo')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    },
  },
  articles: {
    list: (params?: { client_id?: string; status?: string }) => {
      const q = new URLSearchParams()
      if (params?.client_id) q.set('client_id', params.client_id)
      if (params?.status) q.set('status', params.status)
      const qs = q.toString()
      return apiFetch<Article[]>(`/articles${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => apiFetch<Article>(`/articles/${id}`),
    create: (body: unknown) => apiFetch<Article>('/articles', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: unknown) =>
      apiFetch<Article>(`/articles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    generate: (id: string) =>
      apiFetch<{ job_id: string }>(`/articles/${id}/generate`, { method: 'POST' }),
    regenerateImage: (id: string) =>
      apiFetch<{ job_id: string }>(`/articles/${id}/regenerate-image`, { method: 'POST' }),
    publish: (id: string, body: unknown) =>
      apiFetch<{ job_id: string }>(`/articles/${id}/publish`, { method: 'POST', body: JSON.stringify(body) }),
  },
  corpus: {
    status: (clientId: string) => apiFetch<CorpusStatus>(`/clients/${clientId}/corpus/status`),
    list: (clientId: string, params?: { limit?: number; offset?: number; busca?: string }) => {
      const q = new URLSearchParams()
      if (params?.limit) q.set('limit', String(params.limit))
      if (params?.offset) q.set('offset', String(params.offset))
      if (params?.busca) q.set('busca', params.busca)
      const qs = q.toString()
      return apiFetch<ClientPostSummary[]>(`/clients/${clientId}/corpus${qs ? `?${qs}` : ''}`)
    },
    get: (clientId: string, postId: string) =>
      apiFetch<ClientPost>(`/clients/${clientId}/corpus/${postId}`),
    sync: (clientId: string, body?: { completo?: boolean; tipos?: Array<'post' | 'page'> }) =>
      apiFetch<{ job_id: string; status: string }>(`/clients/${clientId}/corpus/sync`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }),
  },
  pautas: {
    list: (clientId: string, status?: ArticleIdeaStatus) =>
      apiFetch<ArticleIdea[]>(
        `/clients/${clientId}/pautas${status ? `?status=${status}` : ''}`,
      ),
    gerar: (clientId: string, body?: { quantidade?: number; foco?: string }) =>
      apiFetch<{ job_id: string; status: string }>(`/clients/${clientId}/pautas/gerar`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }),
    setStatus: (clientId: string, ideaId: string, status: ArticleIdeaStatus) =>
      apiFetch<{ ok: boolean }>(`/clients/${clientId}/pautas/${ideaId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    criarArtigo: (clientId: string, ideaId: string) =>
      apiFetch<Article>(`/clients/${clientId}/pautas/${ideaId}/artigo`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  },
  jobs: {
    get: (id: string) => apiFetch<Job>(`/jobs/${id}`),
  },
}
