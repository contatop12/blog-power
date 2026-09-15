import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  countWords,
  fetchPublishedPosts,
  htmlToPlainText,
  mapWpPostToCorpus,
  type WpRawPost,
} from './corpus.js'

const CREDS = {
  wpApiUrl: 'https://exemplo.com/wp-json',
  wpUser: 'user',
  wpAppPassword: 'pass',
}

function rawPost(overrides: Partial<WpRawPost> = {}): WpRawPost {
  return {
    id: 10,
    date_gmt: '2026-01-05T10:00:00',
    modified_gmt: '2026-02-01T09:30:00',
    slug: 'link-dedicado',
    link: 'https://exemplo.com/link-dedicado/',
    title: { rendered: 'Link dedicado &#8211; guia' },
    excerpt: { rendered: '<p>Resumo do artigo.</p>' },
    content: { rendered: '<p>Primeiro parágrafo.</p><p>Segundo.</p>' },
    ...overrides,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('htmlToPlainText', () => {
  it('remove comentários Gutenberg, tags e scripts', () => {
    const html = [
      '<!-- wp:paragraph -->',
      '<p>Texto <strong>importante</strong>.</p>',
      '<!-- /wp:paragraph -->',
      '<script>alert(1)</script>',
      '<style>.a{color:red}</style>',
      '<h2>Título</h2>',
    ].join('\n')

    expect(htmlToPlainText(html)).toBe('Texto importante.\nTítulo')
  })

  it('decodifica entidades HTML comuns e numéricas', () => {
    expect(htmlToPlainText('<p>Pre&ccedil;o &#8211; 100&nbsp;Mbps &amp; mais</p>')).toBe(
      'Preço – 100 Mbps & mais',
    )
  })

  it('devolve string vazia para html vazio', () => {
    expect(htmlToPlainText('')).toBe('')
    expect(htmlToPlainText('<p></p>')).toBe('')
  })
})

describe('countWords', () => {
  it('conta palavras ignorando espaços múltiplos', () => {
    expect(countWords('  um   dois três\nquatro ')).toBe(4)
    expect(countWords('')).toBe(0)
  })
})

describe('mapWpPostToCorpus', () => {
  it('extrai categorias e tags de _embedded wp:term', () => {
    const post = mapWpPostToCorpus(
      rawPost({
        _embedded: {
          'wp:term': [
            [{ id: 3, name: 'Conectividade', taxonomy: 'category' }],
            [
              { id: 7, name: 'SD-WAN', taxonomy: 'post_tag' },
              { id: 8, name: 'MPLS', taxonomy: 'post_tag' },
            ],
          ],
        },
      }),
      'post',
    )

    expect(post.categorias).toEqual([{ id: 3, name: 'Conectividade' }])
    expect(post.tags).toEqual([
      { id: 7, name: 'SD-WAN' },
      { id: 8, name: 'MPLS' },
    ])
  })

  it('normaliza título, conteúdo e datas em UTC', () => {
    const post = mapWpPostToCorpus(rawPost(), 'post')

    expect(post.titulo).toBe('Link dedicado – guia')
    expect(post.conteudo_txt).toBe('Primeiro parágrafo.\nSegundo.')
    expect(post.excerpt).toBe('Resumo do artigo.')
    expect(post.palavras).toBe(3)
    expect(post.wp_modified).toBe('2026-02-01T09:30:00Z')
    expect(post.publicado_em).toBe('2026-01-05T10:00:00Z')
    expect(post.wp_post_type).toBe('post')
  })

  it('sem _embedded devolve listas vazias', () => {
    const post = mapWpPostToCorpus(rawPost(), 'page')
    expect(post.categorias).toEqual([])
    expect(post.tags).toEqual([])
  })
})

describe('fetchPublishedPosts', () => {
  it('pagina até a página incompleta e agrega os resultados', async () => {
    const urls: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      urls.push(url)
      if (/[?&]page=1&/.test(url)) {
        return jsonResponse([rawPost({ id: 1 }), rawPost({ id: 2 })])
      }
      return jsonResponse([rawPost({ id: 3 })])
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPublishedPosts({ creds: CREDS, perPage: 2 })

    expect(result.posts.map((p) => p.wp_post_id)).toEqual([1, 2, 3])
    expect(result.paginas_lidas).toBe(2)
    expect(urls[0]).toContain('/wp/v2/posts?')
    expect(urls[0]).toContain('status=publish')
    expect(urls[0]).toContain('per_page=2')
    expect(urls[0]).toContain('_embed=wp%3Aterm')
  })

  it('encerra sem erro quando o WP recusa a página seguinte', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (/[?&]page=1&/.test(String(input))) {
        return jsonResponse([rawPost({ id: 1 })])
      }
      return jsonResponse({ code: 'rest_post_invalid_page_number' }, 400)
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPublishedPosts({ creds: CREDS, perPage: 1 })

    expect(result.posts).toHaveLength(1)
    expect(result.paginas_lidas).toBe(1)
  })

  it('propaga erro de autenticação', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ code: 'rest_forbidden' }, 401)),
    )

    await expect(fetchPublishedPosts({ creds: CREDS })).rejects.toThrow(/WordPress 401/)
  })

  it('envia modified_after quando é sync incremental', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(String(input))
        return jsonResponse([])
      }),
    )

    await fetchPublishedPosts({ creds: CREDS, modifiedAfter: '2026-02-01T09:30:00Z' })

    expect(urls[0]).toContain('modified_after=2026-02-01T09%3A30%3A00')
  })

  it('respeita maxPaginas como trava de segurança', async () => {
    const fetchMock = vi.fn(async () => jsonResponse([rawPost()]))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchPublishedPosts({ creds: CREDS, perPage: 1, maxPaginas: 3 })

    expect(result.paginas_lidas).toBe(3)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
