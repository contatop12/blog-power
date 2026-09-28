import { afterEach, describe, expect, it, vi } from 'vitest'
import { testWordPressConnection } from './testConnection.js'

const CREDS = {
  wpApiUrl: 'https://exemplo.com/wp-json',
  wpUser: 'user',
  wpAppPassword: 'pass',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Simula um WP real: `GET /wp/v2/types/post` devolve o objeto do tipo (sem `schema`);
 * o schema com os meta fields só aparece em `OPTIONS /wp/v2/posts`.
 */
function stubWordPress(postMetaKeys: string[]) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const path = url.replace(CREDS.wpApiUrl, '')

    if (method === 'GET' && path === '/wp/v2/users/me') return jsonResponse({ id: 1, name: 'admin' })
    if (method === 'GET' && path === '/wp/v2/users/me?context=edit') {
      return jsonResponse({ id: 1, name: 'admin', capabilities: { edit_posts: true } })
    }
    if (method === 'GET' && path === '/') return jsonResponse({ namespaces: ['wp/v2', 'yoast/v1'] })
    if (method === 'GET' && path.startsWith('/wp/v2/types/')) {
      return jsonResponse({ name: 'Posts', slug: 'post', rest_base: 'posts', rest_namespace: 'wp/v2' })
    }
    if (method === 'OPTIONS' && (path === '/wp/v2/posts' || path === '/wp/v2/pages')) {
      const properties = Object.fromEntries(postMetaKeys.map((key) => [key, { type: 'string' }]))
      return jsonResponse({ namespace: 'wp/v2', schema: { properties: { meta: { properties } } } })
    }
    return jsonResponse({ code: 'rest_no_route' }, 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('testWordPressConnection — P12 Bridge', () => {
  it('detecta o plugin quando p12_schema_jsonld está no schema REST de posts', async () => {
    stubWordPress(['_yoast_wpseo_title', 'p12_schema_jsonld'])

    const result = await testWordPressConnection(CREDS)

    const bridge = result.itens.find((item) => item.nome === 'mu-plugin P12 Bridge')
    expect(bridge?.ok).toBe(true)
    expect(result.status_conexao).toBe('ok')
  })

  it('marca o plugin como ausente quando o meta field não está registrado', async () => {
    stubWordPress(['_yoast_wpseo_title'])

    const result = await testWordPressConnection(CREDS)

    const bridge = result.itens.find((item) => item.nome === 'mu-plugin P12 Bridge')
    expect(bridge?.ok).toBe(false)
    expect(result.status_conexao).toBe('atencao')
  })
})
