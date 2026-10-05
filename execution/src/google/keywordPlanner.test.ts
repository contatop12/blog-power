import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearGoogleTokenCache } from './auth.js'
import { KP_CHUNK, getKeywordVolumes, keywordAceitaPeloAds, normalizeKeyword, type KeywordPlannerConfig } from './keywordPlanner.js'

const CFG: KeywordPlannerConfig = {
  creds: { clientId: 'c', clientSecret: 's', refreshToken: 'r' },
  developerToken: 'dev-token',
  loginCustomerId: '378-061-1396',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  clearGoogleTokenCache()
})

describe('normalizeKeyword', () => {
  it('ignora caixa, acento e espaços extras', () => {
    expect(normalizeKeyword('  Consultoria   de TI ')).toBe('consultoria de ti')
    expect(normalizeKeyword('Comunicação')).toBe('comunicacao')
  })
})

describe('getKeywordVolumes', () => {
  it('chama a MCC com developer-token e login-customer-id e converte int64 em número', async () => {
    const chamadas: Array<{ url: string; init: RequestInit }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('oauth2')) return jsonResponse({ access_token: 'at', expires_in: 3599 })
      chamadas.push({ url, init: init ?? {} })
      return jsonResponse({
        results: [
          { text: 'consultoria de ti', closeVariants: ['consultoria ti'], keywordMetrics: { avgMonthlySearches: '720', competition: 'MEDIUM' } },
          { text: 'comunicação unificada', keywordMetrics: { competition: 'LOW' } },
        ],
      })
    }))

    const volumes = await getKeywordVolumes(CFG, ['Consultoria de TI', 'consultoria de ti', 'comunicação unificada'])

    expect(chamadas).toHaveLength(1)
    expect(chamadas[0].url).toBe('https://googleads.googleapis.com/v25/customers/3780611396:generateKeywordHistoricalMetrics')
    const headers = chamadas[0].init.headers as Record<string, string>
    expect(headers['developer-token']).toBe('dev-token')
    expect(headers['login-customer-id']).toBe('3780611396')
    const body = JSON.parse(String(chamadas[0].init.body)) as { keywords: string[]; geoTargetConstants: string[]; language: string }
    expect(body.keywords).toEqual(['Consultoria de TI', 'comunicação unificada'])
    expect(body.geoTargetConstants).toEqual(['geoTargetConstants/2076'])
    expect(body.language).toBe('languageConstants/1014')

    expect(volumes.get('consultoria de ti')).toEqual({ keyword: 'consultoria de ti', volumeMensal: 720, concorrencia: 'MEDIUM' })
    expect(volumes.get('consultoria ti')?.volumeMensal).toBe(720)
    expect(volumes.get('comunicacao unificada')).toEqual({ keyword: 'comunicação unificada', volumeMensal: null, concorrencia: 'LOW' })
  })

  it('divide em lotes de KP_CHUNK palavras', async () => {
    let chamadasKp = 0
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      if (String(input).includes('oauth2')) return jsonResponse({ access_token: 'at', expires_in: 3599 })
      chamadasKp += 1
      return jsonResponse({ results: [] })
    }))
    const keywords = Array.from({ length: KP_CHUNK + 5 }, (_, i) => `termo ${i}`)
    await getKeywordVolumes(CFG, keywords)
    expect(chamadasKp).toBe(2)
  })

  it('lista vazia não chama a API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect((await getKeywordVolumes(CFG, [])).size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('keywordAceitaPeloAds', () => {
  it('aceita frase acentuada válida', () => {
    expect(keywordAceitaPeloAds('comunicação unificada para empresas')).toBe(true)
    expect(keywordAceitaPeloAds("d'água 24h & cia. a-b +1")).toBe(true)
  })
  it('recusa texto com mais de 80 caracteres', () => {
    expect(keywordAceitaPeloAds('a'.repeat(81))).toBe(false)
    expect(keywordAceitaPeloAds('a'.repeat(80))).toBe(true)
  })
  it('recusa mais de 10 palavras', () => {
    expect(keywordAceitaPeloAds('a b c d e f g h i j k')).toBe(false)
    expect(keywordAceitaPeloAds('a b c d e f g h i j')).toBe(true)
  })
  it('recusa símbolos não suportados', () => {
    expect(keywordAceitaPeloAds('email@dominio')).toBe(false)
    expect(keywordAceitaPeloAds('o que é voip?')).toBe(false)
    expect(keywordAceitaPeloAds('<script>')).toBe(false)
  })
})

describe('getKeywordVolumes com palavras inválidas', () => {
  it('não envia as recusadas e não chama a API se todas forem recusadas', async () => {
    const corpos: Array<{ keywords: string[] }> = []
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).includes('oauth2')) return jsonResponse({ access_token: 'at', expires_in: 3599 })
      corpos.push(JSON.parse(String(init?.body)))
      return jsonResponse({ results: [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    await getKeywordVolumes(CFG, ['voip empresarial', 'o que é voip?', 'x'.repeat(90)])
    expect(corpos).toHaveLength(1)
    expect(corpos[0].keywords).toEqual(['voip empresarial'])

    fetchMock.mockClear()
    const vazio = await getKeywordVolumes(CFG, ['a@b', 'quê?'])
    expect(vazio.size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
