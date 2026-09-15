import { describe, expect, it } from 'vitest'
import type { Briefing } from '@publisher-p12/types'
import {
  briefingTerms,
  extractTrecho,
  normalizeUrlKey,
  rankRelatedPosts,
  tokenize,
  type LinkCandidateSource,
} from './related.js'

function briefing(overrides: Partial<Briefing> = {}): Briefing {
  return {
    tema: 'Como escolher link dedicado para empresas',
    kw_principal: 'link dedicado',
    kws_secundarias: ['internet corporativa', 'SLA de conectividade'],
    intencao: 'comercial',
    etapa_funil: 'meio',
    angulo: 'comparativo técnico',
    publico: 'gestores de TI',
    extensao_alvo: 1500,
    artigos_irmaos: [],
    ...overrides,
  }
}

function post(overrides: Partial<LinkCandidateSource> = {}): LinkCandidateSource {
  return {
    titulo: 'Post genérico',
    url: 'https://abx.com.br/post-generico/',
    categorias: [],
    tags: [],
    excerpt: '',
    ...overrides,
  }
}

describe('tokenize', () => {
  it('remove acentos, stopwords e tokens curtos', () => {
    expect(tokenize('A Conectividade das Empresas é crítica')).toEqual([
      'conectividade',
      'empresa',
      'critica',
    ])
  })

  it('reduz plural simples para casar singular e plural', () => {
    expect(tokenize('links dedicados')).toEqual(tokenize('link dedicado'))
  })
})

describe('normalizeUrlKey', () => {
  it('ignora protocolo, www, barra final e maiúsculas no host', () => {
    expect(normalizeUrlKey('https://www.ABX.com.br/link-dedicado/')).toBe(
      normalizeUrlKey('http://abx.com.br/link-dedicado'),
    )
  })

  it('preserva o caminho', () => {
    expect(normalizeUrlKey('https://abx.com.br/a/')).not.toBe(
      normalizeUrlKey('https://abx.com.br/b/'),
    )
  })
})

describe('briefingTerms', () => {
  it('dá mais peso à KW principal do que ao tema', () => {
    const { pesos } = briefingTerms(briefing())
    expect(pesos.get('dedicado')).toBeGreaterThan(pesos.get('escolher') ?? 0)
  })
})

describe('rankRelatedPosts', () => {
  const corpus = [
    post({ titulo: 'Receita de bolo de cenoura', url: 'https://abx.com.br/bolo/' }),
    post({
      titulo: 'Link dedicado ou banda larga: qual contratar',
      url: 'https://abx.com.br/link-dedicado-vs-banda-larga/',
    }),
    post({
      titulo: 'Entenda o SLA de conectividade',
      url: 'https://abx.com.br/sla/',
      categorias: ['Conectividade'],
    }),
    post({
      titulo: 'Firewall para pequenas empresas',
      url: 'https://abx.com.br/firewall/',
      excerpt: 'Proteja a internet corporativa da sua empresa.',
    }),
  ]

  it('ordena por relevância e descarta posts sem relação', () => {
    const ranked = rankRelatedPosts(briefing(), corpus)
    const urls = ranked.map((r) => r.post.url)

    expect(urls[0]).toBe('https://abx.com.br/link-dedicado-vs-banda-larga/')
    expect(urls).toContain('https://abx.com.br/sla/')
    expect(urls).not.toContain('https://abx.com.br/bolo/')
  })

  it('expõe os termos que casaram, para extrair o trecho depois', () => {
    const [primeiro] = rankRelatedPosts(briefing(), corpus)
    expect(primeiro.termos).toEqual(expect.arrayContaining(['link', 'dedicado']))
  })

  it('exclui a URL do próprio artigo', () => {
    const ranked = rankRelatedPosts(briefing(), corpus, {
      excludeUrls: ['https://www.abx.com.br/link-dedicado-vs-banda-larga'],
    })
    expect(ranked.map((r) => r.post.url)).not.toContain(
      'https://abx.com.br/link-dedicado-vs-banda-larga/',
    )
  })

  it('promove URLs indicadas pela pauta mesmo com pouco casamento lexical', () => {
    const ranked = rankRelatedPosts(briefing(), corpus, {
      boostUrls: ['https://abx.com.br/bolo/'],
    })
    expect(ranked.map((r) => r.post.url)).toContain('https://abx.com.br/bolo/')
  })

  it('respeita o limite', () => {
    expect(rankRelatedPosts(briefing(), corpus, { limit: 1 })).toHaveLength(1)
  })
})

describe('extractTrecho', () => {
  const conteudo = [
    'Introdução genérica sobre tecnologia.',
    'O link dedicado garante banda simétrica e SLA contratual.',
    'Parágrafo sobre outro assunto qualquer.',
    'Empresas com link dedicado reduzem quedas de conexão.',
  ].join('\n')

  it('prioriza parágrafos com os termos e mantém a ordem original', () => {
    const trecho = extractTrecho(conteudo, ['link', 'dedicado'], 200)
    expect(trecho).toBe(
      'O link dedicado garante banda simétrica e SLA contratual.\nEmpresas com link dedicado reduzem quedas de conexão.',
    )
  })

  it('respeita o limite de caracteres', () => {
    expect(extractTrecho(conteudo, ['link'], 60).length).toBeLessThanOrEqual(60)
  })

  it('cai no início do texto quando nenhum termo casa', () => {
    expect(extractTrecho(conteudo, ['inexistente'], 40)).toBe(
      'Introdução genérica sobre tecnologia.',
    )
  })
})
