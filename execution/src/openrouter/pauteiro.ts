import type { PautaSugerida, PerfilMarca, SuggestPautasResult } from '@publisher-p12/types'
import type { CorpusPromptItem } from '../corpus/store.js'
import { chatJson } from './client.js'

/** Teto de caracteres do inventário enviado ao modelo (~30k tokens). */
export const MAX_DIGEST_CHARS = 120_000

const EXTENSAO_PADRAO = 1500

export interface DigestItem {
  /** titulo */
  t: string
  /** url */
  u: string
  /** categorias */
  c: string
  /** data de publicação (YYYY-MM-DD) */
  d: string
  /** palavras */
  w: number
  /** excerpt */
  e: string
}

export interface BuildDigestOptions {
  maxChars?: number
}

export interface CorpusDigest {
  digest: DigestItem[]
  truncado: boolean
}

export interface PauteiroInput {
  corpus: CorpusPromptItem[]
  perfilMarca: PerfilMarca | null
  /** Categorias WP disponíveis, para a pauta já nascer classificada. */
  categorias?: string[]
  /** Temas já sugeridos antes — o modelo não pode repetir. */
  pautasExistentes?: string[]
  quantidade?: number
  foco?: string
  apiKey: string
  model?: string
}

const SYSTEM_PROMPT = `Você é pauteiro de conteúdo SEO/GEO para blogs B2B.
Recebe o inventário COMPLETO dos artigos já publicados pelo cliente e propõe pautas NOVAS.

Chaves do inventário: t=título, u=url, c=categorias, d=data, w=palavras, e=resumo.

Regras:
- PROIBIDO propor tema já coberto pelo inventário ou repetido na lista de pautas existentes.
- Toda pauta deve citar ao menos 1 URL do inventário em artigos_relacionados (base dos links internos).
- cluster = tema-pai identificado no próprio inventário.
- justificativa = qual lacuna de cobertura ou etapa de funil a pauta preenche.
- risco_canibalizacao = título do artigo existente que pode competir, ou null.
- Respeite as proibições do perfil de marca. Não invente números, datas ou estatísticas.
- Palavra-chave e textos em português do Brasil.

Retorne JSON: { "pautas": [ { tema, kw_principal, kws_secundarias[], intencao, etapa_funil,
angulo, publico, extensao_alvo, cluster, justificativa, artigos_relacionados[], risco_canibalizacao } ] }`

function dataCurta(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

/** Compacta o corpus para caber no contexto sem perder o inventário de temas. */
export function buildCorpusDigest(
  items: CorpusPromptItem[],
  options: BuildDigestOptions = {},
): CorpusDigest {
  const maxChars = options.maxChars ?? MAX_DIGEST_CHARS
  const digest: DigestItem[] = []
  let usados = 0
  let truncado = false

  for (const item of items) {
    const entry: DigestItem = {
      t: item.titulo,
      u: item.url,
      c: item.categorias.join('|'),
      d: dataCurta(item.publicado_em),
      w: item.palavras,
      e: item.excerpt,
    }

    const custo = JSON.stringify(entry).length + 1
    if (usados + custo > maxChars) {
      truncado = true
      break
    }

    digest.push(entry)
    usados += custo
  }

  return { digest, truncado }
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

function onlyHttpUrls(value: unknown): string[] {
  return asStringArray(value).filter((url) => /^https?:\/\//i.test(url))
}

/** Blinda a saída do modelo: descarta pautas incompletas e normaliza campos. */
export function normalizePautas(raw: unknown, limite: number): PautaSugerida[] {
  if (!Array.isArray(raw)) return []

  const pautas: PautaSugerida[] = []

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const obj = entry as Record<string, unknown>

    const tema = asString(obj.tema)
    const kwPrincipal = asString(obj.kw_principal)
    if (!tema || !kwPrincipal) continue

    const extensao = Number(obj.extensao_alvo)

    pautas.push({
      tema,
      kw_principal: kwPrincipal,
      kws_secundarias: asStringArray(obj.kws_secundarias),
      intencao: asString(obj.intencao, 'informacional'),
      etapa_funil: asString(obj.etapa_funil, 'topo'),
      angulo: asString(obj.angulo),
      publico: asString(obj.publico),
      extensao_alvo: Number.isFinite(extensao) && extensao > 0 ? Math.round(extensao) : EXTENSAO_PADRAO,
      cluster: asString(obj.cluster),
      justificativa: asString(obj.justificativa),
      artigos_relacionados: onlyHttpUrls(obj.artigos_relacionados),
      risco_canibalizacao: asString(obj.risco_canibalizacao) || null,
    })

    if (pautas.length >= limite) break
  }

  return pautas
}

export async function runPauteiro(input: PauteiroInput): Promise<SuggestPautasResult> {
  const quantidade = Math.min(Math.max(input.quantidade ?? 5, 1), 15)
  const { digest, truncado } = buildCorpusDigest(input.corpus)

  const userContent = JSON.stringify({
    quantidade,
    foco: input.foco ?? null,
    perfil_marca: input.perfilMarca,
    categorias_wp: input.categorias ?? [],
    pautas_ja_sugeridas: input.pautasExistentes ?? [],
    corpus_truncado: truncado,
    inventario_publicado: digest,
  })

  const output = await chatJson<{ pautas?: unknown }>({
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Proponha ${quantidade} pautas novas:\n${userContent}` },
    ],
    referer: 'https://publisher.p12.digital',
    title: 'Publisher P12 Pauteiro',
  })

  return {
    pautas: normalizePautas(output?.pautas, quantidade),
    posts_considerados: digest.length,
    corpus_truncado: truncado,
  }
}
