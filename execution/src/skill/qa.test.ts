import { describe, expect, it } from 'vitest'
import type { QaScore } from '@publisher-p12/types'
import {
  QA_CATEGORIAS,
  categoriasReprovadas,
  decidirAcaoPosRevisao,
  normalizeQa,
  normalizeScore,
  renderCorrecoesParaPrompt,
  resumoQa,
  scoreAprovado,
} from './qa.js'

function scoreCom(valor: number, sobrescreve: Partial<QaScore> = {}): QaScore {
  const base = QA_CATEGORIAS.reduce((acc, cat) => {
    acc[cat] = valor
    return acc
  }, {} as QaScore)
  return { ...base, ...sobrescreve }
}

describe('normalizeScore', () => {
  it('categoria ausente vira 0, não 10', () => {
    const score = normalizeScore({ seo: 9 })
    expect(score.seo).toBe(9)
    expect(score.naturalidade).toBe(0)
  })

  it('valor não numérico vira 0', () => {
    expect(normalizeScore({ seo: 'ótimo' }).seo).toBe(0)
  })

  it('limita ao intervalo 0-10', () => {
    const score = normalizeScore({ seo: 42, ux: -5 })
    expect(score.seo).toBe(10)
    expect(score.ux).toBe(0)
  })
})

describe('gate do score §64', () => {
  it('aprova só com todas as categorias em 8 ou mais', () => {
    expect(scoreAprovado(scoreCom(8))).toBe(true)
    expect(scoreAprovado(scoreCom(10))).toBe(true)
  })

  it('uma única categoria em 7.9 reprova o artigo', () => {
    const score = scoreCom(10, { originalidade: 7.9 })
    expect(scoreAprovado(score)).toBe(false)
    expect(categoriasReprovadas(score)).toEqual(['originalidade'])
  })
})

describe('normalizeQa', () => {
  it('ignora o veredito declarado pelo modelo e recalcula pelo score', () => {
    const qa = normalizeQa({ veredito: 'aprovado', score: scoreCom(6) }, 1)

    expect(qa.veredito).toBe('reprovado')
    expect(qa.reprovadas).toHaveLength(QA_CATEGORIAS.length)
  })

  it('descarta correção sem problema ou sem correção acionável', () => {
    const qa = normalizeQa(
      {
        score: scoreCom(9),
        correcoes: [
          { categoria: 'seo', problema: 'Title com 82 caracteres', correcao: 'Reduzir para 60' },
          { categoria: 'seo', problema: 'só problema' },
          { categoria: 'seo', correcao: 'só correção' },
        ],
      },
      1,
    )

    expect(qa.correcoes).toHaveLength(1)
    expect(qa.correcoes[0]?.problema).toBe('Title com 82 caracteres')
  })

  it('categoria inválida cai em naturalidade em vez de quebrar', () => {
    const qa = normalizeQa(
      {
        score: scoreCom(9),
        correcoes: [{ categoria: 'inventada', problema: 'p', correcao: 'c' }],
      },
      1,
    )
    expect(qa.correcoes[0]?.categoria).toBe('naturalidade')
  })

  it('resposta vazia do modelo reprova, não aprova por omissão', () => {
    const qa = normalizeQa(null, 1)
    expect(qa.veredito).toBe('reprovado')
  })
})

describe('decidirAcaoPosRevisao', () => {
  it('aprovado segue o fluxo', () => {
    expect(decidirAcaoPosRevisao(normalizeQa({ score: scoreCom(9) }, 1))).toBe('aprovar')
  })

  it('reprovado na rodada 1 volta ao Redator', () => {
    expect(decidirAcaoPosRevisao(normalizeQa({ score: scoreCom(5) }, 1))).toBe('corrigir')
  })

  it('reprovado na rodada 2 para com humano, sem terceira tentativa', () => {
    expect(decidirAcaoPosRevisao(normalizeQa({ score: scoreCom(5) }, 2))).toBe('escalar_humano')
  })
})

describe('renderCorrecoesParaPrompt', () => {
  it('monta instruções acionáveis para a rodada 2', () => {
    const qa = normalizeQa(
      {
        score: scoreCom(9, { originalidade: 5 }),
        correcoes: [
          {
            categoria: 'originalidade',
            problema: 'Texto genérico, sem dado do cliente',
            correcao: 'Use os dados proprietários do perfil',
            trecho: 'A conectividade é essencial',
          },
        ],
        fatos_sem_fonte: ['90% das empresas sofrem com instabilidade'],
      },
      1,
    )

    const prompt = renderCorrecoesParaPrompt(qa)

    expect(prompt).toContain('originalidade')
    expect(prompt).toContain('Use os dados proprietários do perfil')
    expect(prompt).toContain('A conectividade é essencial')
    expect(prompt).toContain('90% das empresas sofrem com instabilidade')
  })

  it('sem correção e sem fato pendente não gera ruído no prompt', () => {
    expect(renderCorrecoesParaPrompt(normalizeQa({ score: scoreCom(9) }, 1))).toBe('')
  })
})

describe('resumoQa', () => {
  it('aprovado mostra a média', () => {
    expect(resumoQa(normalizeQa({ score: scoreCom(9) }, 1))).toBe('Aprovado na rodada 1. Média 9.0.')
  })

  it('reprovado lista as categorias', () => {
    const qa = normalizeQa({ score: scoreCom(9, { ux: 4, seo: 6 }) }, 2)
    expect(resumoQa(qa)).toBe('Reprovado na rodada 2: seo, ux.')
  })
})
