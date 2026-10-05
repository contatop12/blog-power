/** OAuth das contas Google da agência (refresh token → access token) e erros legíveis das APIs Google. */

export interface GoogleCredentials {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export class GoogleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string | null,
  ) {
    super(message)
    this.name = 'GoogleApiError'
  }
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const RENOVAR_ANTES_MS = 60_000

const tokenCache = new Map<string, { token: string; expiresAt: number }>()

export function clearGoogleTokenCache(): void {
  tokenCache.clear()
}

interface GoogleErrorBody {
  error?:
    | string
    | {
        code?: number
        status?: string
        message?: string
        details?: Array<{
          '@type'?: string
          reason?: string
          metadata?: Record<string, string>
          errors?: Array<{ errorCode?: Record<string, string>; message?: string }>
        }>
      }
  error_description?: string
}

export async function googleErrorFromResponse(res: Response, api: string): Promise<GoogleApiError> {
  const body = (await res.json().catch(() => ({}))) as GoogleErrorBody

  // Endpoint OAuth: { error: 'invalid_grant', error_description: '...' }
  if (typeof body.error === 'string') {
    if (body.error === 'invalid_grant') {
      return new GoogleApiError(
        `${api}: token Google expirado ou revogado — gere um novo refresh token`,
        res.status,
        'invalid_grant',
      )
    }
    return new GoogleApiError(`${api}: ${body.error_description ?? body.error}`, res.status, body.error)
  }

  const err = body.error ?? {}
  const details = err.details ?? []
  const info = details.find((d) => d['@type']?.endsWith('ErrorInfo'))
  const adsError = details.find((d) => Array.isArray(d.errors))?.errors?.[0]

  if (info?.metadata?.quota_limit_value === '0') {
    return new GoogleApiError(
      `${api}: cota 0 — o projeto do Google Cloud não tem acesso aprovado a esta API`,
      res.status,
      info.reason ?? 'QUOTA_ZERO',
    )
  }
  if (info?.reason === 'SERVICE_DISABLED') {
    return new GoogleApiError(
      `${api}: API desativada no projeto do Google Cloud — ative-a no console`,
      res.status,
      'SERVICE_DISABLED',
    )
  }
  if (adsError?.errorCode) {
    const [tipo, codigo] = Object.entries(adsError.errorCode)[0] ?? ['erro', 'desconhecido']
    return new GoogleApiError(`${api}: ${adsError.message ?? codigo}`, res.status, `${tipo}:${codigo}`)
  }
  return new GoogleApiError(
    `${api}: ${err.message ?? `HTTP ${res.status}`}`,
    res.status,
    info?.reason ?? err.status ?? null,
  )
}

export async function getGoogleAccessToken(creds: GoogleCredentials, now = Date.now()): Promise<string> {
  const cached = tokenCache.get(creds.refreshToken)
  if (cached && cached.expiresAt - RENOVAR_ANTES_MS > now) return cached.token

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  })
  if (!res.ok) throw await googleErrorFromResponse(res, 'OAuth Google')

  const data = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache.set(creds.refreshToken, { token: data.access_token, expiresAt: now + data.expires_in * 1000 })
  return data.access_token
}

export async function googleFetch<T>(
  creds: GoogleCredentials,
  url: string,
  init: RequestInit,
  api: string,
): Promise<T> {
  const token = await getGoogleAccessToken(creds)
  const headers: Record<string, string> = {
    ...((init.headers as Record<string, string> | undefined) ?? {}),
    authorization: `Bearer ${token}`,
  }
  if (init.body && !headers['content-type']) headers['content-type'] = 'application/json'

  const res = await fetch(url, { ...init, headers })
  if (!res.ok) throw await googleErrorFromResponse(res, api)
  return (await res.json()) as T
}
