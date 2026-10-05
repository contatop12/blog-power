# Radar — Fatia 1: Search Console + Keyword Planner → Oportunidades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Para cada cliente, ligar a propriedade do Search Console, calcular as oportunidades "quick win" (buscas em que o site já aparece entre as posições 4 e 20) enriquecidas com o volume real do Keyword Planner, deixar a equipe transformar cada uma em pauta, alimentar o Pauteiro com essa demanda real e registrar o custo de cada chamada de LLM.

**Architecture:** Clientes Google determinísticos e testáveis em `execution/src/google/` (OAuth, Search Console, Keyword Planner). Cálculo puro em `execution/src/opportunities/`. Persistência em D1 (`client_google`, `opportunities`, `llm_usage`). Rotas Hono em `workers/api/src/routes/google.ts`, com a sincronização rodando dentro da própria requisição, como já acontece com o sync de sitemap. O Pauteiro do `workers/pipeline` recebe as 20 melhores oportunidades. A UI ganha a aba "Google" na página do cliente.

**Tech Stack:** TypeScript, Cloudflare Workers (Hono), D1, Vitest 2, Next.js 15. APIs usadas: Google Search Console API v3 (webmasters), Google Ads API v25 (`generateKeywordHistoricalMetrics`) e OpenRouter (campo `usage`).

**Spec:** `C:\Users\rya_p\Downloads\PLANO_RADAR_V3.md`: §3 (oportunidades e scoring), §10 (Search Console), §17 (observabilidade e custo), §20.1 (APIs Google) e §22.0 (semana 3 do MVP). As decisões tomadas na sessão de 30/09 a 05/10/2026 estão na seção "Decisões já tomadas" abaixo.

## Decisões já tomadas (valem como spec)

- **Não migrar a stack.** O Radar evolui dentro do blog-power: `execution/` faz o papel de `packages/*` e os workers de `apps/*`.
- **Credenciais Google no `.env` / Secrets.** Os nomes são escolhidos pelo usuário. **Não renomear e não criar nomes novos.**
  - Conta **contato** (contato@p12digital.com.br): `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_DEVELOPER_TOKEN`. Client do projeto 253030348436, aprovado para Ads e GBP. Escopos: adwords, business.manage e webmasters.readonly. O Search Console dessa conta inclui a ABX (`https://abxtelecom.com.br/`).
  - Conta **ryan** (ryansantiago@p12digital.com.br): `GOOGLE_DATA_CLIENT_ID`, `GOOGLE_DATA_CLIENT_SECRET`, `GOOGLE_DATA_REFRESH_TOKEN`. Escopos: webmasters.readonly, analytics.readonly, tagmanager.readonly e spreadsheets.readonly. Search Console com 6 propriedades **sem** a ABX.
  - MCC do Google Ads: `3780611396`. Testado em 02/10/2026: com a conta contato, o Keyword Planner retorna volume real usando o `login-customer-id` da MCC.
- **Cada cliente guarda qual conta enxerga a sua propriedade** (`gsc_conta`: `'contato' | 'ryan'`).
- **Quick win** = posição média entre 4 e 20, pelo menos 20 impressões em 28 dias e busca que não seja de marca.
- **Fora desta fatia:** GA4, GBP, crawler/auditoria técnica, reotimização de página existente e monitor de IA. Cada um terá plano próprio.

## Global Constraints

- Chamadas ao Google **somente no backend** (Workers); nunca no browser. Tokens e secrets nunca são retornados pela API nem gravados em log ou mensagem de erro.
- Variáveis de ambiente: exatamente `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_DATA_CLIENT_ID`, `GOOGLE_DATA_CLIENT_SECRET`, `GOOGLE_DATA_REFRESH_TOKEN`, mais a var não secreta `GOOGLE_ADS_LOGIN_CUSTOMER_ID` = `3780611396`.
- Google Ads API: versão `v25`. Brasil = `geoTargetConstants/2076`; português = `languageConstants/1014`.
- Pacotes: `@publisher-p12/execution` e `@publisher-p12/types`. Imports internos do `execution` usam extensão `.js`; o pacote `types` não usa extensão.
- Testes: Vitest, arquivo `*.test.ts` ao lado da fonte, descrições em português, `fetch` simulado com `vi.stubGlobal('fetch', vi.fn(...))` e `vi.unstubAllGlobals()` no `afterEach`. D1 simulado com o `FakeD1`, que registra o SQL.
- Toda tabela nova entra em quatro lugares: `schema.sql`, `migrations/009_radar_google_oportunidades.sql`, `execution/src/cloudflare/migrations.ts` (`D1_BOOTSTRAP_STATEMENTS` + `REQUIRED_TABLES`) e `applyD1Upgrades` em `execution/src/cloudflare/d1Setup.ts`.
- **`execution/src/openrouter/client.ts` e `client.test.ts` têm trabalho do usuário não commitado.** Não reverter nem reformatar o que já está lá; só acrescentar. Não editar `client.test.ts`; testes novos vão em arquivo novo.
- **Commits só com autorização do usuário.** Se autorizado, usar a branch `feat/radar-fatia1` e não incluir os arquivos de WIP do usuário (`directives/editor_seo_geo.md`, `frontend/server.js`, `execution/src/openrouter/client.test.ts`). `client.ts` só entra no commit com o ok do usuário, porque misturaria o WIP dele.
- **Não criar diretiva nova sem permissão** (CLAUDE.md). A Task 11 só cria `directives/oportunidades_google.md` se o usuário aprovar este plano com ela.
- Textos de UI e mensagens de erro em pt-BR.

## Review Focus

1. **Keyword Planner falha** (acesso de teste, cota ou erro em MCC): a sincronização tem que terminar com as oportunidades salvas, `volume_mensal = null` e `keyword_planner_erro` preenchido. Não pode virar erro 502. Teste na Task 6.
2. **Refresh token revogado ou expirado** (`invalid_grant`): a mensagem deve dizer "gere um novo refresh token" e nunca conter o token. Teste na Task 1.
3. **Uma nova sincronização não pode ressuscitar oportunidades** descartadas ou já em pauta: o `ON CONFLICT ... DO UPDATE` nunca altera `status`, e só oportunidades `nova` de janelas antigas são apagadas. Teste na Task 5.
4. **Buscas de marca** ("abx telecom", "abxtelecom") não são quick win e devem ser excluídas. Teste na Task 4.
5. **A mesma busca com e sem acento ou espaço** ("consultoria de ti" e "consultoria de TI ") vira uma única oportunidade, com impressões somadas e posição ponderada. Teste na Task 4.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `types/src/index.ts` (modificar) | Tipos compartilhados: `GoogleConta`, `ClientGoogle`, `GscSiteOption`, `ClientGoogleView`, `Oportunidade*`, `SyncOportunidadesResult` |
| `execution/src/google/auth.ts` | Troca do refresh token pelo access token com cache, `GoogleApiError` e `googleFetch` |
| `execution/src/google/searchConsole.ts` | Lista sites, consulta Search Analytics com paginação e calcula a janela de datas |
| `execution/src/google/keywordPlanner.ts` | Volumes do Keyword Planner (`generateKeywordHistoricalMetrics`) |
| `execution/src/opportunities/quickWins.ts` | Funções puras: normalização, agregação por busca, filtro de marca, seleção e score |
| `execution/src/opportunities/store.ts` | D1: vínculo Google do cliente, CRUD de oportunidades e criação de pauta |
| `execution/src/opportunities/sync.ts` | Orquestra Search Console → quick wins → Keyword Planner → lista final |
| `execution/src/usage/llmUsage.ts` | Grava cada chamada de LLM em `llm_usage` |
| `execution/src/test-support/fakeD1.ts` | `FakeD1` compartilhado entre testes, extraído de `corpus/store.test.ts` |
| `execution/src/openrouter/client.ts` (acrescentar) | `onUsage` + `usage: { include: true }` |
| `execution/src/openrouter/{pesquisador,redator,editor,revisor,pauteiro}.ts` (modificar) | Repassar `onUsage`. O pauteiro também recebe `oportunidades` |
| `execution/src/index.ts` (modificar) | Exportar os módulos novos |
| `execution/src/cloudflare/migrations.ts`, `d1Setup.ts` (modificar) | Bootstrap e upgrade das 3 tabelas |
| `schema.sql`, `migrations/009_radar_google_oportunidades.sql` | DDL |
| `workers/api/src/lib/google.ts` | Credenciais por conta a partir do env, configuração do Keyword Planner e termos de marca do cliente |
| `workers/api/src/routes/google.ts` | Rotas `/clients/:id/google` e `/clients/:id/oportunidades*` |
| `workers/api/src/bindings.ts`, `workers/api/src/index.ts` (modificar) | Env novo e montagem do router |
| `workers/pipeline/src/index.ts` (modificar) | Oportunidades no Pauteiro e `onUsage` em todos os agentes |
| `frontend/lib/api.ts` (modificar), `frontend/components/google-panel.tsx`, `frontend/app/clients/[id]/page.tsx` (modificar) | Aba "Google" |
| `scripts/push-worker-secrets.mjs`, `wrangler.jsonc`, `workers/api/wrangler.jsonc`, `.env.example`, `package.json` (modificar) | Configuração |

---

### Task 1: Núcleo OAuth Google e erros

**Files:**
- Create: `execution/src/google/auth.ts`
- Test: `execution/src/google/auth.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface GoogleCredentials { clientId: string; clientSecret: string; refreshToken: string }`
  - `class GoogleApiError extends Error { status: number; reason: string | null }`
  - `googleErrorFromResponse(res: Response, api: string): Promise<GoogleApiError>`
  - `getGoogleAccessToken(creds: GoogleCredentials, now?: number): Promise<string>`
  - `clearGoogleTokenCache(): void`
  - `googleFetch<T>(creds: GoogleCredentials, url: string, init: RequestInit, api: string): Promise<T>`

- [ ] **Step 1: Write the failing test**

```ts
// execution/src/google/auth.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run execution/src/google/auth.test.ts`
Expected: FAIL with "Failed to resolve import './auth.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// execution/src/google/auth.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run execution/src/google/auth.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit (somente se o usuário autorizou commits)**

```bash
git add execution/src/google/auth.ts execution/src/google/auth.test.ts
git commit -m "feat(google): oauth com cache e erros legíveis das APIs Google"
```

---

### Task 2: Cliente do Search Console

**Files:**
- Create: `execution/src/google/searchConsole.ts`
- Test: `execution/src/google/searchConsole.test.ts`

**Interfaces:**
- Consumes: `GoogleCredentials`, `googleFetch` (Task 1).
- Produces:
  - `interface GscSite { siteUrl: string; permissionLevel: string }`
  - `listGscSites(creds: GoogleCredentials): Promise<GscSite[]>`: devolve só propriedades verificadas
  - `interface GscRow { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }`
  - `type GscDimension = 'query' | 'page' | 'date' | 'device' | 'country'`
  - `interface GscQuery { startDate: string; endDate: string; dimensions: GscDimension[]; maxRows?: number }`
  - `queryGscSearchAnalytics(creds: GoogleCredentials, siteUrl: string, q: GscQuery): Promise<GscRow[]>`
  - `gscWindow(today: Date, days?: number, lagDays?: number): { startDate: string; endDate: string }`

- [ ] **Step 1: Write the failing test**

```ts
// execution/src/google/searchConsole.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run execution/src/google/searchConsole.test.ts`
Expected: FAIL with "Failed to resolve import './searchConsole.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// execution/src/google/searchConsole.ts
/** Google Search Console API v3 (webmasters): propriedades e Search Analytics. */
import { googleFetch, type GoogleCredentials } from './auth.js'

const GSC_BASE = 'https://www.googleapis.com/webmasters/v3'
/** Máximo de linhas por requisição aceito pela API. */
export const GSC_PAGE_SIZE = 25_000
const DEFAULT_MAX_ROWS = 50_000

export interface GscSite {
  siteUrl: string
  permissionLevel: string
}

export interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GscDimension = 'query' | 'page' | 'date' | 'device' | 'country'

export interface GscQuery {
  startDate: string
  endDate: string
  dimensions: GscDimension[]
  /** Teto de linhas somando as páginas. Padrão 50 000. */
  maxRows?: number
}

export async function listGscSites(creds: GoogleCredentials): Promise<GscSite[]> {
  const data = await googleFetch<{ siteEntry?: GscSite[] }>(creds, `${GSC_BASE}/sites`, { method: 'GET' }, 'Search Console')
  return (data.siteEntry ?? []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
}

export async function queryGscSearchAnalytics(
  creds: GoogleCredentials,
  siteUrl: string,
  q: GscQuery,
): Promise<GscRow[]> {
  const maxRows = q.maxRows ?? DEFAULT_MAX_ROWS
  const url = `${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const rows: GscRow[] = []

  for (let startRow = 0; rows.length < maxRows; startRow += GSC_PAGE_SIZE) {
    const rowLimit = Math.min(GSC_PAGE_SIZE, maxRows - rows.length)
    const data = await googleFetch<{ rows?: GscRow[] }>(
      creds,
      url,
      {
        method: 'POST',
        body: JSON.stringify({
          startDate: q.startDate,
          endDate: q.endDate,
          dimensions: q.dimensions,
          rowLimit,
          startRow,
        }),
      },
      'Search Console',
    )
    const page = data.rows ?? []
    rows.push(...page)
    if (page.length < rowLimit) break
  }
  return rows.slice(0, maxRows)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Janela padrão: os dados do Search Console chegam com ~3 dias de atraso. */
export function gscWindow(today: Date, days = 28, lagDays = 3): { startDate: string; endDate: string } {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - lagDays))
  const start = new Date(end.getTime() - (days - 1) * 86_400_000)
  return { startDate: isoDate(start), endDate: isoDate(end) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run execution/src/google/searchConsole.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit (somente se autorizado)**

```bash
git add execution/src/google/searchConsole.ts execution/src/google/searchConsole.test.ts
git commit -m "feat(google): cliente do Search Console com paginação"
```

---

### Task 3: Keyword Planner (volumes históricos)

**Files:**
- Create: `execution/src/google/keywordPlanner.ts`
- Test: `execution/src/google/keywordPlanner.test.ts`

**Interfaces:**
- Consumes: `GoogleCredentials`, `googleFetch` (Task 1).
- Produces:
  - `GOOGLE_ADS_API_VERSION = 'v25'`, `GEO_BRASIL = 'geoTargetConstants/2076'`, `IDIOMA_PORTUGUES = 'languageConstants/1014'`
  - `interface KeywordPlannerConfig { creds: GoogleCredentials; developerToken: string; loginCustomerId: string; customerId?: string }`
  - `interface KeywordVolume { keyword: string; volumeMensal: number | null; concorrencia: string | null }`
  - `normalizeKeyword(k: string): string`
  - `getKeywordVolumes(cfg: KeywordPlannerConfig, keywords: string[], opts?: { geo?: string; idioma?: string }): Promise<Map<string, KeywordVolume>>`: chave = `normalizeKeyword(keyword)`

- [ ] **Step 1: Write the failing test**

```ts
// execution/src/google/keywordPlanner.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearGoogleTokenCache } from './auth.js'
import { KP_CHUNK, getKeywordVolumes, normalizeKeyword, type KeywordPlannerConfig } from './keywordPlanner.js'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run execution/src/google/keywordPlanner.test.ts`
Expected: FAIL with "Failed to resolve import './keywordPlanner.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// execution/src/google/keywordPlanner.ts
/** Google Ads API: volume mensal das buscas (Keyword Planner, métricas históricas). */
import { googleFetch, type GoogleCredentials } from './auth.js'

export const GOOGLE_ADS_API_VERSION = 'v25'
export const GEO_BRASIL = 'geoTargetConstants/2076'
export const IDIOMA_PORTUGUES = 'languageConstants/1014'
/** Palavras por requisição (a API aceita mais; lote menor reduz o impacto de um erro). */
export const KP_CHUNK = 1000

export interface KeywordPlannerConfig {
  creds: GoogleCredentials
  developerToken: string
  /** MCC da agência, com ou sem hífens. */
  loginCustomerId: string
  /** Conta consultada; padrão = a própria MCC. */
  customerId?: string
}

export interface KeywordVolume {
  keyword: string
  volumeMensal: number | null
  concorrencia: string | null
}

interface HistoricalMetricsResponse {
  results?: Array<{
    text: string
    closeVariants?: string[]
    keywordMetrics?: { avgMonthlySearches?: string | number; competition?: string }
  }>
}

export function normalizeKeyword(k: string): string {
  return k
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const soDigitos = (id: string) => id.replace(/\D/g, '')

export async function getKeywordVolumes(
  cfg: KeywordPlannerConfig,
  keywords: string[],
  opts: { geo?: string; idioma?: string } = {},
): Promise<Map<string, KeywordVolume>> {
  const volumes = new Map<string, KeywordVolume>()

  const unicas: string[] = []
  const vistas = new Set<string>()
  for (const k of keywords) {
    const norm = normalizeKeyword(k)
    if (!norm || vistas.has(norm)) continue
    vistas.add(norm)
    unicas.push(k.trim())
  }
  if (unicas.length === 0) return volumes

  const login = soDigitos(cfg.loginCustomerId)
  const customer = soDigitos(cfg.customerId ?? cfg.loginCustomerId)
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customer}:generateKeywordHistoricalMetrics`

  for (let i = 0; i < unicas.length; i += KP_CHUNK) {
    const lote = unicas.slice(i, i + KP_CHUNK)
    const data = await googleFetch<HistoricalMetricsResponse>(
      cfg.creds,
      url,
      {
        method: 'POST',
        headers: { 'developer-token': cfg.developerToken, 'login-customer-id': login },
        body: JSON.stringify({
          keywords: lote,
          language: opts.idioma ?? IDIOMA_PORTUGUES,
          geoTargetConstants: [opts.geo ?? GEO_BRASIL],
          keywordPlanNetwork: 'GOOGLE_SEARCH',
        }),
      },
      'Keyword Planner',
    )
    for (const r of data.results ?? []) {
      const bruto = r.keywordMetrics?.avgMonthlySearches
      const volume: KeywordVolume = {
        keyword: r.text,
        volumeMensal: bruto === undefined || bruto === null ? null : Number(bruto),
        concorrencia: r.keywordMetrics?.competition ?? null,
      }
      volumes.set(normalizeKeyword(r.text), volume)
      for (const variante of r.closeVariants ?? []) {
        const chave = normalizeKeyword(variante)
        if (!volumes.has(chave)) volumes.set(chave, volume)
      }
    }
  }
  return volumes
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run execution/src/google/keywordPlanner.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Smoke test real (somente leitura, sem custo)**

Rode na raiz, com o `.env` preenchido. O resultado esperado é um mapa com volumes, por exemplo `consultoria de ti → 720`.

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split(/\r?\n/).map(l=>l.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^[\"']|[\"']$/g,'')]));
const { getKeywordVolumes } = await import('./execution/src/google/keywordPlanner.ts');
const v = await getKeywordVolumes({ creds:{clientId:env.GOOGLE_ADS_CLIENT_ID,clientSecret:env.GOOGLE_ADS_CLIENT_SECRET,refreshToken:env.GOOGLE_ADS_REFRESH_TOKEN}, developerToken:env.GOOGLE_ADS_DEVELOPER_TOKEN, loginCustomerId:'3780611396' }, ['consultoria de ti','comunicação unificada']);
console.log([...v.entries()]);
"
```

Se o erro vier de `generateKeywordHistoricalMetrics` na MCC (por exemplo `REQUESTED_METRICS_FOR_MANAGER`), passe `customerId` com uma conta filha ativa da MCC e registre o achado na diretiva da Task 11.

- [ ] **Step 6: Commit (somente se autorizado)**

```bash
git add execution/src/google/keywordPlanner.ts execution/src/google/keywordPlanner.test.ts
git commit -m "feat(google): volumes do Keyword Planner via métricas históricas"
```

---

### Task 4: Cálculo de quick wins (puro)

**Files:**
- Create: `execution/src/opportunities/quickWins.ts`
- Test: `execution/src/opportunities/quickWins.test.ts`

**Interfaces:**
- Consumes: `GscRow` (Task 2), `KeywordVolume` e `normalizeKeyword` (Task 3).
- Produces:
  - `interface QueryAgg { query: string; queryNorm: string; page: string | null; clicks: number; impressions: number; ctr: number; position: number }`
  - `aggregateByQuery(rows: GscRow[]): QueryAgg[]`: espera linhas com dimensões `['query','page']`
  - `marcaTermos(nome: string, dominio: string): string[]`
  - `isMarca(query: string, termos: string[]): boolean`
  - `interface QuickWinOptions { posMin?: number; posMax?: number; minImpressoes?: number; limite?: number; marca?: string[] }`
  - `selectQuickWins(aggs: QueryAgg[], opts?: QuickWinOptions): QueryAgg[]`
  - `scoreQuickWin(agg: QueryAgg, volumeMensal: number | null): number`: de 0 a 100
  - `interface OportunidadeCalculada { query: string; query_norm: string; page_url: string | null; posicao: number; impressoes: number; cliques: number; ctr: number; volume_mensal: number | null; concorrencia: string | null; score: number }`
  - `buildOportunidades(candidatos: QueryAgg[], volumes: Map<string, KeywordVolume>): OportunidadeCalculada[]`: ordenado por score decrescente

- [ ] **Step 1: Write the failing test**

```ts
// execution/src/opportunities/quickWins.test.ts
import { describe, expect, it } from 'vitest'
import type { GscRow } from '../google/searchConsole.js'
import type { KeywordVolume } from '../google/keywordPlanner.js'
import {
  aggregateByQuery,
  buildOportunidades,
  isMarca,
  marcaTermos,
  scoreQuickWin,
  selectQuickWins,
  type QueryAgg,
} from './quickWins.js'

function r(query: string, page: string, impressions: number, position: number, clicks = 0): GscRow {
  return { keys: [query, page], clicks, impressions, ctr: impressions ? clicks / impressions : 0, position }
}

function agg(over: Partial<QueryAgg> = {}): QueryAgg {
  return { query: 'consultoria de ti', queryNorm: 'consultoria de ti', page: 'https://abx/ti', clicks: 0, impressions: 100, ctr: 0, position: 10, ...over }
}

describe('aggregateByQuery', () => {
  it('junta variações de acento/caixa, soma impressões e pondera a posição', () => {
    const out = aggregateByQuery([
      r('Consultoria de TI', 'https://abx/ti', 60, 10, 1),
      r('consultoria de ti ', 'https://abx/blog', 20, 30),
      r('comunicação unificada', 'https://abx/uc', 121, 11.8),
    ])
    const ti = out.find((a) => a.queryNorm === 'consultoria de ti')!
    expect(ti.impressions).toBe(80)
    expect(ti.clicks).toBe(1)
    expect(ti.position).toBeCloseTo((60 * 10 + 20 * 30) / 80)
    expect(ti.page).toBe('https://abx/ti')
    expect(ti.query).toBe('Consultoria de TI')
    expect(ti.ctr).toBeCloseTo(1 / 80)
  })
})

describe('marca', () => {
  it('gera termos do nome e do domínio e reconhece buscas de marca', () => {
    const termos = marcaTermos('Abxtelecom', 'https://abxtelecom.com.br/')
    expect(termos).toEqual(['abxtelecom'])
    expect(isMarca('abx telecom', termos)).toBe(true)
    expect(isMarca('ABXTelecom internet', termos)).toBe(true)
    expect(isMarca('telecom', termos)).toBe(false)
    expect(isMarca('consultoria de ti', termos)).toBe(false)
  })

  it('nome composto vira termo compacto', () => {
    expect(marcaTermos('Persianas Paulista', 'https://persianaspaulista.com.br/')).toEqual(['persianaspaulista'])
  })

  it('subdomínio não vira marca: usa o domínio registrável', () => {
    expect(marcaTermos('Vita Audio', 'https://audicao.vitaaudio.com.br/')).toEqual(['vitaaudio'])
    const taina = marcaTermos('Dra. Tainã Aci', 'https://endocrinologista.tainaaci.com.br/')
    expect(taina).toEqual(['dratainaaci', 'tainaaci'])
    expect(isMarca('endocrinologista em são paulo', taina)).toBe(false)
    expect(isMarca('aparelho de audição', marcaTermos('Vita Audio', 'https://audicao.vitaaudio.com.br/'))).toBe(false)
  })
})

describe('selectQuickWins', () => {
  it('fica só com posição 4–20, impressões mínimas e sem marca, ordenado por impressões', () => {
    const lista = [
      agg({ queryNorm: 'a', query: 'a', position: 3.9, impressions: 500 }),
      agg({ queryNorm: 'b', query: 'b', position: 4, impressions: 30 }),
      agg({ queryNorm: 'c', query: 'c', position: 20, impressions: 200 }),
      agg({ queryNorm: 'd', query: 'd', position: 20.1, impressions: 999 }),
      agg({ queryNorm: 'e', query: 'e', position: 8, impressions: 19 }),
      agg({ queryNorm: 'abx telecom', query: 'abx telecom', position: 5, impressions: 900 }),
    ]
    const out = selectQuickWins(lista, { marca: ['abxtelecom'] })
    expect(out.map((a) => a.queryNorm)).toEqual(['c', 'b'])
  })

  it('respeita o limite', () => {
    const lista = Array.from({ length: 10 }, (_, i) => agg({ queryNorm: `q${i}`, query: `q${i}`, impressions: 100 + i }))
    expect(selectQuickWins(lista, { limite: 3 })).toHaveLength(3)
  })
})

describe('scoreQuickWin', () => {
  it('fica entre 0 e 100', () => {
    expect(scoreQuickWin(agg(), 720)).toBeGreaterThan(0)
    expect(scoreQuickWin(agg({ impressions: 1_000_000, position: 4 }), 1_000_000)).toBeLessThanOrEqual(100)
  })

  it('mais volume e posição mais próxima do topo dão score maior', () => {
    expect(scoreQuickWin(agg(), 5000)).toBeGreaterThan(scoreQuickWin(agg(), 50))
    expect(scoreQuickWin(agg({ position: 5 }), 720)).toBeGreaterThan(scoreQuickWin(agg({ position: 18 }), 720))
  })

  it('sem volume usa as impressões como demanda', () => {
    expect(scoreQuickWin(agg({ impressions: 2000 }), null)).toBeGreaterThan(scoreQuickWin(agg({ impressions: 30 }), null))
  })
})

describe('buildOportunidades', () => {
  it('junta o volume pela busca normalizada e ordena por score', () => {
    const volumes = new Map<string, KeywordVolume>([
      ['consultoria de ti', { keyword: 'consultoria de ti', volumeMensal: 720, concorrencia: 'MEDIUM' }],
    ])
    const out = buildOportunidades(
      [agg({ query: 'comunicação unificada', queryNorm: 'comunicacao unificada', impressions: 121, position: 11.8 }), agg()],
      volumes,
    )
    expect(out[0].query).toBe('consultoria de ti')
    expect(out[0].volume_mensal).toBe(720)
    expect(out[0].concorrencia).toBe('MEDIUM')
    expect(out[1].volume_mensal).toBeNull()
    expect(out[0].score).toBeGreaterThanOrEqual(out[1].score)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run execution/src/opportunities/quickWins.test.ts`
Expected: FAIL with "Failed to resolve import './quickWins.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// execution/src/opportunities/quickWins.ts
/**
 * Quick wins: buscas em que o site já aparece entre as posições 4 e 20.
 * Funções puras — nada de rede ou banco aqui.
 */
import type { GscRow } from '../google/searchConsole.js'
import { normalizeKeyword, type KeywordVolume } from '../google/keywordPlanner.js'

export interface QueryAgg {
  query: string
  queryNorm: string
  page: string | null
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export function aggregateByQuery(rows: GscRow[]): QueryAgg[] {
  const grupos = new Map<
    string,
    { clicks: number; impressions: number; posPeso: number; porPagina: Map<string, number>; porTexto: Map<string, number> }
  >()

  for (const row of rows) {
    const [query = '', page = ''] = row.keys
    const norm = normalizeKeyword(query)
    if (!norm) continue
    const g = grupos.get(norm) ?? { clicks: 0, impressions: 0, posPeso: 0, porPagina: new Map(), porTexto: new Map() }
    g.clicks += row.clicks
    g.impressions += row.impressions
    g.posPeso += row.position * row.impressions
    if (page) g.porPagina.set(page, (g.porPagina.get(page) ?? 0) + row.impressions)
    g.porTexto.set(query.trim(), (g.porTexto.get(query.trim()) ?? 0) + row.impressions)
    grupos.set(norm, g)
  }

  const maior = (m: Map<string, number>): string | null =>
    [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return [...grupos.entries()].map(([norm, g]) => ({
    query: maior(g.porTexto) ?? norm,
    queryNorm: norm,
    page: maior(g.porPagina),
    clicks: g.clicks,
    impressions: g.impressions,
    ctr: g.impressions ? g.clicks / g.impressions : 0,
    position: g.impressions ? g.posPeso / g.impressions : 0,
  }))
}

const compacto = (s: string) => normalizeKeyword(s).replace(/[^a-z0-9]/g, '')

/** Sufixos que não identificam a marca (com.br, adv.br, net, ...). */
const SUFIXOS = new Set(['br', 'com', 'net', 'org', 'adv', 'gov', 'edu', 'ind', 'eng', 'med', 'odo', 'arq', 'app', 'io', 'co', 'dev', 'site', 'online', 'info', 'biz', 'us', 'pt', 'ai'])

/** Rótulo registrável do domínio: audicao.vitaaudio.com.br → vitaaudio (subdomínio não é marca). */
function rotuloDaMarca(dominio: string): string {
  try {
    const host = new URL(dominio.startsWith('http') ? dominio : `https://${dominio}`).hostname
    const labels = host.split('.')
    while (labels.length > 1 && SUFIXOS.has(labels[labels.length - 1] ?? '')) labels.pop()
    return labels[labels.length - 1] ?? ''
  } catch {
    return ''
  }
}

/** Termos de marca: nome do cliente compactado + rótulo registrável do domínio. */
export function marcaTermos(nome: string, dominio: string): string[] {
  const termos = [compacto(nome), compacto(rotuloDaMarca(dominio))]
  return [...new Set(termos.filter((t) => t.length >= 4))]
}

export function isMarca(query: string, termos: string[]): boolean {
  const q = compacto(query)
  return termos.some((t) => q.includes(t))
}

export interface QuickWinOptions {
  posMin?: number
  posMax?: number
  minImpressoes?: number
  limite?: number
  marca?: string[]
}

export function selectQuickWins(aggs: QueryAgg[], opts: QuickWinOptions = {}): QueryAgg[] {
  const { posMin = 4, posMax = 20, minImpressoes = 20, limite = 100, marca = [] } = opts
  return aggs
    .filter((a) => a.position >= posMin && a.position <= posMax)
    .filter((a) => a.impressions >= minImpressoes)
    .filter((a) => !isMarca(a.query, marca))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limite)
}

/** CTR que a página teria na posição 3 — referência do "ganho possível". */
const CTR_ALVO = 0.1
const log = (x: number, base: number) => Math.log10(x + 1) / Math.log10(base + 1)
const clamp = (x: number) => Math.max(0, Math.min(1, x))

/**
 * Score 0–100 = 40% demanda + 35% ganho de cliques + 25% proximidade do top 3.
 * Demanda: volume mensal do Keyword Planner ou, sem ele, as impressões dos 28 dias.
 * Heurística documentada em directives/oportunidades_google.md; pesos configuráveis ficam para depois.
 */
export function scoreQuickWin(agg: QueryAgg, volumeMensal: number | null): number {
  const demanda = volumeMensal ?? agg.impressions
  const demandaScore = clamp(log(demanda, 10_000))
  const cliquesExtras = Math.max(0, demanda * (CTR_ALVO - agg.ctr))
  const ganhoScore = clamp(log(cliquesExtras, 1_000))
  const proximidade = clamp((20 - agg.position) / 16)
  return Math.round(100 * (0.4 * demandaScore + 0.35 * ganhoScore + 0.25 * proximidade))
}

export interface OportunidadeCalculada {
  query: string
  query_norm: string
  page_url: string | null
  posicao: number
  impressoes: number
  cliques: number
  ctr: number
  volume_mensal: number | null
  concorrencia: string | null
  score: number
}

export function buildOportunidades(
  candidatos: QueryAgg[],
  volumes: Map<string, KeywordVolume>,
): OportunidadeCalculada[] {
  return candidatos
    .map((a) => {
      const v = volumes.get(a.queryNorm) ?? null
      return {
        query: a.query,
        query_norm: a.queryNorm,
        page_url: a.page,
        posicao: Math.round(a.position * 10) / 10,
        impressoes: a.impressions,
        cliques: a.clicks,
        ctr: a.ctr,
        volume_mensal: v?.volumeMensal ?? null,
        concorrencia: v?.concorrencia ?? null,
        score: scoreQuickWin(a, v?.volumeMensal ?? null),
      }
    })
    .sort((x, y) => y.score - x.score || y.impressoes - x.impressoes)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run execution/src/opportunities/quickWins.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit (somente se autorizado)**

```bash
git add execution/src/opportunities/quickWins.ts execution/src/opportunities/quickWins.test.ts
git commit -m "feat(oportunidades): agregação, filtro de marca e score de quick wins"
```

---

### Task 5: Tabelas D1, tipos compartilhados e store de oportunidades

**Files:**
- Create: `migrations/009_radar_google_oportunidades.sql`
- Modify: `schema.sql` (acrescentar ao final)
- Modify: `execution/src/cloudflare/migrations.ts` (constante nova + `D1_BOOTSTRAP_STATEMENTS` + `REQUIRED_TABLES`)
- Modify: `execution/src/cloudflare/d1Setup.ts` (`applyD1Upgrades`)
- Modify: `types/src/index.ts` (acrescentar tipos ao final, antes do comentário das linhas 857-860 se ele for o fim do arquivo)
- Create: `execution/src/test-support/fakeD1.ts`
- Create: `execution/src/opportunities/store.ts`
- Test: `execution/src/opportunities/store.test.ts`, `execution/src/cloudflare/migrations.radar.test.ts`

**Interfaces:**
- Consumes: `OportunidadeCalculada` (Task 4), `PautaSugerida` (types), `D1Database` (`execution/src/types/d1.ts`).
- Produces (types, em `@publisher-p12/types`):
  - `type GoogleConta = 'contato' | 'ryan'`
  - `interface ClientGoogle { client_id: string; gsc_site_url: string | null; gsc_conta: GoogleConta | null; updated_at: string | null }`
  - `interface GscSiteOption { site_url: string; conta: GoogleConta; permissao: string }`
  - `interface ClientGoogleView { vinculo: ClientGoogle; sites_disponiveis: GscSiteOption[]; erros: Array<{ conta: GoogleConta; erro: string }> }`
  - `type OportunidadeTipo = 'quick_win'`, `type OportunidadeStatus = 'nova' | 'em_pauta' | 'descartada'`
  - `interface Oportunidade { id; client_id; tipo; query; page_url; posicao; impressoes; cliques; ctr; volume_mensal; concorrencia; score; status; janela_inicio; janela_fim; idea_id; created_at; updated_at }`
  - `interface SyncOportunidadesResult { janela: { inicio: string; fim: string }; queries_analisadas: number; quick_wins: number; com_volume: number; keyword_planner_erro: string | null; duration_ms: number }`
- Produces (execution):
  - `RADAR_FATIA1_STATEMENTS: string[]` (migrations.ts)
  - `getClientGoogle(db, clientId): Promise<ClientGoogle>`
  - `saveClientGoogle(db, clientId, v: { gsc_site_url: string | null; gsc_conta: GoogleConta | null }): Promise<ClientGoogle>`
  - `saveOportunidades(db, clientId, janela: { inicio: string; fim: string }, itens: OportunidadeCalculada[]): Promise<number>`
  - `listOportunidades(db, clientId, status?: OportunidadeStatus): Promise<Oportunidade[]>`
  - `getOportunidade(db, clientId, id): Promise<Oportunidade | null>`
  - `setOportunidadeStatus(db, clientId, id, status: OportunidadeStatus, ideaId?: string | null): Promise<boolean>`
  - `oportunidadeParaPauta(o: Oportunidade): PautaSugerida`
  - `createIdeaFromOportunidade(db, clientId, o: Oportunidade): Promise<string>`: devolve o id da pauta
  - `class FakeD1` (test-support), com `executed`, `batches` e `constructor(responses?: Array<{ match: RegExp; rows: unknown[] }>)`

- [ ] **Step 1: Create the migration and schema DDL**

```sql
-- migrations/009_radar_google_oportunidades.sql
-- Migration 009: Radar fatia 1 — vínculo do cliente com o Search Console, oportunidades
-- (quick wins do Search Console + volume do Keyword Planner) e registro de custo de LLM.

-- D1: adia a checagem de FK até o fim da transação (ver docs D1 migrations)
PRAGMA defer_foreign_keys = true;

CREATE TABLE IF NOT EXISTS client_google (
    client_id       TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    gsc_site_url    TEXT,
    gsc_conta       TEXT CHECK(gsc_conta IN ('contato', 'ryan')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opportunities (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL DEFAULT 'quick_win' CHECK(tipo IN ('quick_win')),
    query           TEXT NOT NULL,
    query_norm      TEXT NOT NULL,
    page_url        TEXT,
    posicao         REAL NOT NULL,
    impressoes      INTEGER NOT NULL,
    cliques         INTEGER NOT NULL,
    ctr             REAL NOT NULL,
    volume_mensal   INTEGER,
    concorrencia    TEXT,
    score           INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'nova'
                    CHECK(status IN ('nova', 'em_pauta', 'descartada')),
    janela_inicio   TEXT NOT NULL,
    janela_fim      TEXT NOT NULL,
    idea_id         TEXT REFERENCES article_ideas(id) ON DELETE SET NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(client_id, tipo, query_norm)
);

CREATE INDEX IF NOT EXISTS idx_opportunities_client ON opportunities(client_id, status, score DESC);

CREATE TABLE IF NOT EXISTS llm_usage (
    id              TEXT PRIMARY KEY,
    client_id       TEXT REFERENCES clients(id) ON DELETE SET NULL,
    article_id      TEXT REFERENCES articles(id) ON DELETE SET NULL,
    job_id          TEXT,
    agente          TEXT NOT NULL,
    modelo          TEXT NOT NULL,
    tokens_in       INTEGER NOT NULL DEFAULT 0,
    tokens_out      INTEGER NOT NULL DEFAULT 0,
    custo_usd       REAL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_client ON llm_usage(client_id, created_at);
```

Copie as mesmas três tabelas e os dois índices (sem a linha `PRAGMA`) para o fim do `schema.sql`, com o comentário `-- Radar fatia 1 (migration 009)`.

- [ ] **Step 2: Write the failing tests**

```ts
// execution/src/test-support/fakeD1.ts
/** D1 falso para testes: devolve linhas por trecho de SQL e registra o que foi executado. */
import type { D1Database, D1PreparedStatement } from '../types/d1.js'

export interface Executed {
  sql: string
  binds: unknown[]
}

export class FakeD1 implements D1Database {
  executed: Executed[] = []
  batches: Executed[][] = []

  constructor(private readonly responses: Array<{ match: RegExp; rows: unknown[] }> = []) {}

  private rowsFor(sql: string): unknown[] {
    return this.responses.find((r) => r.match.test(sql))?.rows ?? []
  }

  prepare(sql: string): D1PreparedStatement {
    const self = this
    const record: Executed = { sql, binds: [] }
    const stmt: D1PreparedStatement = {
      bind(...values: unknown[]) {
        record.binds = values
        return stmt
      },
      async first<T>() {
        self.executed.push(record)
        return (self.rowsFor(sql)[0] ?? null) as T | null
      },
      async all<T>() {
        self.executed.push(record)
        return { results: self.rowsFor(sql) as T[] }
      },
      async run() {
        self.executed.push(record)
        return { meta: { changes: 1 } }
      },
    }
    Object.defineProperty(stmt, '__record', { value: record, enumerable: false })
    return stmt
  }

  async batch(statements: D1PreparedStatement[]): Promise<unknown> {
    this.batches.push(statements.map((s) => (s as unknown as { __record: Executed }).__record))
    return []
  }
}
```

```ts
// execution/src/opportunities/store.test.ts
import { describe, expect, it } from 'vitest'
import type { Oportunidade } from '@publisher-p12/types'
import { FakeD1 } from '../test-support/fakeD1.js'
import type { OportunidadeCalculada } from './quickWins.js'
import {
  createIdeaFromOportunidade,
  getClientGoogle,
  listOportunidades,
  oportunidadeParaPauta,
  saveClientGoogle,
  saveOportunidades,
  setOportunidadeStatus,
} from './store.js'

const calc: OportunidadeCalculada = {
  query: 'consultoria de ti', query_norm: 'consultoria de ti', page_url: 'https://abxtelecom.com.br/ti/',
  posicao: 10.8, impressoes: 64, cliques: 0, ctr: 0, volume_mensal: 720, concorrencia: 'MEDIUM', score: 71,
}

const linha = {
  id: 'op1', client_id: 'cli', tipo: 'quick_win', query: 'consultoria de ti', query_norm: 'consultoria de ti',
  page_url: 'https://abxtelecom.com.br/ti/', posicao: 10.8, impressoes: 64, cliques: 0, ctr: 0,
  volume_mensal: 720, concorrencia: 'MEDIUM', score: 71, status: 'nova', janela_inicio: '2026-09-05',
  janela_fim: '2026-10-02', idea_id: null, created_at: '2026-10-05 10:00:00', updated_at: '2026-10-05 10:00:00',
}

describe('client_google', () => {
  it('sem linha devolve vínculo vazio', async () => {
    const db = new FakeD1()
    expect(await getClientGoogle(db, 'cli')).toEqual({ client_id: 'cli', gsc_site_url: null, gsc_conta: null, updated_at: null })
  })

  it('salva com upsert por client_id', async () => {
    const db = new FakeD1([{ match: /SELECT .* FROM client_google/, rows: [{ client_id: 'cli', gsc_site_url: 'https://abxtelecom.com.br/', gsc_conta: 'contato', updated_at: 'agora' }] }])
    const v = await saveClientGoogle(db, 'cli', { gsc_site_url: 'https://abxtelecom.com.br/', gsc_conta: 'contato' })
    const insert = db.executed.find((e) => e.sql.includes('INSERT INTO client_google'))!
    expect(insert.sql).toContain('ON CONFLICT(client_id) DO UPDATE')
    expect(insert.binds).toEqual(['cli', 'https://abxtelecom.com.br/', 'contato'])
    expect(v.gsc_conta).toBe('contato')
  })
})

describe('saveOportunidades', () => {
  it('upsert não mexe no status e apaga só as "nova" de janelas antigas', async () => {
    const db = new FakeD1()
    const n = await saveOportunidades(db, 'cli', { inicio: '2026-09-05', fim: '2026-10-02' }, [calc])
    expect(n).toBe(1)
    const lote = db.batches[0]
    const upsert = lote.find((e) => e.sql.includes('INSERT INTO opportunities'))!
    expect(upsert.sql).toContain('ON CONFLICT(client_id, tipo, query_norm) DO UPDATE')
    const doUpdate = upsert.sql.split('DO UPDATE')[1]
    expect(doUpdate).not.toMatch(/\bstatus\b/)
    const limpeza = lote.find((e) => e.sql.startsWith('DELETE FROM opportunities'))!
    expect(limpeza.sql).toContain("status = 'nova'")
    expect(limpeza.binds).toEqual(['cli', '2026-10-02'])
  })
})

describe('listOportunidades e status', () => {
  it('converte as linhas e filtra por status', async () => {
    const db = new FakeD1([{ match: /FROM opportunities/, rows: [linha] }])
    const lista = await listOportunidades(db, 'cli', 'nova')
    expect(lista[0]).toMatchObject({ id: 'op1', volume_mensal: 720, status: 'nova', idea_id: null })
    expect(db.executed[0].binds).toEqual(['cli', 'nova'])
  })

  it('marca em_pauta guardando a pauta', async () => {
    const db = new FakeD1()
    expect(await setOportunidadeStatus(db, 'cli', 'op1', 'em_pauta', 'idea9')).toBe(true)
    expect(db.executed[0].binds).toEqual(['em_pauta', 'idea9', 'cli', 'op1'])
  })
})

describe('pauta a partir da oportunidade', () => {
  it('explica a demanda e manda linkar a página que já ranqueia', () => {
    const p = oportunidadeParaPauta(linha as Oportunidade)
    expect(p.kw_principal).toBe('consultoria de ti')
    expect(p.tema).toBe('Consultoria de ti')
    expect(p.artigos_relacionados).toEqual(['https://abxtelecom.com.br/ti/'])
    expect(p.justificativa).toContain('posição 10,8')
    expect(p.justificativa).toContain('720 buscas/mês')
    expect(p.risco_canibalizacao).toContain('https://abxtelecom.com.br/ti/')
  })

  it('cria a linha em article_ideas e devolve o id', async () => {
    const db = new FakeD1()
    const id = await createIdeaFromOportunidade(db, 'cli', linha as Oportunidade)
    const insert = db.executed.find((e) => e.sql.includes('INSERT INTO article_ideas'))!
    expect(insert.binds[0]).toBe(id)
    expect(insert.binds[1]).toBe('cli')
    expect(JSON.parse(String(insert.binds[5])).kw_principal).toBe('consultoria de ti')
  })
})
```

```ts
// execution/src/cloudflare/migrations.radar.test.ts
import { describe, expect, it } from 'vitest'
import { D1_BOOTSTRAP_STATEMENTS, RADAR_FATIA1_STATEMENTS, REQUIRED_TABLES } from './migrations.js'

describe('migrations — Radar fatia 1', () => {
  it('bootstrap e tabelas obrigatórias incluem as tabelas novas', () => {
    for (const tabela of ['client_google', 'opportunities', 'llm_usage']) {
      expect(REQUIRED_TABLES).toContain(tabela)
      expect(D1_BOOTSTRAP_STATEMENTS.some((s) => s.includes(`CREATE TABLE IF NOT EXISTS ${tabela}`))).toBe(true)
    }
  })

  it('statements são idempotentes', () => {
    for (const sql of RADAR_FATIA1_STATEMENTS) expect(sql).toMatch(/IF NOT EXISTS/)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run execution/src/opportunities/store.test.ts execution/src/cloudflare/migrations.radar.test.ts`
Expected: FAIL ("Failed to resolve import './store.js'" e "RADAR_FATIA1_STATEMENTS is not exported")

- [ ] **Step 4: Add the shared types**

Acrescente ao final de `types/src/index.ts`:

```ts
// ---------------------------------------------------------------------------
// Radar — Google (Search Console) e oportunidades
// ---------------------------------------------------------------------------

/** Conta Google da agência que enxerga a propriedade. contato = GOOGLE_ADS_*, ryan = GOOGLE_DATA_*. */
export type GoogleConta = 'contato' | 'ryan'

export interface ClientGoogle {
  client_id: string
  gsc_site_url: string | null
  gsc_conta: GoogleConta | null
  updated_at: string | null
}

export interface GscSiteOption {
  site_url: string
  conta: GoogleConta
  permissao: string
}

export interface ClientGoogleView {
  vinculo: ClientGoogle
  sites_disponiveis: GscSiteOption[]
  /** Falha ao listar sites de uma conta (ex.: token revogado) — a outra conta continua aparecendo. */
  erros: Array<{ conta: GoogleConta; erro: string }>
}

export type OportunidadeTipo = 'quick_win'
export type OportunidadeStatus = 'nova' | 'em_pauta' | 'descartada'

export interface Oportunidade {
  id: string
  client_id: string
  tipo: OportunidadeTipo
  query: string
  page_url: string | null
  posicao: number
  impressoes: number
  cliques: number
  ctr: number
  volume_mensal: number | null
  concorrencia: string | null
  score: number
  status: OportunidadeStatus
  janela_inicio: string
  janela_fim: string
  idea_id: string | null
  created_at: string
  updated_at: string
}

export interface SyncOportunidadesResult {
  janela: { inicio: string; fim: string }
  queries_analisadas: number
  quick_wins: number
  com_volume: number
  /** Keyword Planner falhou: as oportunidades foram salvas sem volume. */
  keyword_planner_erro: string | null
  duration_ms: number
}
```

- [ ] **Step 5: Add the bootstrap and upgrade statements**

Em `execution/src/cloudflare/migrations.ts`, **acima** de `export const D1_BOOTSTRAP_STATEMENTS`:

```ts
/** Migration 009 (Radar fatia 1). Idempotente: entra no bootstrap e no applyD1Upgrades. */
export const RADAR_FATIA1_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS client_google (
    client_id TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    gsc_site_url TEXT, gsc_conta TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL DEFAULT 'quick_win', query TEXT NOT NULL, query_norm TEXT NOT NULL,
    page_url TEXT, posicao REAL NOT NULL, impressoes INTEGER NOT NULL, cliques INTEGER NOT NULL,
    ctr REAL NOT NULL, volume_mensal INTEGER, concorrencia TEXT, score INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'nova', janela_inicio TEXT NOT NULL, janela_fim TEXT NOT NULL,
    idea_id TEXT REFERENCES article_ideas(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(client_id, tipo, query_norm))`,
  `CREATE INDEX IF NOT EXISTS idx_opportunities_client ON opportunities(client_id, status, score DESC)`,
  `CREATE TABLE IF NOT EXISTS llm_usage (
    id TEXT PRIMARY KEY, client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    article_id TEXT REFERENCES articles(id) ON DELETE SET NULL, job_id TEXT,
    agente TEXT NOT NULL, modelo TEXT NOT NULL,
    tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0, custo_usd REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_llm_usage_client ON llm_usage(client_id, created_at)`,
]
```

Ainda em `migrations.ts`:
- Adicione `...RADAR_FATIA1_STATEMENTS,` como **último** elemento do array `D1_BOOTSTRAP_STATEMENTS`, logo antes do `]` da linha 85.
- Adicione `'client_google'`, `'opportunities'` e `'llm_usage'` ao fim de `REQUIRED_TABLES`.

Em `execution/src/cloudflare/d1Setup.ts`, importe `RADAR_FATIA1_STATEMENTS` no mesmo `import { ... } from './migrations.js'` já existente. Depois, dentro de `applyD1Upgrades`, logo antes de `return { applied }`, coloque:

```ts
  // Migration 009: Radar fatia 1 (tabelas novas, idempotente)
  for (const sql of RADAR_FATIA1_STATEMENTS) {
    await db.prepare(sql).run()
    applied++
  }
```

- [ ] **Step 6: Write the store**

```ts
// execution/src/opportunities/store.ts
/** D1: vínculo Google do cliente e oportunidades. */
import type {
  ClientGoogle,
  GoogleConta,
  Oportunidade,
  OportunidadeStatus,
  OportunidadeTipo,
  PautaSugerida,
} from '@publisher-p12/types'
import type { D1Database } from '../types/d1.js'
import type { OportunidadeCalculada } from './quickWins.js'

export async function getClientGoogle(db: D1Database, clientId: string): Promise<ClientGoogle> {
  const row = await db
    .prepare('SELECT client_id, gsc_site_url, gsc_conta, updated_at FROM client_google WHERE client_id = ?')
    .bind(clientId)
    .first<ClientGoogle>()
  return row ?? { client_id: clientId, gsc_site_url: null, gsc_conta: null, updated_at: null }
}

export async function saveClientGoogle(
  db: D1Database,
  clientId: string,
  v: { gsc_site_url: string | null; gsc_conta: GoogleConta | null },
): Promise<ClientGoogle> {
  await db
    .prepare(
      `INSERT INTO client_google (client_id, gsc_site_url, gsc_conta, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(client_id) DO UPDATE SET
         gsc_site_url = excluded.gsc_site_url,
         gsc_conta = excluded.gsc_conta,
         updated_at = datetime('now')`,
    )
    .bind(clientId, v.gsc_site_url, v.gsc_conta)
    .run()
  return getClientGoogle(db, clientId)
}

export async function saveOportunidades(
  db: D1Database,
  clientId: string,
  janela: { inicio: string; fim: string },
  itens: OportunidadeCalculada[],
  tipo: OportunidadeTipo = 'quick_win',
): Promise<number> {
  const statements = itens.map((o) =>
    db
      .prepare(
        `INSERT INTO opportunities
           (id, client_id, tipo, query, query_norm, page_url, posicao, impressoes, cliques, ctr,
            volume_mensal, concorrencia, score, janela_inicio, janela_fim)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(client_id, tipo, query_norm) DO UPDATE SET
           query = excluded.query,
           page_url = excluded.page_url,
           posicao = excluded.posicao,
           impressoes = excluded.impressoes,
           cliques = excluded.cliques,
           ctr = excluded.ctr,
           volume_mensal = excluded.volume_mensal,
           concorrencia = excluded.concorrencia,
           score = excluded.score,
           janela_inicio = excluded.janela_inicio,
           janela_fim = excluded.janela_fim,
           updated_at = datetime('now')`,
      )
      .bind(
        crypto.randomUUID(), clientId, tipo, o.query, o.query_norm, o.page_url, o.posicao,
        o.impressoes, o.cliques, o.ctr, o.volume_mensal, o.concorrencia, o.score, janela.inicio, janela.fim,
      ),
  )
  // Quick wins que sumiram nesta janela e ninguém tocou saem; descartadas/em pauta ficam.
  statements.push(
    db
      .prepare(`DELETE FROM opportunities WHERE client_id = ? AND tipo = '${tipo}' AND status = 'nova' AND janela_fim <> ?`)
      .bind(clientId, janela.fim),
  )

  if (typeof db.batch === 'function') await db.batch(statements)
  else for (const s of statements) await s.run()
  return itens.length
}

interface OportunidadeRow extends Omit<Oportunidade, 'tipo' | 'status'> {
  tipo: string
  status: string
  query_norm: string
}

function rowToOportunidade(row: OportunidadeRow): Oportunidade {
  return {
    id: row.id,
    client_id: row.client_id,
    tipo: row.tipo as OportunidadeTipo,
    query: row.query,
    page_url: row.page_url,
    posicao: Number(row.posicao),
    impressoes: Number(row.impressoes),
    cliques: Number(row.cliques),
    ctr: Number(row.ctr),
    volume_mensal: row.volume_mensal === null ? null : Number(row.volume_mensal),
    concorrencia: row.concorrencia,
    score: Number(row.score),
    status: row.status as OportunidadeStatus,
    janela_inicio: row.janela_inicio,
    janela_fim: row.janela_fim,
    idea_id: row.idea_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listOportunidades(
  db: D1Database,
  clientId: string,
  status?: OportunidadeStatus,
): Promise<Oportunidade[]> {
  const sql = status
    ? 'SELECT * FROM opportunities WHERE client_id = ? AND status = ? ORDER BY score DESC, impressoes DESC'
    : 'SELECT * FROM opportunities WHERE client_id = ? ORDER BY score DESC, impressoes DESC'
  const stmt = status ? db.prepare(sql).bind(clientId, status) : db.prepare(sql).bind(clientId)
  const { results } = await stmt.all<OportunidadeRow>()
  return (results ?? []).map(rowToOportunidade)
}

export async function getOportunidade(db: D1Database, clientId: string, id: string): Promise<Oportunidade | null> {
  const row = await db
    .prepare('SELECT * FROM opportunities WHERE client_id = ? AND id = ?')
    .bind(clientId, id)
    .first<OportunidadeRow>()
  return row ? rowToOportunidade(row) : null
}

export async function setOportunidadeStatus(
  db: D1Database,
  clientId: string,
  id: string,
  status: OportunidadeStatus,
  ideaId: string | null = null,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE opportunities SET status = ?, idea_id = COALESCE(?, idea_id), updated_at = datetime('now')
       WHERE client_id = ? AND id = ?`,
    )
    .bind(status, ideaId, clientId, id)
    .run()
  return (res.meta?.changes ?? 0) > 0
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export function oportunidadeParaPauta(o: Oportunidade): PautaSugerida {
  const demanda = o.volume_mensal !== null ? `${fmt(o.volume_mensal)} buscas/mês no Brasil` : 'volume não medido'
  const pagina = o.page_url ?? 'uma página do site'
  return {
    tema: o.query.charAt(0).toUpperCase() + o.query.slice(1),
    kw_principal: o.query,
    kws_secundarias: [],
    intencao: 'a definir pelo Pesquisador',
    etapa_funil: 'a definir pelo Pesquisador',
    angulo: 'Aprofundar um ângulo complementar ao da página que já ranqueia e linkar para ela',
    publico: '',
    extensao_alvo: 1500,
    cluster: '',
    justificativa:
      `Busca real no Google: "${o.query}" — posição ${fmt(o.posicao)}, ${fmt(o.impressoes)} impressões e ` +
      `${fmt(o.cliques)} cliques em 28 dias (${o.janela_inicio} a ${o.janela_fim}); ${demanda}. ` +
      `Quick win: o site já aparece, falta subir para o top 3.`,
    artigos_relacionados: o.page_url ? [o.page_url] : [],
    risco_canibalizacao:
      `${pagina} já ranqueia para "${o.query}". O artigo novo não pode competir com ela: ` +
      `cubra uma dúvida ou ângulo complementar e faça link para ela com âncora natural.`,
  }
}

export async function createIdeaFromOportunidade(db: D1Database, clientId: string, o: Oportunidade): Promise<string> {
  const pauta = oportunidadeParaPauta(o)
  const id = crypto.randomUUID()
  await db
    .prepare('INSERT INTO article_ideas (id, client_id, tema, kw_principal, cluster, payload) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, clientId, pauta.tema, pauta.kw_principal, pauta.cluster || null, JSON.stringify(pauta))
    .run()
  return id
}
```

Antes de seguir, abra `execution/src/corpus/ideas.ts` (`saveIdeas`, linha 65, e `rowToArticleIdea`, linha 20) e confirme duas coisas: que `payload` guarda o `PautaSugerida` serializado e que as colunas usadas no `INSERT` são as mesmas. Se `saveIdeas` gravar algo diferente (outro formato de `payload` ou colunas a mais), ajuste `createIdeaFromOportunidade` para ficar idêntico.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run execution/src/opportunities/store.test.ts execution/src/cloudflare/migrations.radar.test.ts`
Expected: PASS (8 tests)

Run: `npx vitest run`
Expected: PASS em toda a suíte, com os testes antigos inclusos.

- [ ] **Step 8: Commit (somente se autorizado)**

```bash
git add migrations/009_radar_google_oportunidades.sql schema.sql types/src/index.ts \
  execution/src/cloudflare/migrations.ts execution/src/cloudflare/d1Setup.ts \
  execution/src/cloudflare/migrations.radar.test.ts execution/src/test-support/fakeD1.ts \
  execution/src/opportunities/store.ts execution/src/opportunities/store.test.ts
git commit -m "feat(oportunidades): tabelas D1, tipos e store de oportunidades"
```

---

### Task 6: Orquestração da sincronização e exports

**Files:**
- Create: `execution/src/opportunities/sync.ts`
- Modify: `execution/src/index.ts` (acrescentar exports)
- Test: `execution/src/opportunities/sync.test.ts`

**Interfaces:**
- Consumes: `GscQuery`, `GscRow`, `gscWindow` (Task 2); `KeywordVolume` (Task 3); `aggregateByQuery`, `selectQuickWins`, `buildOportunidades`, `OportunidadeCalculada` (Task 4).
- Produces:
  - `interface SyncDeps { queryGsc: (siteUrl: string, q: GscQuery) => Promise<GscRow[]>; getVolumes: ((keywords: string[]) => Promise<Map<string, KeywordVolume>>) | null; today?: Date }`
  - `interface QuickWinsCalculados { janela: { inicio: string; fim: string }; oportunidades: OportunidadeCalculada[]; queriesAnalisadas: number; kpErro: string | null }`
  - `calcularQuickWins(siteUrl: string, deps: SyncDeps, opts?: { marca?: string[]; limite?: number }): Promise<QuickWinsCalculados>`

- [ ] **Step 1: Write the failing test**

```ts
// execution/src/opportunities/sync.test.ts
import { describe, expect, it, vi } from 'vitest'
import type { GscRow } from '../google/searchConsole.js'
import type { KeywordVolume } from '../google/keywordPlanner.js'
import { calcularQuickWins } from './sync.js'

const ROWS: GscRow[] = [
  { keys: ['consultoria de ti', 'https://abx/ti'], clicks: 0, impressions: 64, ctr: 0, position: 10.8 },
  { keys: ['abx telecom', 'https://abx/'], clicks: 50, impressions: 900, ctr: 0.05, position: 4.2 },
  { keys: ['fibra óptica', 'https://abx/fibra'], clicks: 9, impressions: 300, ctr: 0.03, position: 2.1 },
]

describe('calcularQuickWins', () => {
  it('consulta a janela de 28 dias, tira marca e top 3 e junta volume', async () => {
    const queryGsc = vi.fn(async () => ROWS)
    const getVolumes = vi.fn(async (kws: string[]) => {
      expect(kws).toEqual(['consultoria de ti'])
      return new Map<string, KeywordVolume>([['consultoria de ti', { keyword: 'consultoria de ti', volumeMensal: 720, concorrencia: 'MEDIUM' }]])
    })

    const out = await calcularQuickWins('https://abxtelecom.com.br/', { queryGsc, getVolumes, today: new Date('2026-10-05T12:00:00Z') }, { marca: ['abxtelecom'] })

    expect(queryGsc).toHaveBeenCalledWith('https://abxtelecom.com.br/', {
      startDate: '2026-09-05', endDate: '2026-10-02', dimensions: ['query', 'page'], maxRows: 50_000,
    })
    expect(out.janela).toEqual({ inicio: '2026-09-05', fim: '2026-10-02' })
    expect(out.queriesAnalisadas).toBe(3)
    expect(out.oportunidades.map((o) => o.query)).toEqual(['consultoria de ti'])
    expect(out.oportunidades[0].volume_mensal).toBe(720)
    expect(out.kpErro).toBeNull()
  })

  it('Keyword Planner falhando não derruba a sincronização', async () => {
    const out = await calcularQuickWins('https://abxtelecom.com.br/', {
      queryGsc: async () => ROWS,
      getVolumes: async () => { throw new Error('Keyword Planner: projeto só aprovado para contas de teste') },
      today: new Date('2026-10-05T12:00:00Z'),
    }, { marca: ['abxtelecom'] })

    expect(out.oportunidades).toHaveLength(1)
    expect(out.oportunidades[0].volume_mensal).toBeNull()
    expect(out.kpErro).toBe('Keyword Planner: projeto só aprovado para contas de teste')
  })

  it('sem Keyword Planner configurado segue sem volume', async () => {
    const out = await calcularQuickWins('https://x/', { queryGsc: async () => ROWS, getVolumes: null, today: new Date('2026-10-05T12:00:00Z') })
    expect(out.kpErro).toBe('Keyword Planner não configurado')
    expect(out.oportunidades.every((o) => o.volume_mensal === null)).toBe(true)
  })

  it('erro do Search Console sobe para quem chamou', async () => {
    await expect(calcularQuickWins('https://x/', {
      queryGsc: async () => { throw new Error('Search Console: cota 0') },
      getVolumes: null,
    })).rejects.toThrow('Search Console: cota 0')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run execution/src/opportunities/sync.test.ts`
Expected: FAIL with "Failed to resolve import './sync.js'"

- [ ] **Step 3: Write minimal implementation**

```ts
// execution/src/opportunities/sync.ts
/** Search Console → quick wins → Keyword Planner. Dependências injetadas para testar sem rede. */
import { gscWindow, type GscQuery, type GscRow } from '../google/searchConsole.js'
import type { KeywordVolume } from '../google/keywordPlanner.js'
import { aggregateByQuery, buildOportunidades, selectQuickWins, type OportunidadeCalculada } from './quickWins.js'

export interface SyncDeps {
  queryGsc: (siteUrl: string, q: GscQuery) => Promise<GscRow[]>
  /** null = Keyword Planner não configurado. */
  getVolumes: ((keywords: string[]) => Promise<Map<string, KeywordVolume>>) | null
  today?: Date
}

export interface QuickWinsCalculados {
  janela: { inicio: string; fim: string }
  oportunidades: OportunidadeCalculada[]
  queriesAnalisadas: number
  kpErro: string | null
}

export async function calcularQuickWins(
  siteUrl: string,
  deps: SyncDeps,
  opts: { marca?: string[]; limite?: number } = {},
): Promise<QuickWinsCalculados> {
  const { startDate, endDate } = gscWindow(deps.today ?? new Date())
  const rows = await deps.queryGsc(siteUrl, { startDate, endDate, dimensions: ['query', 'page'], maxRows: 50_000 })

  const aggs = aggregateByQuery(rows)
  const candidatos = selectQuickWins(aggs, { marca: opts.marca, limite: opts.limite ?? 100 })

  let volumes = new Map<string, KeywordVolume>()
  let kpErro: string | null = null
  if (!deps.getVolumes) {
    kpErro = 'Keyword Planner não configurado'
  } else if (candidatos.length > 0) {
    try {
      volumes = await deps.getVolumes(candidatos.map((c) => c.query))
    } catch (e) {
      kpErro = e instanceof Error ? e.message : 'Falha no Keyword Planner'
    }
  }

  return {
    janela: { inicio: startDate, fim: endDate },
    oportunidades: buildOportunidades(candidatos, volumes),
    queriesAnalisadas: aggs.length,
    kpErro,
  }
}
```

Em `execution/src/index.ts`, acrescente ao final:

```ts
export * from './google/auth.js'
export * from './google/searchConsole.js'
export * from './google/keywordPlanner.js'
export * from './opportunities/quickWins.js'
export * from './opportunities/store.js'
export * from './opportunities/sync.js'
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run execution/src/opportunities/sync.test.ts`
Expected: PASS (4 tests)

Run: `npm run build -w execution`
Expected: termina sem erros de tipo (o script é `tsc --noEmit`).

- [ ] **Step 5: Commit (somente se autorizado)**

```bash
git add execution/src/opportunities/sync.ts execution/src/opportunities/sync.test.ts execution/src/index.ts
git commit -m "feat(oportunidades): orquestra search console, quick wins e keyword planner"
```

---

### Task 7: Rotas da API e configuração das credenciais

**Files:**
- Create: `workers/api/src/lib/google.ts`
- Create: `workers/api/src/routes/google.ts`
- Modify: `workers/api/src/bindings.ts`
- Modify: `workers/api/src/index.ts` (montar o router)
- Modify: `wrangler.jsonc` e `workers/api/wrangler.jsonc` (var `GOOGLE_ADS_LOGIN_CUSTOMER_ID`)
- Modify: `scripts/push-worker-secrets.mjs` (secrets da api)
- Modify: `.env.example`, `package.json` (scripts da migration 009)

**Interfaces:**
- Consumes (de `@publisher-p12/execution`): `GoogleApiError`, `GoogleCredentials`, `KeywordPlannerConfig`, `listGscSites`, `queryGscSearchAnalytics`, `getKeywordVolumes`, `calcularQuickWins`, `marcaTermos`, `getClientGoogle`, `saveClientGoogle`, `saveOportunidades`, `listOportunidades`, `getOportunidade`, `setOportunidadeStatus` e `createIdeaFromOportunidade`. De `workers/api/src/lib/db.ts`: `getClient`.
- Produces as rotas HTTP, usadas pela Task 10:
  - `GET /clients/:id/google` → `ClientGoogleView`
  - `PUT /clients/:id/google`, com body `{ gsc_site_url: string | null; gsc_conta: GoogleConta | null }` → `ClientGoogle`
  - `POST /clients/:id/oportunidades/sync` → `SyncOportunidadesResult`
  - `GET /clients/:id/oportunidades?status=` → `Oportunidade[]`
  - `POST /clients/:id/oportunidades/:oppId/descartar` → `{ ok: true }`
  - `POST /clients/:id/oportunidades/:oppId/pauta` → `{ idea_id: string }`

- [ ] **Step 1: Baseline do typecheck da API**

Run: `npx tsc -p workers/api/tsconfig.json --noEmit`
Expected: anote os erros que já existem (o ideal é zero). Erros novos depois desta task são regressão.

- [ ] **Step 2: Bindings e configuração**

Em `workers/api/src/bindings.ts`, acrescente dentro de `ApiBindings`:

```ts
  /** Conta contato (contato@p12digital.com.br): Ads, GBP e Search Console da ABX. */
  GOOGLE_ADS_CLIENT_ID?: string
  GOOGLE_ADS_CLIENT_SECRET?: string
  GOOGLE_ADS_REFRESH_TOKEN?: string
  GOOGLE_ADS_DEVELOPER_TOKEN?: string
  /** MCC da agência (var, não secret). */
  GOOGLE_ADS_LOGIN_CUSTOMER_ID?: string
  /** Conta ryan (ryansantiago@p12digital.com.br): Search Console e GA4. */
  GOOGLE_DATA_CLIENT_ID?: string
  GOOGLE_DATA_CLIENT_SECRET?: string
  GOOGLE_DATA_REFRESH_TOKEN?: string
```

Em `wrangler.jsonc` (raiz) e em `workers/api/wrangler.jsonc`, acrescente dentro de `"vars"`:

```jsonc
    "GOOGLE_ADS_LOGIN_CUSTOMER_ID": "3780611396",
```

Em `scripts/push-worker-secrets.mjs`, acrescente ao array `api`:

```js
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_DATA_CLIENT_ID',
    'GOOGLE_DATA_CLIENT_SECRET',
    'GOOGLE_DATA_REFRESH_TOKEN',
```

Em `.env.example`, acrescente:

```
# Google — conta contato (Ads/Keyword Planner, GBP, Search Console da ABX). Projeto aprovado 253030348436.
GOOGLE_ADS_CLIENT_ID=
GOOGLE_ADS_CLIENT_SECRET=
GOOGLE_ADS_REFRESH_TOKEN=
GOOGLE_ADS_DEVELOPER_TOKEN=

# Google — conta ryan (Search Console, GA4). Só leitura.
GOOGLE_DATA_CLIENT_ID=
GOOGLE_DATA_CLIENT_SECRET=
GOOGLE_DATA_REFRESH_TOKEN=
```

Em `package.json` (raiz), dentro de `"scripts"`, acrescente depois das linhas `cf:d1:migrate:008:*`:

```json
    "cf:d1:migrate:009:local": "node scripts/cf-with-env.mjs npx wrangler d1 execute publisher-db --local --file=migrations/009_radar_google_oportunidades.sql --config workers/api/wrangler.jsonc",
    "cf:d1:migrate:009:remote": "node scripts/cf-with-env.mjs npx wrangler d1 execute publisher-db --remote --file=migrations/009_radar_google_oportunidades.sql --config workers/api/wrangler.jsonc",
```

- [ ] **Step 3: Helper de credenciais**

```ts
// workers/api/src/lib/google.ts
import type { GoogleCredentials, KeywordPlannerConfig } from '@publisher-p12/execution'
import type { GoogleConta } from '@publisher-p12/types'
import type { ApiBindings } from '../bindings'

export const GOOGLE_CONTAS: GoogleConta[] = ['contato', 'ryan']

/** contato = GOOGLE_ADS_*, ryan = GOOGLE_DATA_*. null = conta não configurada no ambiente. */
export function googleCreds(env: ApiBindings, conta: GoogleConta): GoogleCredentials | null {
  const [clientId, clientSecret, refreshToken] =
    conta === 'contato'
      ? [env.GOOGLE_ADS_CLIENT_ID, env.GOOGLE_ADS_CLIENT_SECRET, env.GOOGLE_ADS_REFRESH_TOKEN]
      : [env.GOOGLE_DATA_CLIENT_ID, env.GOOGLE_DATA_CLIENT_SECRET, env.GOOGLE_DATA_REFRESH_TOKEN]
  if (!clientId || !clientSecret || !refreshToken) return null
  return { clientId, clientSecret, refreshToken }
}

export function keywordPlannerConfig(env: ApiBindings): KeywordPlannerConfig | null {
  const creds = googleCreds(env, 'contato')
  if (!creds || !env.GOOGLE_ADS_DEVELOPER_TOKEN || !env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) return null
  return { creds, developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN, loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID }
}

export function isGoogleConta(v: unknown): v is GoogleConta {
  return v === 'contato' || v === 'ryan'
}
```

Se o restante de `workers/api/src` importar arquivos locais **com** extensão (`'../bindings.js'`), siga o mesmo padrão aqui e no router.

- [ ] **Step 4: Router**

```ts
// workers/api/src/routes/google.ts
import { Hono } from 'hono'
import {
  GoogleApiError,
  calcularQuickWins,
  createIdeaFromOportunidade,
  getClientGoogle,
  getKeywordVolumes,
  getOportunidade,
  listGscSites,
  listOportunidades,
  marcaTermos,
  queryGscSearchAnalytics,
  saveClientGoogle,
  saveOportunidades,
  setOportunidadeStatus,
} from '@publisher-p12/execution'
import type {
  ClientGoogleView,
  GoogleConta,
  GscSiteOption,
  OportunidadeStatus,
  SyncOportunidadesResult,
} from '@publisher-p12/types'
import type { ApiBindings } from '../bindings'
import { getClient } from '../lib/db'
import { GOOGLE_CONTAS, googleCreds, isGoogleConta, keywordPlannerConfig } from '../lib/google'

const google = new Hono<{ Bindings: ApiBindings }>()

const STATUS_VALIDOS: OportunidadeStatus[] = ['nova', 'em_pauta', 'descartada']

function erroGoogle(e: unknown, padrao: string): { status: 502 | 400; error: string } {
  if (e instanceof GoogleApiError) return { status: 502, error: e.message }
  return { status: 502, error: e instanceof Error ? e.message : padrao }
}

async function sitesDasContas(env: ApiBindings): Promise<{ sites: GscSiteOption[]; erros: ClientGoogleView['erros'] }> {
  const sites: GscSiteOption[] = []
  const erros: ClientGoogleView['erros'] = []
  await Promise.all(
    GOOGLE_CONTAS.map(async (conta) => {
      const creds = googleCreds(env, conta)
      if (!creds) {
        erros.push({ conta, erro: 'Credenciais desta conta não configuradas no Worker' })
        return
      }
      try {
        for (const s of await listGscSites(creds)) sites.push({ site_url: s.siteUrl, conta, permissao: s.permissionLevel })
      } catch (e) {
        erros.push({ conta, erro: e instanceof Error ? e.message : 'Falha ao listar propriedades' })
      }
    }),
  )
  sites.sort((a, b) => a.site_url.localeCompare(b.site_url))
  return { sites, erros }
}

google.get('/:id/google', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const [vinculo, { sites, erros }] = await Promise.all([getClientGoogle(c.env.DB, clientId), sitesDasContas(c.env)])
  const view: ClientGoogleView = { vinculo, sites_disponiveis: sites, erros }
  return c.json(view)
})

google.put('/:id/google', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const body = await c.req
    .json<{ gsc_site_url?: string | null; gsc_conta?: GoogleConta | null }>()
    .catch(() => ({}) as { gsc_site_url?: string | null; gsc_conta?: GoogleConta | null })
  const siteUrl = typeof body.gsc_site_url === 'string' && body.gsc_site_url.trim() ? body.gsc_site_url.trim() : null
  const conta = body.gsc_conta ?? null

  if (siteUrl === null) {
    return c.json(await saveClientGoogle(c.env.DB, clientId, { gsc_site_url: null, gsc_conta: null }))
  }
  if (!isGoogleConta(conta)) return c.json({ error: 'Conta Google inválida (use contato ou ryan)' }, 400)

  const creds = googleCreds(c.env, conta)
  if (!creds) return c.json({ error: 'Credenciais desta conta não configuradas no Worker' }, 400)
  try {
    const sites = await listGscSites(creds)
    if (!sites.some((s) => s.siteUrl === siteUrl)) {
      return c.json({ error: 'Esta conta Google não tem acesso a essa propriedade do Search Console' }, 400)
    }
  } catch (e) {
    const { status, error } = erroGoogle(e, 'Falha ao validar a propriedade')
    return c.json({ error }, status)
  }

  return c.json(await saveClientGoogle(c.env.DB, clientId, { gsc_site_url: siteUrl, gsc_conta: conta }))
})

google.post('/:id/oportunidades/sync', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const vinculo = await getClientGoogle(c.env.DB, clientId)
  if (!vinculo.gsc_site_url || !vinculo.gsc_conta) {
    return c.json({ error: 'Vincule a propriedade do Search Console antes de buscar oportunidades' }, 400)
  }
  const creds = googleCreds(c.env, vinculo.gsc_conta)
  if (!creds) return c.json({ error: 'Credenciais da conta vinculada não configuradas no Worker' }, 400)
  const kp = keywordPlannerConfig(c.env)

  const started = Date.now()
  try {
    const calc = await calcularQuickWins(
      vinculo.gsc_site_url,
      {
        queryGsc: (site, q) => queryGscSearchAnalytics(creds, site, q),
        getVolumes: kp ? (kws) => getKeywordVolumes(kp, kws) : null,
      },
      { marca: marcaTermos(client.nome, client.dominio) },
    )
    await saveOportunidades(c.env.DB, clientId, calc.janela, calc.oportunidades)

    const result: SyncOportunidadesResult = {
      janela: calc.janela,
      queries_analisadas: calc.queriesAnalisadas,
      quick_wins: calc.oportunidades.length,
      com_volume: calc.oportunidades.filter((o) => o.volume_mensal !== null).length,
      keyword_planner_erro: calc.kpErro,
      duration_ms: Date.now() - started,
    }
    return c.json(result)
  } catch (e) {
    const { status, error } = erroGoogle(e, 'Falha ao buscar oportunidades')
    return c.json({ error }, status)
  }
})

google.get('/:id/oportunidades', async (c) => {
  const clientId = c.req.param('id')
  const status = c.req.query('status') as OportunidadeStatus | undefined
  if (status && !STATUS_VALIDOS.includes(status)) return c.json({ error: 'Status inválido' }, 400)
  return c.json(await listOportunidades(c.env.DB, clientId, status))
})

google.post('/:id/oportunidades/:oppId/descartar', async (c) => {
  const ok = await setOportunidadeStatus(c.env.DB, c.req.param('id'), c.req.param('oppId'), 'descartada')
  if (!ok) return c.json({ error: 'Oportunidade não encontrada' }, 404)
  return c.json({ ok: true })
})

google.post('/:id/oportunidades/:oppId/pauta', async (c) => {
  const clientId = c.req.param('id')
  const opp = await getOportunidade(c.env.DB, clientId, c.req.param('oppId'))
  if (!opp) return c.json({ error: 'Oportunidade não encontrada' }, 404)
  if (opp.status === 'em_pauta' && opp.idea_id) return c.json({ idea_id: opp.idea_id })

  const ideaId = await createIdeaFromOportunidade(c.env.DB, clientId, opp)
  await setOportunidadeStatus(c.env.DB, clientId, opp.id, 'em_pauta', ideaId)
  return c.json({ idea_id: ideaId })
})

export default google
```

Em `workers/api/src/index.ts`, importe o router junto dos outros (`import googleRouter from './routes/google'`, seguindo o mesmo estilo de import usado ali) e monte-o depois de `app.route('/clients', corpusRouter)`:

```ts
app.route('/clients', googleRouter)
```

- [ ] **Step 5: Typecheck e testes**

Run: `npx tsc -p workers/api/tsconfig.json --noEmit`
Expected: nenhum erro novo em relação ao baseline do Step 1.

Run: `npx vitest run`
Expected: PASS em toda a suíte.

- [ ] **Step 6: Commit (somente se autorizado)**

```bash
git add workers/api/src/lib/google.ts workers/api/src/routes/google.ts workers/api/src/bindings.ts \
  workers/api/src/index.ts wrangler.jsonc workers/api/wrangler.jsonc scripts/push-worker-secrets.mjs \
  .env.example package.json
git commit -m "feat(api): vínculo do search console e rotas de oportunidades"
```

---

### Task 8: Registro de custo das chamadas de LLM

**Files:**
- Modify: `execution/src/openrouter/client.ts` (só acrescentar; há WIP do usuário no arquivo)
- Create: `execution/src/usage/llmUsage.ts`
- Modify: `execution/src/openrouter/pesquisador.ts`, `redator.ts`, `editor.ts`, `revisor.ts`, `pauteiro.ts` (repassar `onUsage`)
- Modify: `execution/src/index.ts` (export)
- Modify: `workers/pipeline/src/index.ts` (gravador em cada chamada de agente)
- Test: `execution/src/openrouter/client.usage.test.ts` (arquivo novo; **não** editar `client.test.ts`), `execution/src/usage/llmUsage.test.ts`

**Interfaces:**
- Consumes: `FakeD1` (Task 5) e a tabela `llm_usage` (Task 5).
- Produces:
  - `interface LlmUsage { modelo: string; tokensIn: number; tokensOut: number; custoUsd: number | null }` (client.ts)
  - Campo `onUsage?: (usage: LlmUsage) => void | Promise<void>` em `OpenRouterOptions`
  - Campo `onUsage?: OpenRouterOptions['onUsage']` em `PauteiroInput` e nos inputs de pesquisador, redator, editor e revisor
  - `llmUsageRecorder(db: D1Database, ctx: { clientId: string | null; articleId: string | null; jobId: string | null; agente: string }): (u: LlmUsage) => Promise<void>`

- [ ] **Step 1: Write the failing tests**

```ts
// execution/src/openrouter/client.usage.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatCompletion, type LlmUsage } from './client.js'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chatCompletion — uso e custo', () => {
  it('pede usage ao OpenRouter e repassa tokens e custo', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        model: 'anthropic/claude-sonnet-4-5',
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1200, completion_tokens: 300, cost: 0.0081 },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const recebidos: LlmUsage[] = []

    const out = await chatCompletion({ apiKey: 'k', messages: [{ role: 'user', content: 'oi' }], onUsage: (u) => { recebidos.push(u) } })

    expect(out).toBe('ok')
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body)).usage).toEqual({ include: true })
    expect(recebidos).toEqual([{ modelo: 'anthropic/claude-sonnet-4-5', tokensIn: 1200, tokensOut: 300, custoUsd: 0.0081 }])
  })

  it('sem custo na resposta grava null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 10, completion_tokens: 2 } })))
    const recebidos: LlmUsage[] = []
    await chatCompletion({ apiKey: 'k', model: 'x/y', messages: [{ role: 'user', content: 'oi' }], onUsage: (u) => { recebidos.push(u) } })
    expect(recebidos[0]).toEqual({ modelo: 'x/y', tokensIn: 10, tokensOut: 2, custoUsd: null })
  })

  it('falha ao registrar o uso não derruba o agente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } })))
    const out = await chatCompletion({
      apiKey: 'k',
      messages: [{ role: 'user', content: 'oi' }],
      onUsage: async () => { throw new Error('D1 fora do ar') },
    })
    expect(out).toBe('ok')
  })
})
```

```ts
// execution/src/usage/llmUsage.test.ts
import { describe, expect, it } from 'vitest'
import { FakeD1 } from '../test-support/fakeD1.js'
import { llmUsageRecorder } from './llmUsage.js'

describe('llmUsageRecorder', () => {
  it('grava uma linha por chamada com o contexto do job', async () => {
    const db = new FakeD1()
    const gravar = llmUsageRecorder(db, { clientId: 'cli', articleId: 'art', jobId: 'job', agente: 'redigir' })
    await gravar({ modelo: 'anthropic/claude-sonnet-4-5', tokensIn: 1200, tokensOut: 300, custoUsd: 0.0081 })

    const insert = db.executed[0]
    expect(insert.sql).toContain('INSERT INTO llm_usage')
    expect(insert.binds.slice(1)).toEqual(['cli', 'art', 'job', 'redigir', 'anthropic/claude-sonnet-4-5', 1200, 300, 0.0081])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run execution/src/openrouter/client.usage.test.ts execution/src/usage/llmUsage.test.ts`
Expected: FAIL (`LlmUsage` não exportado e `./llmUsage.js` inexistente)

- [ ] **Step 3: Implement in client.ts (acrescentar, sem mexer no WIP)**

Em `execution/src/openrouter/client.ts`:

1. Logo acima de `export interface OpenRouterOptions`, acrescente:

```ts
/** Uso de uma chamada, para o registro de custo (llm_usage). */
export interface LlmUsage {
  modelo: string
  tokensIn: number
  tokensOut: number
  /** USD informado pelo OpenRouter; null quando a resposta não traz custo. */
  custoUsd: number | null
}
```

2. Dentro de `OpenRouterOptions`, depois de `title?: string`, acrescente:

```ts
  /** Recebe tokens e custo de cada chamada. Erros aqui são ignorados — nunca derrubam o agente. */
  onUsage?: (usage: LlmUsage) => void | Promise<void>
```

3. Em `chatCompletion`, logo depois do bloco `if (options.maxTokens) body.max_tokens = options.maxTokens`, acrescente:

```ts
  // OpenRouter devolve tokens e custo (USD) quando pedimos usage accounting
  body.usage = { include: true }
```

4. Troque o tipo de `data` e o final da função:

```ts
  const data = (await res.json()) as {
    model?: string
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenRouter: resposta vazia')

  if (options.onUsage) {
    try {
      await options.onUsage({
        modelo: data.model ?? resolveOpenRouterModel(options.model),
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
        custoUsd: typeof data.usage?.cost === 'number' ? data.usage.cost : null,
      })
    } catch {
      // registro de custo é best-effort
    }
  }
  return content
```

O `chatJson` já repassa `...options` para `chatCompletion`, então o `onUsage` passa por ele sem nenhuma mudança e é chamado a cada tentativa.

- [ ] **Step 4: Gravador**

```ts
// execution/src/usage/llmUsage.ts
/** Grava o uso de cada chamada de LLM em llm_usage (custo por cliente/artigo/agente). */
import type { LlmUsage } from '../openrouter/client.js'
import type { D1Database } from '../types/d1.js'

export interface LlmUsageContexto {
  clientId: string | null
  articleId: string | null
  jobId: string | null
  agente: string
}

export function llmUsageRecorder(db: D1Database, ctx: LlmUsageContexto): (u: LlmUsage) => Promise<void> {
  return async (u) => {
    await db
      .prepare(
        `INSERT INTO llm_usage (id, client_id, article_id, job_id, agente, modelo, tokens_in, tokens_out, custo_usd)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), ctx.clientId, ctx.articleId, ctx.jobId, ctx.agente, u.modelo, u.tokensIn, u.tokensOut, u.custoUsd)
      .run()
  }
}
```

Em `execution/src/index.ts`, acrescente `export * from './usage/llmUsage.js'`.

- [ ] **Step 5: Repassar `onUsage` nos cinco agentes**

Para cada arquivo (`pesquisador.ts`, `redator.ts`, `editor.ts`, `revisor.ts` e `pauteiro.ts`):
1. Na interface de input exportada (por exemplo `PauteiroInput`), acrescente:

```ts
  /** Registro de custo da chamada (ver llmUsageRecorder). */
  onUsage?: OpenRouterOptions['onUsage']
```

   Importe `type OpenRouterOptions` de `'./client.js'` se o arquivo ainda não importar.
2. Em **todo** objeto passado a `chatJson(...)` ou `chatCompletion(...)` dentro do arquivo, acrescente a propriedade `onUsage: input.onUsage,`. Se a variável do input tiver outro nome no arquivo, use esse nome.

- [ ] **Step 6: Gravador no pipeline**

Em `workers/pipeline/src/index.ts`:
1. Importe `llmUsageRecorder` de `'@publisher-p12/execution'` no import existente.
2. Em cada chamada de `runPesquisador`, `runRedator`, `runEditor`, `runRevisor` e `runPauteiro` (o nome exato de cada função está no import de `@publisher-p12/execution` desse arquivo), acrescente ao objeto de input:

```ts
            onUsage: llmUsageRecorder(env.DB, {
              clientId: <id do cliente em escopo>,
              articleId: articleId || null,
              jobId,
              agente: tipo,
            }),
```

   Use `article.client_id` ou `client.id` nos jobs de artigo, onde o cliente já foi carregado antes da chamada, e `clientIdMsg` no `sugerir_pautas`. Se alguma chamada não tiver o cliente em escopo, passe `clientId: null`. **Não** faça uma consulta extra só para isso.

- [ ] **Step 7: Run tests and typecheck**

Run: `npx vitest run`
Expected: PASS em toda a suíte, incluindo `client.test.ts` do usuário, que não muda.

Run: `npm run build -w execution && npx tsc -p workers/pipeline/tsconfig.json --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 8: Commit (somente se autorizado, e só depois de alinhar com o usuário o WIP de client.ts)**

```bash
git add execution/src/usage/llmUsage.ts execution/src/usage/llmUsage.test.ts \
  execution/src/openrouter/client.usage.test.ts execution/src/openrouter/pesquisador.ts \
  execution/src/openrouter/redator.ts execution/src/openrouter/editor.ts \
  execution/src/openrouter/revisor.ts execution/src/openrouter/pauteiro.ts \
  execution/src/index.ts workers/pipeline/src/index.ts
# client.ts só entra com o ok do usuário (contém o WIP dele):
# git add execution/src/openrouter/client.ts
git commit -m "feat(custos): registra tokens e custo de cada chamada de LLM"
```

---

### Task 9: Pauteiro usa a demanda real do Google

**Files:**
- Modify: `execution/src/openrouter/pauteiro.ts`
- Modify: `workers/pipeline/src/index.ts` (case `sugerir_pautas`)
- Test: `execution/src/openrouter/pauteiro.test.ts` (acrescentar um `describe`)

**Interfaces:**
- Consumes: `listOportunidades` (Task 5) e o `PauteiroInput` atual.
- Produces:
  - `interface OportunidadePrompt { query: string; page_url: string | null; posicao: number; impressoes: number; volume_mensal: number | null }`
  - Campo `oportunidades?: OportunidadePrompt[]` em `PauteiroInput`
  - `buildPauteiroUserMessage(input: PauteiroInput, quantidade: number, digest: DigestItem[], truncado: boolean): string`

- [ ] **Step 1: Write the failing test**

Acrescente em `execution/src/openrouter/pauteiro.test.ts`. Mantenha os testes que já existem e só acrescente `buildPauteiroUserMessage` ao import de `./pauteiro.js`:

```ts
describe('buildPauteiroUserMessage', () => {
  const base = { corpus: [], perfil: null, apiKey: 'k' }

  it('inclui a demanda do Google e a instrução de priorizar quando há oportunidades', () => {
    const msg = buildPauteiroUserMessage(
      { ...base, oportunidades: [{ query: 'consultoria de ti', page_url: 'https://abx/ti', posicao: 10.8, impressoes: 64, volume_mensal: 720 }] },
      5,
      [],
      false,
    )
    expect(msg).toContain('"demanda_google"')
    expect(msg).toContain('consultoria de ti')
    expect(msg).toContain('priorize')
  })

  it('sem oportunidades mantém a mensagem antiga', () => {
    const msg = buildPauteiroUserMessage(base, 5, [], false)
    expect(msg.startsWith('Proponha 5 pautas novas:')).toBe(true)
    expect(msg).not.toContain('demanda_google')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run execution/src/openrouter/pauteiro.test.ts`
Expected: FAIL ("buildPauteiroUserMessage is not a function" ou import inexistente)

- [ ] **Step 3: Implement**

Em `execution/src/openrouter/pauteiro.ts`:

1. Acima de `export interface PauteiroInput`, acrescente:

```ts
/** Busca real do Search Console (quick win) que o Pauteiro deve considerar. */
export interface OportunidadePrompt {
  query: string
  page_url: string | null
  posicao: number
  impressoes: number
  volume_mensal: number | null
}
```

2. Em `PauteiroInput`, acrescente:

```ts
  /** Quick wins do Search Console com volume do Keyword Planner — demanda medida, não estimada. */
  oportunidades?: OportunidadePrompt[]
```

3. Acrescente a função e passe a usá-la em `runPauteiro`:

```ts
const INSTRUCAO_DEMANDA =
  'Em "demanda_google" estão buscas reais do Google em que o site já aparece entre as posições 4 e 20 ' +
  '(impressões dos últimos 28 dias e volume mensal do Keyword Planner). Quando fizer sentido, priorize pautas ' +
  'que atendam essas buscas, sem competir com a página que já ranqueia: proponha um ângulo complementar e ' +
  'inclua essa página em artigos_relacionados.'

export function buildPauteiroUserMessage(
  input: PauteiroInput,
  quantidade: number,
  digest: DigestItem[],
  truncado: boolean,
): string {
  const oportunidades = input.oportunidades ?? []
  const userContent = JSON.stringify({
    quantidade,
    foco: input.foco ?? null,
    categorias_wp: input.categorias ?? [],
    pautas_ja_sugeridas: input.pautasExistentes ?? [],
    ...(oportunidades.length > 0 ? { demanda_google: oportunidades } : {}),
    corpus_truncado: truncado,
    inventario_publicado: digest,
  })
  const pedido = `Proponha ${quantidade} pautas novas:\n${userContent}`
  return oportunidades.length > 0 ? `${pedido}\n\n${INSTRUCAO_DEMANDA}` : pedido
}
```

   Dentro de `runPauteiro`, apague a montagem atual de `userContent` (o `JSON.stringify({ quantidade, ... })`). Troque o `content` da mensagem `user` por `buildPauteiroUserMessage(input, quantidade, digest, truncado)`. Se `buildCorpusDigest` devolver `digest` com outro tipo que não `DigestItem[]`, use esse tipo na assinatura.

4. Em `workers/pipeline/src/index.ts`, no `case 'sugerir_pautas'`, importe `listOportunidades` de `'@publisher-p12/execution'` e passe as oportunidades para o `runPauteiro`:

```ts
          const oportunidades = (await listOportunidades(env.DB, clientIdMsg, 'nova'))
            .slice(0, 20)
            .map((o) => ({
              query: o.query,
              page_url: o.page_url,
              posicao: o.posicao,
              impressoes: o.impressoes,
              volume_mensal: o.volume_mensal,
            }))
```

   e, no objeto passado a `runPauteiro`, acrescente `oportunidades,`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npx vitest run execution/src/openrouter/pauteiro.test.ts && npx vitest run`
Expected: PASS

Run: `npx tsc -p workers/pipeline/tsconfig.json --noEmit`
Expected: nenhum erro novo.

- [ ] **Step 5: Commit (somente se autorizado)**

```bash
git add execution/src/openrouter/pauteiro.ts execution/src/openrouter/pauteiro.test.ts workers/pipeline/src/index.ts
git commit -m "feat(pauteiro): prioriza buscas reais do search console"
```

---

### Task 10: Aba "Google" no cliente

**Files:**
- Modify: `frontend/lib/api.ts`
- Create: `frontend/components/google-panel.tsx`
- Modify: `frontend/app/clients/[id]/page.tsx`

**Interfaces:**
- Consumes: as rotas da Task 7 e os tipos da Task 5.
- Produces: `api.google.get/salvar` e `api.oportunidades.list/sync/descartar/virarPauta`, além de `<GooglePanel clientId />`.

- [ ] **Step 1: API client**

Em `frontend/lib/api.ts`:
- Acrescente ao import de tipos de `@publisher-p12/types`: `ClientGoogle`, `ClientGoogleView`, `GoogleConta`, `Oportunidade`, `OportunidadeStatus` e `SyncOportunidadesResult`.
- Acrescente dentro do objeto `export const api = { ... }`, depois de `pautas`:

```ts
  google: {
    get: (clientId: string) => apiFetch<ClientGoogleView>(`/clients/${clientId}/google`),
    salvar: (clientId: string, body: { gsc_site_url: string | null; gsc_conta: GoogleConta | null }) =>
      apiFetch<ClientGoogle>(`/clients/${clientId}/google`, { method: 'PUT', body: JSON.stringify(body) }),
  },
  oportunidades: {
    list: (clientId: string, status?: OportunidadeStatus) =>
      apiFetch<Oportunidade[]>(`/clients/${clientId}/oportunidades${status ? `?status=${status}` : ''}`),
    sync: (clientId: string) =>
      apiFetch<SyncOportunidadesResult>(`/clients/${clientId}/oportunidades/sync`, { method: 'POST' }),
    descartar: (clientId: string, oppId: string) =>
      apiFetch<{ ok: true }>(`/clients/${clientId}/oportunidades/${oppId}/descartar`, { method: 'POST' }),
    virarPauta: (clientId: string, oppId: string) =>
      apiFetch<{ idea_id: string }>(`/clients/${clientId}/oportunidades/${oppId}/pauta`, { method: 'POST' }),
  },
```

- [ ] **Step 2: Painel**

Antes de escrever, confira as props reais de `Panel`, `Button`, `Badge`, `EmptyState` e `Notice` em `frontend/components/ui/*.tsx` e ajuste os nomes caso algum seja diferente do uso abaixo, que repete o que `knowledge-base-panel.tsx` já faz.

```tsx
// frontend/components/google-panel.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FilePlus2, LineChart, RefreshCw, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { ListSkeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import type { ClientGoogleView, GoogleConta, Oportunidade, SyncOportunidadesResult } from '@publisher-p12/types'

const ROTULO_CONTA: Record<GoogleConta, string> = { contato: 'Conta Contato', ryan: 'Conta Ryan' }
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

interface GooglePanelProps {
  clientId: string
}

export function GooglePanel({ clientId }: GooglePanelProps) {
  const [view, setView] = useState<ClientGoogleView | null>(null)
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [selecao, setSelecao] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [acao, setAcao] = useState<string | null>(null)
  const [resultado, setResultado] = useState<SyncOportunidadesResult | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    const [novaView, lista] = await Promise.all([api.google.get(clientId), api.oportunidades.list(clientId, 'nova')])
    setView(novaView)
    setOportunidades(lista)
    const { gsc_site_url, gsc_conta } = novaView.vinculo
    setSelecao(gsc_site_url && gsc_conta ? `${gsc_conta}|${gsc_site_url}` : '')
  }, [clientId])

  useEffect(() => {
    recarregar()
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [recarregar])

  async function salvarVinculo() {
    setErro(null)
    setSalvando(true)
    try {
      const [conta, ...resto] = selecao.split('|')
      const site = resto.join('|')
      await api.google.salvar(clientId, selecao ? { gsc_site_url: site, gsc_conta: conta as GoogleConta } : { gsc_site_url: null, gsc_conta: null })
      await recarregar()
      setAviso('Propriedade do Search Console vinculada.')
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function buscarOportunidades() {
    setErro(null)
    setAviso(null)
    setSincronizando(true)
    try {
      setResultado(await api.oportunidades.sync(clientId))
      setOportunidades(await api.oportunidades.list(clientId, 'nova'))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSincronizando(false)
    }
  }

  async function virarPauta(op: Oportunidade) {
    setAcao(op.id)
    try {
      await api.oportunidades.virarPauta(clientId, op.id)
      setOportunidades((lista) => lista.filter((o) => o.id !== op.id))
      setAviso(`"${op.query}" virou pauta — veja na aba Base e pautas.`)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setAcao(null)
    }
  }

  async function descartar(op: Oportunidade) {
    setAcao(op.id)
    try {
      await api.oportunidades.descartar(clientId, op.id)
      setOportunidades((lista) => lista.filter((o) => o.id !== op.id))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setAcao(null)
    }
  }

  if (carregando) return <ListSkeleton rows={3} label="Carregando dados do Google" />

  const vinculado = Boolean(view?.vinculo.gsc_site_url)
  const selecaoAtual = view?.vinculo.gsc_site_url ? `${view.vinculo.gsc_conta}|${view.vinculo.gsc_site_url}` : ''

  return (
    <div className="space-y-6">
      {erro && <Notice tone="danger" title={erro} />}
      {aviso && <Notice tone="success" title={aviso} />}

      <Panel icon={<Search />} title="Search Console" description="Escolha a propriedade deste cliente. As duas contas Google da agência são consultadas.">
        {view?.erros.map((e) => (
          <Notice key={e.conta} tone="warning" title={`${ROTULO_CONTA[e.conta]}: ${e.erro}`} className="mb-3" />
        ))}
        <label className="field-label" htmlFor="gsc-site">Propriedade</label>
        <div className="flex flex-wrap items-center gap-3">
          <select id="gsc-site" className="field-input max-w-xl" value={selecao} onChange={(e) => setSelecao(e.target.value)}>
            <option value="">Nenhuma</option>
            {view?.sites_disponiveis.map((s) => (
              <option key={`${s.conta}|${s.site_url}`} value={`${s.conta}|${s.site_url}`}>
                {s.site_url} — {ROTULO_CONTA[s.conta]}
              </option>
            ))}
          </select>
          <Button onClick={salvarVinculo} loading={salvando} loadingText="Salvando…" disabled={selecao === selecaoAtual}>
            Salvar
          </Button>
        </div>
        {view?.vinculo.updated_at && <p className="field-help">Atualizado em {formatDateTime(view.vinculo.updated_at)}</p>}
      </Panel>

      <Panel
        icon={<LineChart />}
        title={
          <span className="flex items-center gap-2">
            Oportunidades (quick wins)
            {oportunidades.length > 0 && <Badge tone="brand" className="tabular-nums">{oportunidades.length}</Badge>}
          </span>
        }
        description="Buscas em que o site já aparece entre as posições 4 e 20 nos últimos 28 dias, com o volume mensal do Keyword Planner."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button onClick={buscarOportunidades} loading={sincronizando} loadingText="Consultando o Google…" disabled={!vinculado}>
            <RefreshCw aria-hidden />
            Buscar oportunidades
          </Button>
          {resultado && (
            <span className="text-sm text-muted">
              {num(resultado.queries_analisadas)} buscas analisadas, {resultado.quick_wins} quick wins, {resultado.com_volume} com volume ·{' '}
              {resultado.janela.inicio} a {resultado.janela.fim}
            </span>
          )}
        </div>
        {resultado?.keyword_planner_erro && (
          <Notice tone="warning" title={`Sem volume do Keyword Planner: ${resultado.keyword_planner_erro}`} className="mb-4" />
        )}

        {oportunidades.length === 0 ? (
          <EmptyState
            compact
            icon={<LineChart />}
            title={vinculado ? 'Nenhuma oportunidade aberta' : 'Vincule o Search Console'}
            description={vinculado ? 'Clique em Buscar oportunidades para consultar os últimos 28 dias.' : 'Escolha a propriedade acima para começar.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Busca</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Posição</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Impressões</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Volume/mês</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Score</th>
                  <th className="py-2 font-medium"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {oportunidades.map((op) => (
                  <tr key={op.id}>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{op.query}</div>
                      {op.page_url && (
                        <a href={op.page_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:underline">
                          {op.page_url.replace(/^https?:\/\//, '')}
                          <ExternalLink aria-hidden className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{num(op.posicao)}</td>
                    <td className="py-3 pr-4 tabular-nums">{num(op.impressoes)}</td>
                    <td className="py-3 pr-4 tabular-nums">{op.volume_mensal === null ? '—' : num(op.volume_mensal)}</td>
                    <td className="py-3 pr-4"><Badge tone="brand" className="tabular-nums">{op.score}</Badge></td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => virarPauta(op)} loading={acao === op.id} disabled={Boolean(acao)}>
                          <FilePlus2 aria-hidden />
                          Virar pauta
                        </Button>
                        <Button onClick={() => descartar(op)} disabled={Boolean(acao)} aria-label={`Descartar ${op.query}`}>
                          <X aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
```

- [ ] **Step 3: Aba na página do cliente**

Em `frontend/app/clients/[id]/page.tsx`:
- `const ABAS = ['dados', 'perfil', 'base', 'google', 'categorias', 'materiais'] as const`
- Em `ABA_ROTULO`, acrescente `google: 'Google',`.
- Em `tabItems`, logo depois do item `base`, acrescente `{ value: 'google', label: ABA_ROTULO.google, icon: <LineChart aria-hidden /> },` e inclua `LineChart` no import do `lucide-react`.
- Importe `import { GooglePanel } from '@/components/google-panel'`.
- Depois de `{tab === 'base' && <KnowledgeBasePanel clientId={id} />}`, acrescente `{tab === 'google' && <GooglePanel clientId={id} />}`.

- [ ] **Step 4: Typecheck e build**

Run: `npx tsc -p frontend/tsconfig.json --noEmit`
Expected: nenhum erro novo.

Run: `npm run build -w frontend`
Expected: build concluído. O `next build` roda sem workerd; se falhar por motivo de ambiente que não seja deste código, registre e siga com o typecheck.

- [ ] **Step 5: Verificação visual (opcional)**

Use o procedimento da memória `preview-local-com-mock` (stub do OpenNext + mock da API + screenshot via CDP). O mock deve devolver `ClientGoogleView` com 2 sites e 3 oportunidades. Confira a aba **Google** em 1280px e em 390px de largura, sem rolagem horizontal da página. Só a tabela pode rolar dentro do seu contêiner.

- [ ] **Step 6: Commit (somente se autorizado)**

```bash
git add frontend/lib/api.ts frontend/components/google-panel.tsx "frontend/app/clients/[id]/page.tsx"
git commit -m "feat(frontend): aba Google com vínculo do search console e oportunidades"
```

---

### Task 11: Diretiva, documentação e entrega em produção

**Files:**
- Create (**somente se o usuário aprovou o plano com esta diretiva**): `directives/oportunidades_google.md`
- Modify: `directives/README.md` (linha no índice, se a diretiva for criada), `README.md` (seção Credenciais)

**Interfaces:**
- Consumes: tudo o que foi feito antes.
- Produces: documentação e a fatia rodando em produção.

- [ ] **Step 1: Diretiva (com aprovação)**

```markdown
# Oportunidades do Google (quick wins)

## Objetivo
Encontrar buscas em que o site do cliente já aparece entre as posições 4 e 20 do Google e priorizá-las
por demanda real (Keyword Planner), para virar pauta ou orientar a otimização da página que já ranqueia.

## Entradas
- Vínculo do cliente com o Search Console (`client_google`): propriedade e conta (`contato` | `ryan`).
- Credenciais no Worker da API: `GOOGLE_ADS_*` (conta contato — também é a do Keyword Planner) e `GOOGLE_DATA_*` (conta ryan).
- MCC do Keyword Planner: `GOOGLE_ADS_LOGIN_CUSTOMER_ID` = 3780611396.

## Execução
1. `execution/src/opportunities/sync.ts` → `calcularQuickWins`: Search Console (28 dias terminando 3 dias atrás, dimensões busca × página).
2. `quickWins.ts`: agrega variações da mesma busca, tira buscas de marca (`marcaTermos`), mantém posição 4–20 com ≥ 20 impressões, até 100.
3. `keywordPlanner.ts`: volume mensal no Brasil, em português. Falhou? Salva sem volume e mostra o aviso — não bloqueia.
4. Score 0–100 = 40% demanda + 35% ganho de cliques até o CTR da posição 3 (10%) + 25% proximidade do top 3.
5. `store.ts`: upsert por (cliente, tipo, busca normalizada). Nova sincronização nunca muda o status; oportunidades `nova` que sumiram saem.

## Saídas
- Tabela `opportunities`; aba **Google** do cliente; botão "Virar pauta" cria `article_ideas` com justificativa e a página que já ranqueia em `artigos_relacionados`.
- Pauteiro recebe as 20 melhores oportunidades `nova` como `demanda_google`.

## Edge cases
- 403 `SERVICE_DISABLED`: ativar a Search Console API no projeto do client OAuth.
- 429 com cota 0: projeto do Google Cloud sem aprovação para a API.
- `invalid_grant`: refresh token revogado — gerar outro com o mesmo client e os mesmos escopos.
- Keyword Planner `CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION`: developer token só com acesso de teste naquele projeto. As credenciais `GOOGLE_ADS_*` (projeto 253030348436) têm acesso de produção.
- Busca de marca com nome muito curto (< 4 letras) não é filtrada: descartar na UI.

## Aprendizados
- (registrar aqui o que mudar ao rodar com clientes reais)
```

Se a diretiva for criada, acrescente esta linha na tabela "Índice" de `directives/README.md`:

```markdown
| `oportunidades_google.md` | Quick wins do Search Console + volume do Keyword Planner |
```

No `README.md`, na lista de "Credenciais", acrescente:

```markdown
- `GOOGLE_ADS_*` / `GOOGLE_DATA_*` — contas Google da agência (Search Console, Keyword Planner). `GOOGLE_ADS_LOGIN_CUSTOMER_ID` é var no `wrangler.jsonc`.
```

- [ ] **Step 2: Suíte completa**

Run: `npx vitest run && npm run build -w execution && npx tsc -p workers/api/tsconfig.json --noEmit && npx tsc -p workers/pipeline/tsconfig.json --noEmit && npx tsc -p frontend/tsconfig.json --noEmit`
Expected: tudo verde, sem erros novos.

- [ ] **Step 3: Produção (ações externas, cada uma com confirmação explícita do usuário)**

**Pare e peça confirmação** antes de cada comando. São ações em produção.

```bash
npm run cf:d1:migrate:009:remote        # cria client_google, opportunities, llm_usage no D1 de produção
npm run cf:secrets:push:api             # envia GOOGLE_ADS_* e GOOGLE_DATA_* para o Worker da API
npm run cf:deploy:pipeline
npm run cf:deploy:api
```

Frontend: siga a memória `deploy-frontend-manual`, porque um push na main não publica o frontend.

- [ ] **Step 4: Smoke test com a ABX**

1. Na aba **Google** da ABX, escolha `https://abxtelecom.com.br/ — Conta Contato` e clique em Salvar.
2. Clique em **Buscar oportunidades**. Esperado, com base nos dados de 02/10/2026: cerca de 500 buscas analisadas e de 10 a 20 quick wins, com "consultoria de ti" (720/mês) e "comunicação unificada" entre eles e sem nenhuma busca com "abx".
3. Clique em **Virar pauta** em "consultoria de ti" e confira se a pauta aparece em "Base e pautas", com a justificativa e a página em artigos relacionados.
4. Clique em **Sugerir pautas** (aba Base) e confira se ao menos uma pauta cita uma busca de `demanda_google`.
5. Gere um artigo e confira as linhas em `llm_usage` com `custo_usd`. A consulta é só leitura:

```bash
node scripts/cf-with-env.mjs npx wrangler d1 execute publisher-db --remote --config workers/api/wrangler.jsonc \
  --command "SELECT agente, modelo, COUNT(*) n, SUM(tokens_in) tin, SUM(tokens_out) tout, ROUND(SUM(custo_usd),4) usd FROM llm_usage GROUP BY agente, modelo"
```

- [ ] **Step 5: Commit final (somente se autorizado)**

```bash
git add directives/oportunidades_google.md directives/README.md README.md
git commit -m "docs: diretiva de oportunidades do Google e credenciais"
```
