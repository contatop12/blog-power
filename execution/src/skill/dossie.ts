import type {
  CanibalizacaoItem,
  Dossie,
  EstagioConsciencia,
  Freshness,
  ImagemRef,
  IntencaoBusca,
  PesquisaDossie,
  RecomendacaoCanibalizacao,
  RiscoCanibalizacao,
} from '@publisher-p12/types'
import { SKILL_VERSION } from './skill.js'

const INTENCOES: IntencaoBusca[] = [
  'informacional',
  'comercial',
  'transacional',
  'navegacional',
  'local',
  'comparativa',
  'investigativa',
  'problema_solucao',
]

const ESTAGIOS: EstagioConsciencia[] = [
  'desconhece_problema',
  'reconhece_problema',
  'procura_solucoes',
  'compara_alternativas',
  'escolhe_fornecedor',
  'pronto_para_contratar',
]

const RISCOS: RiscoCanibalizacao[] = ['alto', 'medio', 'baixo']

const RECOMENDACOES: RecomendacaoCanibalizacao[] = [
  'atualizar',
  'consolidar',
  'redirecionar',
  'mudar_intencao',
  'mudar_palavra_chave',
  'cluster_complementar',
  'seguir',
]

const FRESHNESS: Freshness[] = ['evergreen', 'semi_evergreen', 'alta_volatilidade']

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(asString).filter(Boolean)
}

/**
 * Modelo responde em português e escreve o rótulo humano: "Problema/Solução",
 * "Procura Soluções", "Semi evergreen". Remove acento, caixa e separador antes de comparar.
 */
function asEnum<T extends string>(value: unknown, permitidos: T[], padrao: T): T {
  const bruto = asString(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s/-]+/g, '_')
  return permitidos.includes(bruto as T) ? (bruto as T) : padrao
}

export function emptyDossie(): Dossie {
  return {
    skill_version: SKILL_VERSION,
    rodada: 1,
    pesquisa: null,
    imagens_refs: [],
    pendencias: [],
  }
}

export function normalizeCanibalizacao(raw: unknown): CanibalizacaoItem[] {
  if (!Array.isArray(raw)) return []

  const itens: CanibalizacaoItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const o = entry as Record<string, unknown>
    const url = asString(o.url)
    // Sem URL não dá para agir sobre o conflito: a linha é descartada
    if (!/^https?:\/\//i.test(url)) continue

    itens.push({
      url,
      titulo: asString(o.titulo),
      risco: asEnum(o.risco, RISCOS, 'baixo'),
      recomendacao: asEnum(o.recomendacao, RECOMENDACOES, 'seguir'),
      motivo: asString(o.motivo),
    })
  }
  return itens
}

/** Blinda a saída do Pesquisador: campos ausentes viram padrão, lixo é descartado. */
export function normalizePesquisa(raw: unknown): PesquisaDossie | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  return {
    intencao: asEnum(o.intencao, INTENCOES, 'informacional'),
    estagio_consciencia: asEnum(o.estagio_consciencia, ESTAGIOS, 'procura_solucoes'),
    entidades: asStringArray(o.entidades),
    kws_relacionadas: asStringArray(o.kws_relacionadas),
    perguntas: asStringArray(o.perguntas),
    cluster: asString(o.cluster),
    pagina_pilar: asString(o.pagina_pilar),
    canibalizacao: normalizeCanibalizacao(o.canibalizacao),
    blocos_citaveis: asStringArray(o.blocos_citaveis),
    freshness: asEnum(o.freshness, FRESHNESS, 'semi_evergreen'),
    justificativa: asString(o.justificativa),
  }
}

export function normalizeImagensRefs(raw: unknown): ImagemRef[] {
  if (!Array.isArray(raw)) return []

  const refs: ImagemRef[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const o = entry as Record<string, unknown>
    const r2Key = asString(o.r2_key)
    if (!r2Key) continue
    refs.push({ secao: asString(o.secao), r2_key: r2Key, alt: asString(o.alt) })
  }
  return refs
}

/** Lê o JSON da coluna `articles.dossie`. JSON inválido não derruba o job. */
export function parseDossie(raw: string | null | undefined): Dossie {
  if (!raw) return emptyDossie()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyDossie()
  }

  if (!parsed || typeof parsed !== 'object') return emptyDossie()
  const o = parsed as Record<string, unknown>
  const rodada = Number(o.rodada)

  return {
    skill_version: asString(o.skill_version) || SKILL_VERSION,
    rodada: Number.isFinite(rodada) && rodada > 0 ? Math.round(rodada) : 1,
    pesquisa: normalizePesquisa(o.pesquisa),
    imagens_refs: normalizeImagensRefs(o.imagens_refs),
    pendencias: asStringArray(o.pendencias),
  }
}

/**
 * Aplica a fatia de um agente sobre o dossiê existente. Cada agente escreve só o que é seu,
 * então o merge é raso de propósito: sobrescrever `pesquisa` inteira é o comportamento
 * correto quando o Pesquisador roda de novo.
 */
export function mergeDossie(atual: Dossie, patch: Partial<Dossie>): Dossie {
  return {
    ...atual,
    ...patch,
    skill_version: patch.skill_version ?? SKILL_VERSION,
    // Pendências são cumulativas e deduplicadas: cada agente pode acrescentar a sua
    pendencias: patch.pendencias
      ? [...new Set([...atual.pendencias, ...patch.pendencias])]
      : atual.pendencias,
  }
}

/** Resumo do dossiê para o prompt dos agentes seguintes. */
export function renderPesquisaParaPrompt(pesquisa: PesquisaDossie | null): string {
  if (!pesquisa) return ''

  const linhas = [
    '# DIAGNÓSTICO DO PESQUISADOR',
    `- Intenção: ${pesquisa.intencao}`,
    `- Estágio de consciência: ${pesquisa.estagio_consciencia}`,
    `- Cluster: ${pesquisa.cluster || 'não identificado'}`,
    `- Página pilar: ${pesquisa.pagina_pilar || 'não identificada'}`,
    `- Freshness: ${pesquisa.freshness}`,
  ]

  if (pesquisa.entidades.length > 0) {
    linhas.push(`- Entidades a explicar: ${pesquisa.entidades.join('; ')}`)
  }
  if (pesquisa.kws_relacionadas.length > 0) {
    linhas.push(`- Termos relacionados: ${pesquisa.kws_relacionadas.join('; ')}`)
  }
  if (pesquisa.perguntas.length > 0) {
    linhas.push(`- Perguntas a responder: ${pesquisa.perguntas.join(' | ')}`)
  }
  if (pesquisa.blocos_citaveis.length > 0) {
    linhas.push(`- Blocos citáveis sugeridos: ${pesquisa.blocos_citaveis.join(' | ')}`)
  }

  const conflitos = pesquisa.canibalizacao.filter((c) => c.recomendacao !== 'seguir')
  if (conflitos.length > 0) {
    linhas.push('- Canibalização detectada:')
    for (const c of conflitos) {
      linhas.push(`  - ${c.titulo || c.url} (${c.url}) — risco ${c.risco}, ${c.recomendacao}`)
    }
    linhas.push(
      '  Diferencie este artigo dos acima: mude o ângulo e não repita a mesma resposta.',
    )
  }

  return linhas.join('\n')
}
