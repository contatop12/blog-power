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

export interface FetchPublishedPostsInput {
  creds: WordPressCredentials
  postType?: WpPostType
  /** ISO UTC do post mais recente já ingerido — sync incremental. */
  modifiedAfter?: string | null
  perPage?: number
  maxPaginas?: number
}

export interface FetchPublishedPostsResult {
  posts: CorpusPost[]
  paginas_lidas: number
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
 * Lê todos os posts publicados do cliente, paginando até acabar.
 * Ordena por `modified` para que o sync incremental use `modified_after`.
 */
export async function fetchPublishedPosts(
  input: FetchPublishedPostsInput,
): Promise<FetchPublishedPostsResult> {
  const postType: WpPostType = input.postType ?? 'post'
  const perPage = Math.min(Math.max(input.perPage ?? 100, 1), 100)
  const maxPaginas = input.maxPaginas ?? 60
  const collection = wpRestCollection(postType)

  const posts: CorpusPost[] = []
  let paginasLidas = 0

  for (let page = 1; page <= maxPaginas; page += 1) {
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

    paginasLidas += 1
    const lote = Array.isArray(batch) ? batch : []
    for (const raw of lote) {
      posts.push(mapWpPostToCorpus(raw, postType))
    }

    if (lote.length < perPage) break
  }

  return { posts, paginas_lidas: paginasLidas }
}
