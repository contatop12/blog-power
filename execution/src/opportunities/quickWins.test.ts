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
