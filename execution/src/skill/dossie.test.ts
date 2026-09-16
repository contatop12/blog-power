import { describe, expect, it } from 'vitest'
import {
  emptyDossie,
  mergeDossie,
  normalizeCanibalizacao,
  normalizeImagensRefs,
  normalizePesquisa,
  parseDossie,
  renderPesquisaParaPrompt,
} from './dossie.js'
import { SKILL_VERSION } from './skill.js'

describe('normalizePesquisa', () => {
  it('normaliza variações de escrita dos enums', () => {
    const pesquisa = normalizePesquisa({
      intencao: 'Problema/Solução',
      estagio_consciencia: 'Procura Soluções',
      freshness: 'semi evergreen',
    })

    expect(pesquisa?.intencao).toBe('problema_solucao')
    expect(pesquisa?.estagio_consciencia).toBe('procura_solucoes')
    expect(pesquisa?.freshness).toBe('semi_evergreen')
  })

  it('valor fora do vocabulário cai no padrão em vez de vazar para o dossiê', () => {
    const pesquisa = normalizePesquisa({ intencao: 'viral', freshness: 'talvez' })
    expect(pesquisa?.intencao).toBe('informacional')
    expect(pesquisa?.freshness).toBe('semi_evergreen')
  })

  it('entrada não-objeto devolve null', () => {
    expect(normalizePesquisa('texto')).toBeNull()
    expect(normalizePesquisa(null)).toBeNull()
  })
})

describe('normalizeCanibalizacao', () => {
  it('descarta item sem URL http — sem URL não dá para agir', () => {
    const itens = normalizeCanibalizacao([
      { url: 'https://x.com/a', titulo: 'A', risco: 'alto', recomendacao: 'atualizar' },
      { titulo: 'sem url' },
      { url: '/relativa', titulo: 'B' },
    ])

    expect(itens).toHaveLength(1)
    expect(itens[0]?.url).toBe('https://x.com/a')
  })

  it('recomendação desconhecida vira "seguir"', () => {
    const itens = normalizeCanibalizacao([
      { url: 'https://x.com/a', recomendacao: 'apagar o site' },
    ])
    expect(itens[0]?.recomendacao).toBe('seguir')
    expect(itens[0]?.risco).toBe('baixo')
  })
})

describe('normalizeImagensRefs', () => {
  it('descarta ref sem chave no R2', () => {
    const refs = normalizeImagensRefs([
      { secao: 'Como escolher', r2_key: 'articles/1/corpo-1', alt: 'x' },
      { secao: 'Sem chave', alt: 'y' },
    ])
    expect(refs).toHaveLength(1)
  })
})

describe('parseDossie', () => {
  it('JSON inválido devolve dossiê vazio em vez de derrubar o job', () => {
    expect(parseDossie('{quebrado')).toEqual(emptyDossie())
  })

  it('null devolve dossiê vazio na versão corrente da Skill', () => {
    const dossie = parseDossie(null)
    expect(dossie.skill_version).toBe(SKILL_VERSION)
    expect(dossie.rodada).toBe(1)
  })

  it('rodada inválida volta para 1', () => {
    expect(parseDossie(JSON.stringify({ rodada: -3 })).rodada).toBe(1)
    expect(parseDossie(JSON.stringify({ rodada: 'duas' })).rodada).toBe(1)
  })
})

describe('mergeDossie', () => {
  it('sobrescreve a fatia do agente e acumula pendências sem duplicar', () => {
    const atual = { ...emptyDossie(), pendencias: ['sem ticket médio'] }
    const proximo = mergeDossie(atual, {
      rodada: 2,
      pendencias: ['sem ticket médio', 'sem cases'],
    })

    expect(proximo.rodada).toBe(2)
    expect(proximo.pendencias).toEqual(['sem ticket médio', 'sem cases'])
  })

  it('patch sem pendências preserva as existentes', () => {
    const atual = { ...emptyDossie(), pendencias: ['sem cases'] }
    expect(mergeDossie(atual, { rodada: 2 }).pendencias).toEqual(['sem cases'])
  })
})

describe('renderPesquisaParaPrompt', () => {
  it('sem pesquisa não gera ruído', () => {
    expect(renderPesquisaParaPrompt(null)).toBe('')
  })

  it('destaca canibalização acionável e omite os "seguir"', () => {
    const pesquisa = normalizePesquisa({
      intencao: 'comercial',
      cluster: 'Link dedicado',
      canibalizacao: [
        {
          url: 'https://x.com/a',
          titulo: 'Guia do link dedicado',
          risco: 'alto',
          recomendacao: 'atualizar',
        },
        { url: 'https://x.com/b', titulo: 'Sem conflito', recomendacao: 'seguir' },
      ],
    })

    const texto = renderPesquisaParaPrompt(pesquisa)

    expect(texto).toContain('Guia do link dedicado')
    expect(texto).toContain('risco alto, atualizar')
    expect(texto).not.toContain('Sem conflito')
  })
})
