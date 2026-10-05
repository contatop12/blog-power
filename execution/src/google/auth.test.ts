import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GoogleApiError,
  clearGoogleTokenCache,
  getGoogleAccessToken,
  googleErrorFromResponse,
  googleFetch,
  type GoogleCredentials,
} from './auth.js'

const CREDS: GoogleCredentials = { clientId: 'cid', clientSecret: 'secret', refreshToken: '1//refresh-secreto' }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearGoogleTokenCache()
})

describe('getGoogleAccessToken', () => {
  it('troca o refresh token e reaproveita o access token enquanto ele vale', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ access_token: 'at-1', expires_in: 3599 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await getGoogleAccessToken(CREDS, 1_000)).toBe('at-1')
    expect(await getGoogleAccessToken(CREDS, 60_000)).toBe('at-1')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://oauth2.googleapis.com/token')
    const body = new URLSearchParams(String(init.body))
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('1//refresh-secreto')
  })

  it('renova quando falta menos de 1 minuto para expirar', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'at-1', expires_in: 100 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'at-2', expires_in: 3599 }))
    vi.stubGlobal('fetch', fetchMock)

    expect(await getGoogleAccessToken(CREDS, 0)).toBe('at-1')
    expect(await getGoogleAccessToken(CREDS, 50_000)).toBe('at-2')
  })

  it('invalid_grant vira mensagem acionável e não vaza o token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400)))

    const err = await getGoogleAccessToken(CREDS).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GoogleApiError)
    expect((err as GoogleApiError).message).toContain('gere um novo refresh token')
    expect((err as GoogleApiError).message).not.toContain('refresh-secreto')
    expect((err as GoogleApiError).reason).toBe('invalid_grant')
  })
})

describe('googleErrorFromResponse', () => {
  it('cota 0 explica que o projeto não tem acesso aprovado', async () => {
    const res = jsonResponse({
      error: {
        code: 429,
        status: 'RESOURCE_EXHAUSTED',
        message: 'Quota exceeded',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'RATE_LIMIT_EXCEEDED', metadata: { quota_limit_value: '0' } }],
      },
    }, 429)
    const err = await googleErrorFromResponse(res, 'Search Console')
    expect(err.status).toBe(429)
    expect(err.message).toBe('Search Console: cota 0 — o projeto do Google Cloud não tem acesso aprovado a esta API')
  })

  it('SERVICE_DISABLED pede para ativar a API no projeto', async () => {
    const res = jsonResponse({
      error: {
        code: 403,
        status: 'PERMISSION_DENIED',
        message: 'API has not been used in project 1 before or it is disabled.',
        details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED' }],
      },
    }, 403)
    const err = await googleErrorFromResponse(res, 'Search Console')
    expect(err.reason).toBe('SERVICE_DISABLED')
    expect(err.message).toBe('Search Console: API desativada no projeto do Google Cloud — ative-a no console')
  })

  it('erro do Google Ads usa o errorCode como motivo', async () => {
    const res = jsonResponse({
      error: {
        code: 403,
        status: 'PERMISSION_DENIED',
        message: 'The caller does not have permission',
        details: [{
          '@type': 'type.googleapis.com/google.ads.googleads.v25.errors.GoogleAdsFailure',
          errors: [{ errorCode: { authorizationError: 'CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION' }, message: 'The Google Cloud project is only approved for use with test accounts.' }],
        }],
      },
    }, 403)
    const err = await googleErrorFromResponse(res, 'Keyword Planner')
    expect(err.reason).toBe('authorizationError:CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION')
    expect(err.message).toBe('Keyword Planner: The Google Cloud project is only approved for use with test accounts.')
  })
})

describe('googleFetch', () => {
  it('envia o Bearer e devolve o JSON', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'at-9', expires_in: 3599 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)

    const data = await googleFetch<{ ok: boolean }>(CREDS, 'https://exemplo.googleapis.com/x', { method: 'POST', body: '{}' }, 'Teste')
    expect(data.ok).toBe(true)
    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer at-9')
    expect(headers['content-type']).toBe('application/json')
  })
})
