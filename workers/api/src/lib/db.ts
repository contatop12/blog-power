import type {
  Article,
  ArticleStatus,
  Briefing,
  Client,
  ConnectionStatus,
  CreateArticleInput,
  CreateClientInput,
  GeoJson,
  Job,
  JobStatus,
  JobTipo,
  PerfilMarca,
  PublishArticleInput,
  SeoJson,
  SeoPlugin,
} from '@publisher-p12/types'
import { encryptSecret } from '@publisher-p12/execution'
import type { ApiBindings } from '../bindings.js'

function now(): string {
  return new Date().toISOString()
}

function uuid(): string {
  return crypto.randomUUID()
}

interface ClientRow {
  id: string
  nome: string
  dominio: string
  wp_api_url: string
  wp_user: string
  wp_app_password_enc: string | null
  seo_plugin: SeoPlugin
  timezone: string
  categoria_padrao_id: number | null
  autor_padrao_id: number | null
  perfil_marca: string | null
  status_conexao: ConnectionStatus
  created_at: string
  updated_at: string
}

interface ArticleRow {
  id: string
  client_id: string
  status: ArticleStatus
  briefing: string | null
  conteudo_md: string | null
  conteudo_html: string | null
  seo: string | null
  geo: string | null
  schema_jsonld: string | null
  imagem_url: string | null
  imagem_alt: string | null
  wp_post_id: number | null
  wp_url: string | null
  agendado_para: string | null
  publicado_em: string | null
  erro_msg: string | null
  created_at: string
  updated_at: string
}

interface JobRow {
  id: string
  article_id: string
  tipo: JobTipo
  status: JobStatus
  payload: string | null
  tentativas: number
  erro: string | null
  created_at: string
  finished_at: string | null
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function rowToClient(row: ClientRow): Client {
  return {
    id: row.id,
    nome: row.nome,
    dominio: row.dominio,
    wp_api_url: row.wp_api_url,
    wp_user: row.wp_user,
    wp_app_password_configurado: Boolean(row.wp_app_password_enc),
    seo_plugin: row.seo_plugin,
    timezone: row.timezone,
    categoria_padrao_id: row.categoria_padrao_id,
    autor_padrao_id: row.autor_padrao_id,
    perfil_marca: parseJson<PerfilMarca>(row.perfil_marca),
    status_conexao: row.status_conexao,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function rowToArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    client_id: row.client_id,
    status: row.status,
    briefing: parseJson<Briefing>(row.briefing),
    conteudo_md: row.conteudo_md,
    conteudo_html: row.conteudo_html,
    seo: parseJson<SeoJson>(row.seo),
    geo: parseJson<GeoJson>(row.geo),
    schema_jsonld: parseJson<Record<string, unknown>>(row.schema_jsonld),
    imagem_url: row.imagem_url,
    imagem_alt: row.imagem_alt,
    wp_post_id: row.wp_post_id,
    wp_url: row.wp_url,
    agendado_para: row.agendado_para,
    publicado_em: row.publicado_em,
    erro_msg: row.erro_msg,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    article_id: row.article_id,
    tipo: row.tipo,
    status: row.status,
    payload: parseJson<Record<string, unknown>>(row.payload),
    tentativas: row.tentativas,
    erro: row.erro,
    created_at: row.created_at,
    finished_at: row.finished_at,
  }
}

export async function listClients(db: D1Database): Promise<Client[]> {
  const { results } = await db.prepare('SELECT * FROM clients ORDER BY nome').all<ClientRow>()
  return (results ?? []).map(rowToClient)
}

export async function getClient(db: D1Database, id: string): Promise<Client | null> {
  const row = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<ClientRow>()
  return row ? rowToClient(row) : null
}

export async function createClient(
  db: D1Database,
  input: CreateClientInput,
  encryptionKey: string,
): Promise<Client> {
  const id = uuid()
  const ts = now()
  let passwordEnc: string | null = null
  if (input.wp_app_password) {
    passwordEnc = await encryptSecret(input.wp_app_password, encryptionKey)
  }

  await db
    .prepare(
      `INSERT INTO clients (
        id, nome, dominio, wp_api_url, wp_user, wp_app_password_enc,
        seo_plugin, timezone, categoria_padrao_id, autor_padrao_id,
        perfil_marca, status_conexao, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nao_testado', ?, ?)`,
    )
    .bind(
      id,
      input.nome,
      input.dominio,
      input.wp_api_url,
      input.wp_user,
      passwordEnc,
      input.seo_plugin ?? 'yoast',
      input.timezone ?? 'America/Sao_Paulo',
      input.categoria_padrao_id ?? null,
      input.autor_padrao_id ?? null,
      input.perfil_marca ? JSON.stringify(input.perfil_marca) : null,
      ts,
      ts,
    )
    .run()

  const client = await getClient(db, id)
  if (!client) throw new Error('Falha ao criar cliente')
  return client
}

export async function updateClient(
  db: D1Database,
  id: string,
  patch: Partial<CreateClientInput>,
  encryptionKey: string,
): Promise<Client | null> {
  const existing = await getClient(db, id)
  if (!existing) return null

  let passwordEnc: string | undefined
  if (patch.wp_app_password) {
    passwordEnc = await encryptSecret(patch.wp_app_password, encryptionKey)
  }

  await db
    .prepare(
      `UPDATE clients SET
        nome = COALESCE(?, nome),
        dominio = COALESCE(?, dominio),
        wp_api_url = COALESCE(?, wp_api_url),
        wp_user = COALESCE(?, wp_user),
        wp_app_password_enc = COALESCE(?, wp_app_password_enc),
        seo_plugin = COALESCE(?, seo_plugin),
        timezone = COALESCE(?, timezone),
        categoria_padrao_id = COALESCE(?, categoria_padrao_id),
        autor_padrao_id = COALESCE(?, autor_padrao_id),
        perfil_marca = COALESCE(?, perfil_marca),
        updated_at = ?
      WHERE id = ?`,
    )
    .bind(
      patch.nome ?? null,
      patch.dominio ?? null,
      patch.wp_api_url ?? null,
      patch.wp_user ?? null,
      passwordEnc ?? null,
      patch.seo_plugin ?? null,
      patch.timezone ?? null,
      patch.categoria_padrao_id ?? null,
      patch.autor_padrao_id ?? null,
      patch.perfil_marca ? JSON.stringify(patch.perfil_marca) : null,
      now(),
      id,
    )
    .run()

  return getClient(db, id)
}

export async function deleteClient(db: D1Database, id: string): Promise<boolean> {
  const res = await db.prepare('DELETE FROM clients WHERE id = ?').bind(id).run()
  return (res.meta.changes ?? 0) > 0
}

export async function getClientPasswordEnc(
  db: D1Database,
  id: string,
): Promise<string | null> {
  const row = await db
    .prepare('SELECT wp_app_password_enc FROM clients WHERE id = ?')
    .bind(id)
    .first<{ wp_app_password_enc: string | null }>()
  return row?.wp_app_password_enc ?? null
}

export async function setClientConnectionStatus(
  db: D1Database,
  id: string,
  status: ConnectionStatus,
): Promise<void> {
  await db
    .prepare('UPDATE clients SET status_conexao = ?, updated_at = ? WHERE id = ?')
    .bind(status, now(), id)
    .run()
}

export async function listArticles(
  db: D1Database,
  filters?: { client_id?: string; status?: ArticleStatus },
): Promise<Article[]> {
  let query = 'SELECT * FROM articles WHERE 1=1'
  const binds: unknown[] = []
  if (filters?.client_id) {
    query += ' AND client_id = ?'
    binds.push(filters.client_id)
  }
  if (filters?.status) {
    query += ' AND status = ?'
    binds.push(filters.status)
  }
  query += ' ORDER BY created_at DESC'
  const stmt = db.prepare(query)
  const { results } = await (binds.length > 0 ? stmt.bind(...binds) : stmt).all<ArticleRow>()
  return (results ?? []).map(rowToArticle)
}

export async function getArticle(db: D1Database, id: string): Promise<Article | null> {
  const row = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first<ArticleRow>()
  return row ? rowToArticle(row) : null
}

export async function createArticle(
  db: D1Database,
  input: CreateArticleInput,
): Promise<Article> {
  const id = uuid()
  const ts = now()
  await db
    .prepare(
      `INSERT INTO articles (id, client_id, status, briefing, created_at, updated_at)
       VALUES (?, ?, 'briefing', ?, ?, ?)`,
    )
    .bind(id, input.client_id, JSON.stringify(input.briefing), ts, ts)
    .run()

  const article = await getArticle(db, id)
  if (!article) throw new Error('Falha ao criar artigo')
  return article
}

export async function updateArticle(
  db: D1Database,
  id: string,
  patch: Partial<{
    status: ArticleStatus
    briefing: Briefing
    conteudo_md: string
    conteudo_html: string
    seo: SeoJson
    geo: GeoJson
    schema_jsonld: Record<string, unknown>
    imagem_url: string
    imagem_alt: string
    wp_post_id: number
    wp_url: string
    agendado_para: string
    publicado_em: string
    erro_msg: string | null
  }>,
): Promise<Article | null> {
  const fields: string[] = []
  const values: unknown[] = []

  const map: Array<[keyof typeof patch, string, (v: unknown) => unknown]> = [
    ['status', 'status', (v) => v],
    ['briefing', 'briefing', (v) => JSON.stringify(v)],
    ['conteudo_md', 'conteudo_md', (v) => v],
    ['conteudo_html', 'conteudo_html', (v) => v],
    ['seo', 'seo', (v) => JSON.stringify(v)],
    ['geo', 'geo', (v) => JSON.stringify(v)],
    ['schema_jsonld', 'schema_jsonld', (v) => JSON.stringify(v)],
    ['imagem_url', 'imagem_url', (v) => v],
    ['imagem_alt', 'imagem_alt', (v) => v],
    ['wp_post_id', 'wp_post_id', (v) => v],
    ['wp_url', 'wp_url', (v) => v],
    ['agendado_para', 'agendado_para', (v) => v],
    ['publicado_em', 'publicado_em', (v) => v],
    ['erro_msg', 'erro_msg', (v) => v],
  ]

  for (const [key, col, transform] of map) {
    if (patch[key] !== undefined) {
      fields.push(`${col} = ?`)
      values.push(transform(patch[key]))
    }
  }

  if (fields.length === 0) return getArticle(db, id)

  fields.push('updated_at = ?')
  values.push(now(), id)

  await db
    .prepare(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  return getArticle(db, id)
}

export async function createJob(
  db: D1Database,
  articleId: string,
  tipo: JobTipo,
  payload?: Record<string, unknown>,
): Promise<Job> {
  const id = uuid()
  const ts = now()
  await db
    .prepare(
      `INSERT INTO jobs (id, article_id, tipo, status, payload, created_at)
       VALUES (?, ?, ?, 'pendente', ?, ?)`,
    )
    .bind(id, articleId, tipo, payload ? JSON.stringify(payload) : null, ts)
    .run()

  const job = await getJob(db, id)
  if (!job) throw new Error('Falha ao criar job')
  return job
}

export async function getJob(db: D1Database, id: string): Promise<Job | null> {
  const row = await db.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first<JobRow>()
  return row ? rowToJob(row) : null
}

export async function enqueueJob(
  env: ApiBindings,
  articleId: string,
  tipo: JobTipo,
  payload?: Record<string, unknown>,
): Promise<Job> {
  const job = await createJob(env.DB, articleId, tipo, payload)
  await env.ARTICLE_QUEUE.send({ job_id: job.id, article_id: articleId, tipo })
  return job
}

export async function upsertClientUrls(
  db: D1Database,
  clientId: string,
  urls: Array<{ url: string; titulo?: string; slug?: string }>,
): Promise<number> {
  let count = 0
  for (const u of urls) {
    const id = uuid()
    await db
      .prepare(
        `INSERT INTO client_urls (id, client_id, url, titulo, slug, origem)
         VALUES (?, ?, ?, ?, ?, 'sitemap')
         ON CONFLICT(client_id, url) DO UPDATE SET
           titulo = COALESCE(excluded.titulo, titulo),
           slug = COALESCE(excluded.slug, slug)`,
      )
      .bind(id, clientId, u.url, u.titulo ?? null, u.slug ?? null)
      .run()
    count++
  }
  return count
}

export type { PublishArticleInput }
