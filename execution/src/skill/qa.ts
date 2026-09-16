import type { QaCorrecao, QaReport, QaScore, QaVeredito } from '@publisher-p12/types'
import { QA_SCORE_MINIMO } from '@publisher-p12/types'

/** Categorias do score §64, na ordem em que a Skill as lista. */
export const QA_CATEGORIAS: Array<keyof QaScore> = [
  'intencao_busca',
  'profundidade',
  'originalidade',
  'seo',
  'geo_aeo',
  'eeat',
  'ux',
  'conversao',
  'atualidade',
  'qualidade_fontes',
  'naturalidade',
]

/** Rodada máxima: 1 passada normal + 1 correção. Depois disso, decide um humano. */
export const RODADA_MAXIMA = 2

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asString).filter(Boolean)
}

/**
 * Nota ausente ou não numérica vira 0, não 10. Modelo que omite a categoria não
 * pode ganhar aprovação por omissão.
 */
function asNota(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(Math.max(Math.round(n * 10) / 10, 0), 10)
}

export function emptyScore(): QaScore {
  return QA_CATEGORIAS.reduce((acc, cat) => {
    acc[cat] = 0
    return acc
  }, {} as QaScore)
}

export function normalizeScore(raw: unknown): QaScore {
  const score = emptyScore()
  if (!raw || typeof raw !== 'object') return score

  const o = raw as Record<string, unknown>
  for (const categoria of QA_CATEGORIAS) {
    score[categoria] = asNota(o[categoria])
  }
  return score
}

/** Skill §64: nenhuma categoria pode ficar abaixo de 8. */
export function categoriasReprovadas(score: QaScore): Array<keyof QaScore> {
  return QA_CATEGORIAS.filter((cat) => score[cat] < QA_SCORE_MINIMO)
}

export function scoreAprovado(score: QaScore): boolean {
  return categoriasReprovadas(score).length === 0
}

export function normalizeCorrecoes(raw: unknown): QaCorrecao[] {
  if (!Array.isArray(raw)) return []

  const correcoes: QaCorrecao[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const o = entry as Record<string, unknown>

    const categoria = asString(o.categoria) as keyof QaScore
    const problema = asString(o.problema)
    const correcao = asString(o.correcao)
    // Sem problema e sem correção a linha não é acionável pelo Redator
    if (!problema || !correcao) continue

    const trecho = asString(o.trecho)
    correcoes.push({
      categoria: QA_CATEGORIAS.includes(categoria) ? categoria : 'naturalidade',
      problema,
      correcao,
      ...(trecho ? { trecho } : {}),
    })
  }
  return correcoes
}

/**
 * Blinda a saída do Revisor. O veredito é sempre recalculado a partir do score:
 * o modelo pode declarar "aprovado" com nota 6, e a Skill não permite isso.
 */
export function normalizeQa(raw: unknown, rodada: number): QaReport {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const score = normalizeScore(o.score)
  const reprovadas = categoriasReprovadas(score)
  const veredito: QaVeredito = reprovadas.length === 0 ? 'aprovado' : 'reprovado'

  return {
    veredito,
    score,
    reprovadas,
    correcoes: normalizeCorrecoes(o.correcoes),
    fatos_sem_fonte: asStringArray(o.fatos_sem_fonte),
    diferenciacao_ia: asString(o.diferenciacao_ia),
    rodada,
    avaliado_em: new Date().toISOString(),
  }
}

export type AcaoPosRevisao = 'aprovar' | 'corrigir' | 'escalar_humano'

/**
 * Decide o que fazer depois da revisão. Chamado na junção, quando `imagem` e `revisar`
 * já terminaram.
 *
 * - aprovado           → segue para em_revisao, como hoje
 * - reprovado rodada 1 → volta ao Redator com as correções
 * - reprovado rodada 2 → para em em_revisao com o relatório visível; decide um humano
 */
export function decidirAcaoPosRevisao(qa: QaReport): AcaoPosRevisao {
  if (qa.veredito === 'aprovado') return 'aprovar'
  return qa.rodada < RODADA_MAXIMA ? 'corrigir' : 'escalar_humano'
}

/** Correções do Revisor no formato que o Redator recebe na rodada 2. */
export function renderCorrecoesParaPrompt(qa: QaReport): string {
  if (qa.correcoes.length === 0 && qa.fatos_sem_fonte.length === 0) return ''

  const linhas = [
    '# CORREÇÕES DA REVISÃO (rodada anterior reprovada)',
    `Categorias abaixo de ${QA_SCORE_MINIMO}: ${qa.reprovadas.join(', ') || 'nenhuma'}`,
    '',
    'Reescreva o artigo corrigindo cada ponto abaixo. Mantenha o que já estava bom.',
  ]

  for (const c of qa.correcoes) {
    linhas.push('')
    linhas.push(`- [${c.categoria}] ${c.problema}`)
    linhas.push(`  Correção: ${c.correcao}`)
    if (c.trecho) linhas.push(`  Trecho: "${c.trecho}"`)
  }

  if (qa.fatos_sem_fonte.length > 0) {
    linhas.push('')
    linhas.push('Afirmações sem fonte que sustente. Remova, reformule como hipótese ou atribua:')
    for (const fato of qa.fatos_sem_fonte) linhas.push(`- ${fato}`)
  }

  return linhas.join('\n')
}

/** Resumo curto para a UI e para o payload do job. */
export function resumoQa(qa: QaReport): string {
  if (qa.veredito === 'aprovado') {
    const media =
      QA_CATEGORIAS.reduce((soma, cat) => soma + qa.score[cat], 0) / QA_CATEGORIAS.length
    return `Aprovado na rodada ${qa.rodada}. Média ${media.toFixed(1)}.`
  }
  return `Reprovado na rodada ${qa.rodada}: ${qa.reprovadas.join(', ')}.`
}
