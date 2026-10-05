import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearGoogleTokenCache, type GoogleCredentials } from './auth.js'
import { GSC_PAGE_SIZE, gscWindow, listGscSites, queryGscSearchAnalytics } from './searchConsole.js'

const CREDS: GoogleCredentials = { clientId: 'c', clientSecret: 's', refreshToken: 'r' }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function row(q: string, i: number) {
  return { keys: [q, 'https://abxtelecom.com.br/'], clicks: 0, impressions: i, ctr: 0, position: 10 }
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearGoogleTokenCache()
})

describe('gscWindow', () => {
  it('termina 3 dias antes de hoje e cobre 28 dias', () => {
    expect(gscWindow(new Date('2026-10-05T12:00:00Z'))).toEqual({ startDate: '2026-09-05', endDate: '2026-10-02' })
  })
})

describe('listGscSites', () => {
  it('ignora propriedades não verificadas', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes('oauth2')) return jsonResponse({ access_token: 'at', expires_in: 3599 })
      return jsonResponse({
        siteEntry: [
          { siteUrl: 'https://abxtelecom.com.br/', permissionLevel: 'siteFullUser' },
          { siteUrl: 'sc-domain:themundomany.com', permissionLevel: 'siteUnverifiedUser' },
        ],
      })
    }))
    expect(await listGscSites(CREDS)).toEqual([{ siteUrl: 'https://abxtelecom.com.br/', permissionLevel: 'siteFullUser' }])
  })
})

describe('queryGscSearchAnalytics', () => {
  it('pagina com startRow até a última página e codifica o siteUrl', async () => {
    const pagina1 = Array.from({ length: GSC_PAGE_SIZE }, (_, i) => row(`q${i}`, 30))
    const pagina2 = [row('ultima', 25)]
    const chamadas: Array<{ url: string; body: Record<string, unknown> }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('oauth2')) return jsonResponse({ access_token: 'at', expires_in: 3599 })
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      chamadas.push({ url, body })
      return jsonResponse({ rows: body.startRow === 0 ? pagina1 : pagina2 })
    }))

    const rows = await queryGscSearchAnalytics(CREDS, 'sc-domain:lcoadv.com.br', {
      startDate: '2026-09-05',
      endDate: '2026-10-02',
      dimensions: ['query', 'page'],
    })

    expect(rows).toHaveLength(GSC_PAGE_SIZE + 1)
    expect(chamadas).toHaveLength(2)
    expect(chamadas[0].url).toBe('https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Alcoadv.com.br/searchAnalytics/query')
    expect(chamadas[1].body.startRow).toBe(GSC_PAGE_SIZE)
    expect(chamadas[0].body.dimensions).toEqual(['query', 'page'])
  })

  it('respeita maxRows', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes('oauth2')) return jsonResponse({ access_token: 'at', expires_in: 3599 })
      return jsonResponse({ rows: Array.from({ length: GSC_PAGE_SIZE }, (_, i) => row(`q${i}`, 30)) })
    }))
    const rows = await queryGscSearchAnalytics(CREDS, 'https://abxtelecom.com.br/', {
      startDate: '2026-09-05', endDate: '2026-10-02', dimensions: ['query'], maxRows: 100,
    })
    expect(rows).toHaveLength(100)
  })

  it('sem linhas devolve lista vazia', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes('oauth2')) return jsonResponse({ access_token: 'at', expires_in: 3599 })
      return jsonResponse({})
    }))
    expect(await queryGscSearchAnalytics(CREDS, 'https://x.com/', { startDate: '2026-09-05', endDate: '2026-10-02', dimensions: ['query'] })).toEqual([])
  })
})
