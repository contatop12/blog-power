import type {
  ClientPost,
  ClientPostSummary,
  CorpusStatus,
  WpPostType,
  WpTermRef,
} from '@publisher-p12/types'
import type { D1Database, D1PreparedStatement } from '../types/d1.js'
import type { CorpusPost } from '../wordpress/corpus.js'

/** Teto por linha: protege o D1 de posts gigantes sem perder o corpo do artigo. */
export const MAX_CONTEUDO_CHARS = 60_000

const UPSERT_CHUNK = 40

export interface ClientPostRow {
  id: string
  client_id: string
  wp_post_id: number
  wp_post_type: string
  titulo: string
  slug: string | null
  url: string
  excerpt: string | null
  conteudo_txt: string | null
  categorias: string | null
  tags: string | null
  palavras: number
  publicado_em: string | null
  wp_modified: string | null
  synced_at: string
}

export interface UpsertCorpusResult {
  inseridos: number
  atualizados: number
}

/** Item compacto entregue ao Pauteiro — nunca o conteúdo inteiro. */
export interface CorpusPromptItem {
  titulo: string
  url: string
  categorias: string[]
  publicado_em: string | null
  palavras: number
  excerpt: string
}

function parseTerms(raw: string | null): WpTermRef[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as WpTermRef[]) : []
  } catch {
    return []
  }
}

function normalizePostType(value: string | null): WpPostType {
  return value === 'page' ? 'page' : 'post'
}

export function truncateConteudo(text: string, max = MAX_CONTEUDO_CHARS): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n[conteúdo truncado]`
}

export function rowToClientPost(row: ClientPostRow): ClientPost {
  return {
    id: row.id,
    client_id: row.client_id,
    wp_post_id: row.wp_post_id,
    wp_post_type: normalizePostType(row.wp_post_type),
    titulo: row.titulo,
    slug: row.slug,
    url: row.url,
    excerpt: row.excerpt,
    conteudo_txt: row.conteudo_txt,
    categorias: parseTerms(row.categorias),
    tags: parseTerms(row.tags),
    palavras: row.palavras,
    publicado_em: row.publicado_em,
    wp_modified: row.wp_modified,
    synced_at: row.synced_at,
  }
}

export function rowToClientPostSummary(row: ClientPostRow): ClientPostSummary {
  return {
    id: row.id,
    wp_post_id: row.wp_post_id,
    wp_post_type: normalizePostType(row.wp_post_type),
    titulo: row.titulo,
    url: row.url,
    categorias: parseTerms(row.categorias),
    palavras: row.palavras,
    publicado_em: row.publicado_em,
    wp_modified: row.wp_modified,
  }
}

async function runStatements(db: D1Database, statements: D1PreparedStatement[]): Promise<void> {
  if (statements.length === 0) return
  if (typeof db.batch === 'function') {
    await db.batch(statements)
    return
  }
  for (const stmt of statements) {
    await stmt.run()
  }
}

/** Grava o corpus lido do WordPress; conta inserções e atualizações reais. */
export async function upsertCorpusPosts(
  db: D1Database,
  clientId: string,
  posts: CorpusPost[],
): Promise<UpsertCorpusResult> {
  if (posts.length === 0) return { inseridos: 0, atualizados: 0 }

  const { results } = await db
    .prepare('SELECT wp_post_id, wp_post_type FROM client_posts WHERE client_id = ?')
    .bind(clientId)
    .all<{ wp_post_id: number; wp_post_type: string }>()

  const existentes = new Set(
    (results ?? []).map((r) => `${normalizePostType(r.wp_post_type)}:${r.wp_post_id}`),
  )

  let inseridos = 0
  let atualizados = 0
  const ts = new Date().toISOString()

  for (let i = 0; i < posts.length; i += UPSERT_CHUNK) {
    const slice = posts.slice(i, i + UPSERT_CHUNK)
    const statements = slice.map((post) => {
      if (existentes.has(`${post.wp_post_type}:${post.wp_post_id}`)) {
        atualizados += 1
      } else {
        inseridos += 1
      }

      return db
        .prepare(
          `INSERT INTO client_posts (
             id, client_id, wp_post_id, wp_post_type, titulo, slug, url, excerpt,
             conteudo_txt, categorias, tags, palavras, publicado_em, wp_modified, synced_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(client_id, wp_post_type, wp_post_id) DO UPDATE SET
             titulo = excluded.titulo,
             slug = excluded.slug,
             url = excluded.url,
             excerpt = excluded.excerpt,
             conteudo_txt = excluded.conteudo_txt,
             categorias = excluded.categorias,
             tags = excluded.tags,
             palavras = excluded.palavras,
             publicado_em = excluded.publicado_em,
             wp_modified = excluded.wp_modified,
             synced_at = excluded.synced_at`,
        )
        .bind(
          crypto.randomUUID(),
          clientId,
          post.wp_post_id,
          post.wp_post_type,
          post.titulo,
          post.slug,
          post.url,
          post.excerpt,
          truncateConteudo(post.conteudo_txt),
          JSON.stringify(post.categorias),
          JSON.stringify(post.tags),
          post.palavras,
          post.publicado_em,
          post.wp_modified,
          ts,
        )
    })

    await runStatements(db, statements)
  }

  return { inseridos, atualizados }
}

/** Corte do sync incremental: post mais recentemente modificado já ingerido. */
export async function getUltimoModified(
  db: D1Database,
  clientId: string,
  postType: WpPostType,
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT MAX(wp_modified) AS ultimo FROM client_posts
       WHERE client_id = ? AND wp_post_type = ?`,
    )
    .bind(clientId, postType)
    .first<{ ultimo: string | null }>()
  return row?.ultimo ?? null
}

export async function getCorpusStatus(db: D1Database, clientId: string): Promise<CorpusStatus> {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN wp_post_type = 'post' THEN 1 ELSE 0 END) AS posts,
         SUM(CASE WHEN wp_post_type = 'page' THEN 1 ELSE 0 END) AS paginas,
         COALESCE(SUM(palavras), 0) AS palavras_total,
         MAX(synced_at) AS ultimo_sync,
         MAX(wp_modified) AS ultimo_modified
       FROM client_posts WHERE client_id = ?`,
    )
    .bind(clientId)
    .first<{
      total: number | null
      posts: number | null
      paginas: number | null
      palavras_total: number | null
      ultimo_sync: string | null
      ultimo_modified: string | null
    }>()

  const job = await db
    .prepare(
      `SELECT id FROM jobs
       WHERE client_id = ? AND tipo = 'sincronizar_corpus' AND status IN ('pendente', 'rodando')
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(clientId)
    .first<{ id: string }>()

  return {
    client_id: clientId,
    total: row?.total ?? 0,
    posts: row?.posts ?? 0,
    paginas: row?.paginas ?? 0,
    palavras_total: row?.palavras_total ?? 0,
    ultimo_sync: row?.ultimo_sync ?? null,
    ultimo_modified: row?.ultimo_modified ?? null,
    job_em_andamento: job?.id ?? null,
  }
}

export interface ListCorpusOptions {
  limit?: number
  offset?: number
  busca?: string
}

export async function listCorpusSummaries(
  db: D1Database,
  clientId: string,
  options: ListCorpusOptions = {},
): Promise<ClientPostSummary[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
  const offset = Math.max(options.offset ?? 0, 0)
  const busca = options.busca?.trim()

  const where = busca ? 'WHERE client_id = ? AND titulo LIKE ?' : 'WHERE client_id = ?'
  const binds: unknown[] = busca ? [clientId, `%${busca}%`] : [clientId]

  const { results } = await db
    .prepare(
      `SELECT id, client_id, wp_post_id, wp_post_type, titulo, slug, url, excerpt,
              NULL AS conteudo_txt, categorias, tags, palavras, publicado_em, wp_modified, synced_at
       FROM client_posts ${where}
       ORDER BY COALESCE(publicado_em, wp_modified) DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit, offset)
    .all<ClientPostRow>()

  return (results ?? []).map(rowToClientPostSummary)
}

export async function getClientPost(
  db: D1Database,
  clientId: string,
  postId: string,
): Promise<ClientPost | null> {
  const row = await db
    .prepare('SELECT * FROM client_posts WHERE client_id = ? AND id = ?')
    .bind(clientId, postId)
    .first<ClientPostRow>()
  return row ? rowToClientPost(row) : null
}

/** Inventário compacto do corpus para alimentar o Pauteiro. */
export async function listCorpusForPrompt(
  db: D1Database,
  clientId: string,
  limit = 800,
): Promise<CorpusPromptItem[]> {
  const { results } = await db
    .prepare(
      `SELECT titulo, url, categorias, publicado_em, palavras, excerpt, conteudo_txt
       FROM client_posts
       WHERE client_id = ?
       ORDER BY COALESCE(publicado_em, wp_modified) DESC
       LIMIT ?`,
    )
    .bind(clientId, limit)
    .all<{
      titulo: string
      url: string
      categorias: string | null
      publicado_em: string | null
      palavras: number
      excerpt: string | null
      conteudo_txt: string | null
    }>()

  return (results ?? []).map((row) => ({
    titulo: row.titulo,
    url: row.url,
    categorias: parseTerms(row.categorias).map((t) => t.name),
    publicado_em: row.publicado_em,
    palavras: row.palavras,
    excerpt: (row.excerpt?.trim() || row.conteudo_txt?.trim() || '').slice(0, 200),
  }))
}

/** Item do corpus para ranqueamento de links (sem o conteúdo completo). */
export interface CorpusLinkItem {
  titulo: string
  url: string
  categorias: string[]
  tags: string[]
  excerpt: string
}

/** Todos os títulos/taxonomias/resumos do corpus — entrada do rankRelatedPosts. */
export async function listCorpusForLinking(
  db: D1Database,
  clientId: string,
  limit = 3000,
): Promise<CorpusLinkItem[]> {
  const { results } = await db
    .prepare(
      `SELECT titulo, url, categorias, tags, excerpt
       FROM client_posts WHERE client_id = ?
       ORDER BY COALESCE(publicado_em, wp_modified) DESC
       LIMIT ?`,
    )
    .bind(clientId, limit)
    .all<{
      titulo: string
      url: string
      categorias: string | null
      tags: string | null
      excerpt: string | null
    }>()

  return (results ?? []).map((row) => ({
    titulo: row.titulo,
    url: row.url,
    categorias: parseTerms(row.categorias).map((t) => t.name),
    tags: parseTerms(row.tags).map((t) => t.name),
    excerpt: row.excerpt ?? '',
  }))
}

/** Conteúdo completo só dos posts escolhidos pelo ranqueamento. */
export async function getCorpusConteudos(
  db: D1Database,
  clientId: string,
  urls: string[],
): Promise<Map<string, string>> {
  const unicas = [...new Set(urls)].slice(0, 20)
  if (unicas.length === 0) return new Map()

  const placeholders = unicas.map(() => '?').join(', ')
  const { results } = await db
    .prepare(
      `SELECT url, conteudo_txt FROM client_posts
       WHERE client_id = ? AND url IN (${placeholders})`,
    )
    .bind(clientId, ...unicas)
    .all<{ url: string; conteudo_txt: string | null }>()

  return new Map((results ?? []).map((r) => [r.url, r.conteudo_txt ?? '']))
}

/**
 * Espelha o corpus em client_urls: o PRD exige que links internos venham
 * somente de client_urls, então todo post publicado precisa estar lá.
 */
export async function mirrorCorpusToClientUrls(
  db: D1Database,
  clientId: string,
  posts: CorpusPost[],
): Promise<number> {
  if (posts.length === 0) return 0

  for (let i = 0; i < posts.length; i += UPSERT_CHUNK) {
    const slice = posts.slice(i, i + UPSERT_CHUNK)
    const statements = slice.map((post) =>
      db
        .prepare(
          `INSERT INTO client_urls (id, client_id, url, titulo, slug, resumo, tipo, origem)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'wordpress')
           ON CONFLICT(client_id, url) DO UPDATE SET
             titulo = excluded.titulo,
             slug = COALESCE(excluded.slug, client_urls.slug),
             resumo = COALESCE(excluded.resumo, client_urls.resumo),
             tipo = CASE WHEN client_urls.tipo = 'outro' THEN excluded.tipo ELSE client_urls.tipo END`,
        )
        .bind(
          crypto.randomUUID(),
          clientId,
          post.url,
          post.titulo,
          post.slug,
          post.excerpt ? post.excerpt.slice(0, 300) : null,
          post.wp_post_type === 'page' ? 'institucional' : 'blog',
        ),
    )
    await runStatements(db, statements)
  }

  return posts.length
}
