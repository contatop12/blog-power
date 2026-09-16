import type { WpPostType, WpTermRef } from '@publisher-p12/types'
import { wpFetch, type WordPressCredentials } from './client.js'
import { wpRestCollection } from './publish.js'

/** Formato bruto devolvido pela REST API do WordPress (campos usados aqui). */
export interface WpRawPost {
  id: number
  date_gmt: string
  modified_gmt: string
  slug: string
  link: string
  title: { rendered: string }
  excerpt?: { rendered: string }
  content?: { rendered: string }
  _embedded?: {
    'wp:term'?: Array<Array<{ id: number; name: string; taxonomy: string }>>
  }
}

/** Post já publicado, normalizado para a base de conhecimento do cliente. */
export interface CorpusPost {
  wp_post_id: number
  wp_post_type: WpPostType
  titulo: string
  slug: string | null
  url: string
  excerpt: string
  conteudo_txt: string
  categorias: WpTermRef[]
  tags: WpTermRef[]
  palavras: number
  publicado_em: string | null
  wp_modified: string | null
}

/**
 * Tamanho do bloco de leitura. 5 mantém a resposta da REST API pequena mesmo com `_embed`,
 * ao custo de mais requisições: 232 posts viram ~47 blocos em vez de 3 páginas.
 */
export const CORPUS_BLOCO_PADRAO = 5

/**
 * Trava de segurança por posts, não por páginas. Com blocos de 5, um limite de páginas
 * cortaria a sync muito antes do volume real de um blog grande.
 */
export const CORPUS_MAX_POSTS = 6000

/** Bloco lido, entregue ao callback antes de o próximo ser buscado. */
export interface CorpusBloco {
  posts: CorpusPost[]
  /** 1-indexado. */
  bloco: number
  /** Total acumulado até o fim deste bloco. */
  total_lidos: number
}

export interface FetchPublishedPostsInput {
  creds: WordPressCredentials
  postType?: WpPostType
  /** ISO UTC do post mais recente já ingerido — sync incremental. */
  modifiedAfter?: string | null
  perPage?: number
  /** Teto de posts por chamada. Padrão CORPUS_MAX_POSTS. */
  maxPosts?: number
  /**
   * Gravação incremental: chamado a cada bloco, antes de buscar o próximo.
   * Quando informado, os posts não são acumulados em memória.
   */
  onBloco?: (bloco: CorpusBloco) => Promise<void>
  /**
   * Orçamento de tempo em ms. Ao estourar, a leitura para e devolve `incompleto: true`
   * para que o job enfileire uma continuação em vez de morrer no teto do consumer.
   */
  orcamentoMs?: number
  /** Injetável em teste. */
  agora?: () => number
}

export interface FetchPublishedPostsResult {
  /** Vazio quando `onBloco` é usado: nesse modo nada fica acumulado. */
  posts: CorpusPost[]
  blocos_lidos: number
  total_lidos: number
  /** True quando parou por orçamento de tempo ou teto de posts, e não por fim do inventário. */
  incompleto: boolean
  /** `modified` do último post lido. Semente da continuação. */
  ultimo_modified: string | null
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  laquo: '«',
  raquo: '»',
  ccedil: 'ç',
  Ccedil: 'Ç',
  aacute: 'á',
  eacute: 'é',
  iacute: 'í',
  oacute: 'ó',
  uacute: 'ú',
  atilde: 'ã',
  otilde: 'õ',
  acirc: 'â',
  ecirc: 'ê',
  ocirc: 'ô',
  agrave: 'à',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
}

/** Tags cujo fechamento marca quebra de bloco no texto extraído. */
const BLOCK_BREAK = /<\/(p|div|h[1-6]|li|tr|td|th|blockquote|section|article|figcaption|pre)\s*>|<br\s*\/?>|<\/?(ul|ol|table|figure)\s*>/gi

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name] ?? match)
}

/** HTML/Gutenberg → texto limpo, uma linha por bloco. */
export function htmlToPlainText(html: string): string {
  if (!html) return ''

  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style)[\s\S]*?<\/\1\s*>/gi, ' ')

  const withBreaks = withoutNoise.replace(BLOCK_BREAK, '\n')
  const stripped = withBreaks.replace(/<[^>]*>/g, '')
  const decoded = decodeHtmlEntities(stripped)

  return decoded
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0\u200b]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

export function countWords(text: string): number {
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

/** WordPress devolve *_gmt sem sufixo de fuso; o PRD exige UTC explícito. */
function gmtToIsoUtc(value: string | undefined): string | null {
  if (!value) return null
  return /[Zz]$/.test(value) ? value : `${value}Z`
}

function termsByTaxonomy(post: WpRawPost, taxonomy: string): WpTermRef[] {
  const groups = post._embedded?.['wp:term'] ?? []
  const terms: WpTermRef[] = []
  for (const group of groups) {
    for (const term of group ?? []) {
      if (term?.taxonomy === taxonomy) {
        terms.push({ id: term.id, name: decodeHtmlEntities(term.name) })
      }
    }
  }
  return terms
}

export function mapWpPostToCorpus(raw: WpRawPost, postType: WpPostType): CorpusPost {
  const conteudo = htmlToPlainText(raw.content?.rendered ?? '')
  return {
    wp_post_id: raw.id,
    wp_post_type: postType,
    titulo: decodeHtmlEntities(raw.title?.rendered ?? '').trim(),
    slug: raw.slug || null,
    url: raw.link,
    excerpt: htmlToPlainText(raw.excerpt?.rendered ?? ''),
    conteudo_txt: conteudo,
    categorias: termsByTaxonomy(raw, 'category'),
    tags: termsByTaxonomy(raw, 'post_tag'),
    palavras: countWords(conteudo),
    publicado_em: gmtToIsoUtc(raw.date_gmt),
    wp_modified: gmtToIsoUtc(raw.modified_gmt),
  }
}

function isPaginaInexistente(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /rest_post_invalid_page_number|rest_invalid_param/.test(message)
}

/**
 * Lê os posts publicados do cliente em blocos pequenos, entregando cada bloco a `onBloco`
 * antes de buscar o próximo — a gravação acontece durante a leitura, não no fim.
 *
 * Ordena por `modified asc`: é o que torna `modified_after` confiável e permite que uma
 * continuação retome exatamente de onde parou.
 */
export async function fetchPublishedPosts(
  input: FetchPublishedPostsInput,
): Promise<FetchPublishedPostsResult> {
  const postType: WpPostType = input.postType ?? 'post'
  const perPage = Math.min(Math.max(input.perPage ?? CORPUS_BLOCO_PADRAO, 1), 100)
  const maxPosts = input.maxPosts ?? CORPUS_MAX_POSTS
  const agora = input.agora ?? (() => Date.now())
  const inicio = agora()
  const collection = wpRestCollection(postType)

  // Sem callback, o resultado precisa carregar tudo. Com callback, nada é acumulado.
  const acumular = !input.onBloco
  const posts: CorpusPost[] = []

  let blocosLidos = 0
  let totalLidos = 0
  let ultimoModified: string | null = null
  let incompleto = false

  const maxBlocos = Math.ceil(maxPosts / perPage)

  for (let page = 1; page <= maxBlocos; page += 1) {
    const params = new URLSearchParams({
      status: 'publish',
      per_page: String(perPage),
      page: String(page),
      orderby: 'modified',
      order: 'asc',
      _embed: 'wp:term',
    })

    if (input.modifiedAfter) {
      params.set('modified_after', input.modifiedAfter.replace(/[Zz]$/, ''))
    }

    let batch: WpRawPost[]
    try {
      batch = await wpFetch<WpRawPost[]>(input.creds, `${collection}?${params.toString()}`)
    } catch (err) {
      // Fim da paginação: o WP recusa páginas além do total em vez de devolver []
      if (page > 1 && isPaginaInexistente(err)) break
      throw err
    }

    const lote = Array.isArray(batch) ? batch : []
    const mapeados = lote.map((raw) => mapWpPostToCorpus(raw, postType))

    blocosLidos += 1
    totalLidos += mapeados.length
    if (mapeados.length > 0) {
      ultimoModified = mapeados[mapeados.length - 1]?.wp_modified ?? ultimoModified
    }

    if (acumular) posts.push(...mapeados)

    // Grava antes de buscar o próximo: falha no bloco 40 preserva os 39 anteriores
    if (input.onBloco && mapeados.length > 0) {
      await input.onBloco({ posts: mapeados, bloco: blocosLidos, total_lidos: totalLidos })
    }

    // Lote menor que o pedido = última página do inventário
    if (lote.length < perPage) {
      return { posts, blocos_lidos: blocosLidos, total_lidos: totalLidos, incompleto: false, ultimo_modified: ultimoModified }
    }

    if (totalLidos >= maxPosts) {
      incompleto = true
      break
    }

    if (input.orcamentoMs && agora() - inicio >= input.orcamentoMs) {
      incompleto = true
      break
    }
  }

  // Saiu do laço sem lote curto: o inventário pode ter mais posts do que coube nesta chamada
  return {
    posts,
    blocos_lidos: blocosLidos,
    total_lidos: totalLidos,
    incompleto: incompleto || blocosLidos >= maxBlocos,
    ultimo_modified: ultimoModified,
  }
}
