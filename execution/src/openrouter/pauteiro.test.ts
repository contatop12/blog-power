import { describe, expect, it } from 'vitest'
import type { CorpusPromptItem } from '../corpus/store.js'
import { buildCorpusDigest, normalizePautas } from './pauteiro.js'

function item(i: number, overrides: Partial<CorpusPromptItem> = {}): CorpusPromptItem {
  return {
    titulo: `Artigo ${i}`,
    url: `https://exemplo.com/artigo-${i}/`,
    categorias: ['Conectividade'],
    publicado_em: '2026-01-05T10:00:00Z',
    palavras: 1200,
    excerpt: 'Resumo curto do artigo.',
    ...overrides,
  }
}

describe('buildCorpusDigest', () => {
  it('compacta cada post em chaves curtas e data sem hora', () => {
    const { digest, truncado } = buildCorpusDigest([item(1)])

    expect(truncado).toBe(false)
    expect(digest[0]).toEqual({
      t: 'Artigo 1',
      u: 'https://exemplo.com/artigo-1/',
      c: 'Conectividade',
      d: '2026-01-05',
      w: 1200,
      e: 'Resumo curto do artigo.',
    })
  })

  it('corta no limite de chars e sinaliza truncamento', () => {
    const items = Array.from({ length: 200 }, (_, i) => item(i))
    const { digest, truncado } = buildCorpusDigest(items, { maxChars: 2000 })

    expect(truncado).toBe(true)
    expect(digest.length).toBeGreaterThan(0)
    expect(digest.length).toBeLessThan(items.length)
    // Preserva a ordem recebida (mais recentes primeiro)
    expect(digest[0].t).toBe('Artigo 0')
  })

  it('aceita corpus vazio', () => {
    expect(buildCorpusDigest([])).toEqual({ digest: [], truncado: false })
  })
})

describe('normalizePautas', () => {
  it('preenche defaults e descarta itens sem tema ou kw', () => {
    const pautas = normalizePautas(
      [
        { tema: 'Guia de SD-WAN', kw_principal: 'sd-wan' },
        { tema: '', kw_principal: 'sem tema' },
        { kw_principal: '' },
      ],
      5,
    )

    expect(pautas).toHaveLength(1)
    expect(pautas[0]).toMatchObject({
      tema: 'Guia de SD-WAN',
      kw_principal: 'sd-wan',
      kws_secundarias: [],
      artigos_relacionados: [],
      risco_canibalizacao: null,
    })
    expect(pautas[0].extensao_alvo).toBeGreaterThan(0)
  })

  it('respeita o limite pedido', () => {
    const brutas = Array.from({ length: 10 }, (_, i) => ({
      tema: `Tema ${i}`,
      kw_principal: `kw ${i}`,
    }))
    expect(normalizePautas(brutas, 3)).toHaveLength(3)
  })

  it('devolve lista vazia para payload inválido', () => {
    expect(normalizePautas(null, 5)).toEqual([])
    expect(normalizePautas({ pautas: [] }, 5)).toEqual([])
  })

  it('mantém apenas URLs http(s) em artigos_relacionados', () => {
    const [pauta] = normalizePautas(
      [
        {
          tema: 'Tema',
          kw_principal: 'kw',
          artigos_relacionados: [
            'https://exemplo.com/a/',
            'javascript:alert(1)',
            '',
            'http://exemplo.com/b/',
          ],
        },
      ],
      5,
    )

    expect(pauta.artigos_relacionados).toEqual([
      'https://exemplo.com/a/',
      'http://exemplo.com/b/',
    ])
  })
})
