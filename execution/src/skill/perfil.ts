import type {
  PaginaRef,
  PerfilBlocoCompletude,
  PerfilCampoMeta,
  PerfilCliente,
  PerfilCompletude,
  ProfissionalResponsavel,
  ServicoMarca,
} from '@publisher-p12/types'
import { PERFIL_BLOCOS, PERFIL_CAMPOS } from '@publisher-p12/types'

// ---------------------------------------------------------------------------
// Coerção
// ---------------------------------------------------------------------------

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  if (typeof value === 'string') {
    // Textarea multilinha da UI chega como string única
    return value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (!Array.isArray(value)) return []
  return value.map(asString).filter(Boolean)
}

function asServicos(value: unknown): ServicoMarca[] {
  if (!Array.isArray(value)) return []
  const servicos: ServicoMarca[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const nome = asString(obj.nome)
    if (!nome) continue
    servicos.push({ nome, url: asString(obj.url) })
  }
  return servicos
}

function asPaginas(value: unknown): PaginaRef[] {
  if (!Array.isArray(value)) return []
  const paginas: PaginaRef[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const url = asString(obj.url)
    if (!url) continue
    paginas.push({ url, titulo: asString(obj.titulo) })
  }
  return paginas
}

function asProfissionais(value: unknown): ProfissionalResponsavel[] {
  if (!Array.isArray(value)) return []
  const pessoas: ProfissionalResponsavel[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const nome = asString(obj.nome)
    if (!nome) continue
    const urlAutor = asString(obj.url_autor)
    pessoas.push({
      nome,
      funcao: asString(obj.funcao),
      especialidade: asString(obj.especialidade),
      ...(urlAutor ? { url_autor: urlAutor } : {}),
    })
  }
  return pessoas
}

export function emptyPerfilCliente(): PerfilCliente {
  return {
    nome_empresa: '',
    site: '',
    posicionamento: '',
    tom_de_voz: '',
    diretriz_visual: '',
    servicos: [],
    produtos: [],
    servicos_prioritarios: [],
    especialidades: [],
    diferenciais: [],
    ticket_medio: '',
    publico_alvo: '',
    icp: '',
    area_geografica: '',
    cidades_prioritarias: [],
    concorrentes: [],
    profissionais_responsaveis: [],
    certificacoes: [],
    diferenciais_reais: [],
    dados_proprietarios: [],
    cases: [],
    paginas_importantes: [],
    paginas_servicos: [],
    artigos_publicados: [],
    objetivos_comerciais: [],
    ctas_permitidos: [],
    formas_contato: [],
    crm_qualificacao: '',
    perguntas_frequentes: [],
    objecoes_comerciais: [],
    restricoes_legais: [],
    restricoes_compliance: [],
    informacoes_proibidas: [],
  }
}

/**
 * Aceita perfil novo, perfil legado (PerfilMarca) ou JSON parcial e devolve um
 * PerfilCliente completo, com os 8 campos legados derivados dos campos novos.
 *
 * A derivação é o que mantém redator/editor/pauteiro/imagem funcionando sem
 * mudança de contrato: eles continuam lendo `tom_de_voz`, `proibicoes`, etc.
 */
export function normalizePerfilCliente(raw: unknown): PerfilCliente {
  const base = emptyPerfilCliente()
  if (!raw || typeof raw !== 'object') return aplicarDerivados(base)

  const o = raw as Record<string, unknown>

  const perfil: PerfilCliente = {
    ...base,
    nome_empresa: asString(o.nome_empresa),
    site: asString(o.site),
    // Perfil legado só tem descricao_institucional; ela vira o posicionamento
    posicionamento: asString(o.posicionamento) || asString(o.descricao_institucional),
    tom_de_voz: asString(o.tom_de_voz),
    diretriz_visual: asString(o.diretriz_visual),

    servicos: asServicos(o.servicos),
    produtos: asStringArray(o.produtos),
    servicos_prioritarios: asStringArray(o.servicos_prioritarios),
    especialidades: asStringArray(o.especialidades),
    diferenciais: asStringArray(o.diferenciais),
    ticket_medio: asString(o.ticket_medio),

    publico_alvo: asString(o.publico_alvo) || asStringArray(o.segmentos_atendidos).join(', '),
    icp: asString(o.icp),
    area_geografica: asString(o.area_geografica),
    cidades_prioritarias: asStringArray(o.cidades_prioritarias),
    concorrentes: asStringArray(o.concorrentes),

    profissionais_responsaveis: asProfissionais(o.profissionais_responsaveis),
    certificacoes: asStringArray(o.certificacoes),
    diferenciais_reais: asStringArray(o.diferenciais_reais),
    dados_proprietarios: asStringArray(o.dados_proprietarios),
    cases: asStringArray(o.cases),

    paginas_importantes: asPaginas(o.paginas_importantes),
    paginas_servicos: asPaginas(o.paginas_servicos),
    artigos_publicados: asPaginas(o.artigos_publicados),

    objetivos_comerciais: asStringArray(o.objetivos_comerciais),
    ctas_permitidos: asStringArray(o.ctas_permitidos),
    formas_contato: asStringArray(o.formas_contato),
    crm_qualificacao: asString(o.crm_qualificacao),

    perguntas_frequentes: asStringArray(o.perguntas_frequentes),
    objecoes_comerciais: asStringArray(o.objecoes_comerciais),

    restricoes_legais: asStringArray(o.restricoes_legais),
    restricoes_compliance: asStringArray(o.restricoes_compliance),
    informacoes_proibidas: asStringArray(o.informacoes_proibidas),
  }

  // Perfil legado: provas_eeat sem equivalente novo vira diferencial real
  if (perfil.diferenciais_reais.length === 0) {
    perfil.diferenciais_reais = asStringArray(o.provas_eeat)
  }
  // Perfil legado: proibicoes sem equivalente novo vira informação proibida
  if (perfil.informacoes_proibidas.length === 0) {
    perfil.informacoes_proibidas = asStringArray(o.proibicoes)
  }
  // Perfil legado: cta_padrao sem equivalente novo vira o primeiro CTA permitido
  if (perfil.ctas_permitidos.length === 0) {
    const ctaPadrao = asString(o.cta_padrao)
    if (ctaPadrao) perfil.ctas_permitidos = [ctaPadrao]
  }

  return aplicarDerivados(perfil)
}

/** Preenche os 8 campos de PerfilMarca a partir dos campos novos. */
function aplicarDerivados(perfil: PerfilCliente): PerfilCliente {
  const proibicoes = [
    ...perfil.informacoes_proibidas,
    ...perfil.restricoes_legais,
    ...perfil.restricoes_compliance,
  ]

  return {
    ...perfil,
    descricao_institucional: perfil.posicionamento,
    segmentos_atendidos: [perfil.publico_alvo, perfil.icp].filter(Boolean),
    // servicos já tem o formato { nome, url } de ServicoMarca
    provas_eeat: [...perfil.diferenciais_reais, ...perfil.certificacoes, ...perfil.cases],
    proibicoes,
    cta_padrao: perfil.ctas_permitidos[0] ?? '',
  }
}

// ---------------------------------------------------------------------------
// Completude e validação
// ---------------------------------------------------------------------------

export function campoPreenchido(perfil: PerfilCliente, campo: PerfilCampoMeta): boolean {
  const valor = perfil[campo.chave]
  if (Array.isArray(valor)) return valor.length > 0
  return typeof valor === 'string' && valor.trim().length > 0
}

export function calcularCompletude(perfil: PerfilCliente): PerfilCompletude {
  const blocos: PerfilBlocoCompletude[] = PERFIL_BLOCOS.map(({ bloco }) => {
    const campos = PERFIL_CAMPOS.filter((c) => c.bloco === bloco)
    return {
      bloco,
      preenchidos: campos.filter((c) => campoPreenchido(perfil, c)).length,
      total: campos.length,
    }
  })

  const preenchidos = blocos.reduce((soma, b) => soma + b.preenchidos, 0)
  const total = PERFIL_CAMPOS.length

  return {
    percentual: total === 0 ? 0 : Math.round((preenchidos / total) * 100),
    preenchidos,
    total,
    blocos,
    faltando_obrigatorios: PERFIL_CAMPOS.filter(
      (c) => c.obrigatorio && !campoPreenchido(perfil, c),
    ).map((c) => c.chave),
  }
}

export interface PerfilValidacao {
  ok: boolean
  faltando: Array<keyof PerfilCliente>
  /** Mensagem pronta para o erro do job, nomeando os campos. */
  mensagem: string
}

/**
 * Mínimo que o pipeline exige antes de gastar uma chamada de modelo.
 * Substitui o antigo erro genérico "Briefing ou perfil de marca ausente".
 */
export function validatePerfilCliente(raw: unknown): PerfilValidacao {
  const perfil = normalizePerfilCliente(raw)
  const faltando = PERFIL_CAMPOS.filter((c) => c.obrigatorio && !campoPreenchido(perfil, c))

  if (faltando.length === 0) {
    return { ok: true, faltando: [], mensagem: '' }
  }

  const labels = faltando.map((c) => c.label).join(', ')
  return {
    ok: false,
    faltando: faltando.map((c) => c.chave),
    mensagem: `Perfil do cliente incompleto. Preencha na aba Perfil: ${labels}.`,
  }
}

// ---------------------------------------------------------------------------
// Renderização para prompt
// ---------------------------------------------------------------------------

function formatarValor(perfil: PerfilCliente, campo: PerfilCampoMeta): string {
  const valor = perfil[campo.chave]

  if (typeof valor === 'string') return valor

  if (!Array.isArray(valor)) return ''

  switch (campo.tipo) {
    case 'lista_servico':
      return (valor as ServicoMarca[])
        .map((s) => (s.url ? `${s.nome} (${s.url})` : s.nome))
        .join('; ')
    case 'lista_url':
      return (valor as PaginaRef[])
        .map((p) => (p.titulo ? `${p.titulo} (${p.url})` : p.url))
        .join('; ')
    case 'lista_pessoa':
      return (valor as ProfissionalResponsavel[])
        .map((p) => [p.nome, p.funcao, p.especialidade].filter(Boolean).join(', '))
        .join('; ')
    default:
      return (valor as string[]).join('; ')
  }
}

/**
 * Perfil como texto compacto para o prompt. Campos vazios são omitidos: o agente
 * precisa enxergar a ausência como ausência, não como string vazia — Skill §2 manda
 * sinalizar pendência em vez de inventar.
 */
export function renderPerfilParaPrompt(raw: unknown): string {
  const perfil = normalizePerfilCliente(raw)
  const linhas: string[] = []

  for (const { bloco, titulo } of PERFIL_BLOCOS) {
    const campos = PERFIL_CAMPOS.filter(
      (c) => c.bloco === bloco && campoPreenchido(perfil, c),
    )
    if (campos.length === 0) continue

    linhas.push(`## ${titulo}`)
    for (const campo of campos) {
      linhas.push(`- ${campo.label}: ${formatarValor(perfil, campo)}`)
    }
    linhas.push('')
  }

  if (linhas.length === 0) return 'PERFIL DO CLIENTE: não preenchido.'

  const faltando = calcularCompletude(perfil).faltando_obrigatorios
  if (faltando.length > 0) {
    const labels = PERFIL_CAMPOS.filter((c) => faltando.includes(c.chave)).map((c) => c.label)
    linhas.push(`## Não informado`)
    linhas.push(
      `Sem dado para: ${labels.join(', ')}. Escreva de forma neutra ou sinalize como pendente. Nunca preencha por conta própria.`,
    )
  }

  return `# PERFIL DO CLIENTE (fonte primária sobre o negócio)\n\n${linhas.join('\n')}`.trim()
}
