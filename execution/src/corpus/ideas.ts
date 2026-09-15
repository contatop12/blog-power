import type { ArticleIdea, ArticleIdeaStatus, PautaSugerida } from '@publisher-p12/types'
import type { D1Database, D1PreparedStatement } from '../types/d1.js'

export interface ArticleIdeaRow {
  id: string
  client_id: string
  tema: string
  kw_principal: string | null
  cluster: string | null
  payload: string
  status: string
  article_id: string | null
  created_at: string
}

function normalizeStatus(value: string): ArticleIdeaStatus {
  return value === 'descartada' || value === 'usada' ? value : 'nova'
}

export function rowToArticleIdea(row: ArticleIdeaRow): ArticleIdea {
  let pauta: PautaSugerida
  try {
    pauta = JSON.parse(row.payload) as PautaSugerida
  } catch {
    pauta = {
      tema: row.tema,
      kw_principal: row.kw_principal ?? '',
      kws_secundarias: [],
      intencao: 'informacional',
      etapa_funil: 'topo',
      angulo: '',
      publico: '',
      extensao_alvo: 1500,
      cluster: row.cluster ?? '',
      justificativa: '',
      artigos_relacionados: [],
      risco_canibalizacao: null,
    }
  }

  return {
    id: row.id,
    client_id: row.client_id,
    tema: row.tema,
    kw_principal: row.kw_principal,
    cluster: row.cluster,
    pauta,
    status: normalizeStatus(row.status),
    article_id: row.article_id,
    created_at: row.created_at,
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

export async function saveIdeas(
  db: D1Database,
  clientId: string,
  pautas: PautaSugerida[],
): Promise<number> {
  if (pautas.length === 0) return 0
  const ts = new Date().toISOString()

  const statements = pautas.map((pauta) =>
    db
      .prepare(
        `INSERT INTO article_ideas (id, client_id, tema, kw_principal, cluster, payload, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'nova', ?)`,
      )
      .bind(
        crypto.randomUUID(),
        clientId,
        pauta.tema,
        pauta.kw_principal || null,
        pauta.cluster || null,
        JSON.stringify(pauta),
        ts,
      ),
  )

  await runStatements(db, statements)
  return pautas.length
}

export async function listIdeas(
  db: D1Database,
  clientId: string,
  status?: ArticleIdeaStatus,
): Promise<ArticleIdea[]> {
  const where = status ? 'WHERE client_id = ? AND status = ?' : 'WHERE client_id = ?'
  const binds = status ? [clientId, status] : [clientId]

  const { results } = await db
    .prepare(`SELECT * FROM article_ideas ${where} ORDER BY created_at DESC LIMIT 200`)
    .bind(...binds)
    .all<ArticleIdeaRow>()

  return (results ?? []).map(rowToArticleIdea)
}

export async function getIdea(
  db: D1Database,
  clientId: string,
  ideaId: string,
): Promise<ArticleIdea | null> {
  const row = await db
    .prepare('SELECT * FROM article_ideas WHERE client_id = ? AND id = ?')
    .bind(clientId, ideaId)
    .first<ArticleIdeaRow>()
  return row ? rowToArticleIdea(row) : null
}

export async function setIdeaStatus(
  db: D1Database,
  clientId: string,
  ideaId: string,
  status: ArticleIdeaStatus,
  articleId?: string | null,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE article_ideas SET status = ?, article_id = COALESCE(?, article_id)
       WHERE client_id = ? AND id = ?`,
    )
    .bind(status, articleId ?? null, clientId, ideaId)
    .run()

  return (res.meta?.changes ?? 0) > 0
}

/** Temas que o Pauteiro não pode repetir: já sugeridos e ainda vivos. */
export async function listTemasJaSugeridos(
  db: D1Database,
  clientId: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT tema FROM article_ideas
       WHERE client_id = ? AND status IN ('nova', 'usada')
       ORDER BY created_at DESC LIMIT 200`,
    )
    .bind(clientId)
    .all<{ tema: string }>()

  return (results ?? []).map((r) => r.tema)
}
