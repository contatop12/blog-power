/** D1: vínculo Google do cliente e oportunidades. */
import type {
  ClientGoogle,
  GoogleConta,
  Oportunidade,
  OportunidadeStatus,
  OportunidadeTipo,
  PautaSugerida,
} from '@publisher-p12/types'
import type { D1Database } from '../types/d1.js'
import type { OportunidadeCalculada } from './quickWins.js'

export async function getClientGoogle(db: D1Database, clientId: string): Promise<ClientGoogle> {
  const row = await db
    .prepare('SELECT client_id, gsc_site_url, gsc_conta, updated_at FROM client_google WHERE client_id = ?')
    .bind(clientId)
    .first<ClientGoogle>()
  return row ?? { client_id: clientId, gsc_site_url: null, gsc_conta: null, updated_at: null }
}

export async function saveClientGoogle(
  db: D1Database,
  clientId: string,
  v: { gsc_site_url: string | null; gsc_conta: GoogleConta | null },
): Promise<ClientGoogle> {
  await db
    .prepare(
      `INSERT INTO client_google (client_id, gsc_site_url, gsc_conta, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET
         gsc_site_url = excluded.gsc_site_url,
         gsc_conta = excluded.gsc_conta,
         updated_at = excluded.updated_at`,
    )
    .bind(clientId, v.gsc_site_url, v.gsc_conta, new Date().toISOString())
    .run()
  return getClientGoogle(db, clientId)
}

export async function saveOportunidades(
  db: D1Database,
  clientId: string,
  janela: { inicio: string; fim: string },
  itens: OportunidadeCalculada[],
  tipo: OportunidadeTipo = 'quick_win',
): Promise<number> {
  const ts = new Date().toISOString()
  const statements = itens.map((o) =>
    db
      .prepare(
        `INSERT INTO opportunities
           (id, client_id, tipo, query, query_norm, page_url, posicao, impressoes, cliques, ctr,
            volume_mensal, concorrencia, score, janela_inicio, janela_fim, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(client_id, tipo, query_norm) DO UPDATE SET
           query = excluded.query,
           page_url = excluded.page_url,
           posicao = excluded.posicao,
           impressoes = excluded.impressoes,
           cliques = excluded.cliques,
           ctr = excluded.ctr,
           volume_mensal = excluded.volume_mensal,
           concorrencia = excluded.concorrencia,
           score = excluded.score,
           janela_inicio = excluded.janela_inicio,
           janela_fim = excluded.janela_fim,
           updated_at = excluded.updated_at`,
      )
      .bind(
        crypto.randomUUID(), clientId, tipo, o.query, o.query_norm, o.page_url, o.posicao,
        o.impressoes, o.cliques, o.ctr, o.volume_mensal, o.concorrencia, o.score, janela.inicio, janela.fim, ts, ts,
      ),
  )
  // Quick wins que sumiram nesta janela e ninguém tocou saem; descartadas/em pauta ficam.
  statements.push(
    db
      .prepare(`DELETE FROM opportunities WHERE client_id = ? AND tipo = '${tipo}' AND status = 'nova' AND janela_fim <> ?`)
      .bind(clientId, janela.fim),
  )

  if (typeof db.batch === 'function') await db.batch(statements)
  else for (const s of statements) await s.run()
  return itens.length
}

interface OportunidadeRow extends Omit<Oportunidade, 'tipo' | 'status'> {
  tipo: string
  status: string
  query_norm: string
}

function rowToOportunidade(row: OportunidadeRow): Oportunidade {
  return {
    id: row.id,
    client_id: row.client_id,
    tipo: row.tipo as OportunidadeTipo,
    query: row.query,
    page_url: row.page_url,
    posicao: Number(row.posicao),
    impressoes: Number(row.impressoes),
    cliques: Number(row.cliques),
    ctr: Number(row.ctr),
    volume_mensal: row.volume_mensal === null ? null : Number(row.volume_mensal),
    concorrencia: row.concorrencia,
    score: Number(row.score),
    status: row.status as OportunidadeStatus,
    janela_inicio: row.janela_inicio,
    janela_fim: row.janela_fim,
    idea_id: row.idea_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listOportunidades(
  db: D1Database,
  clientId: string,
  status?: OportunidadeStatus,
): Promise<Oportunidade[]> {
  const sql = status
    ? 'SELECT * FROM opportunities WHERE client_id = ? AND status = ? ORDER BY score DESC, impressoes DESC'
    : 'SELECT * FROM opportunities WHERE client_id = ? ORDER BY score DESC, impressoes DESC'
  const stmt = status ? db.prepare(sql).bind(clientId, status) : db.prepare(sql).bind(clientId)
  const { results } = await stmt.all<OportunidadeRow>()
  return (results ?? []).map(rowToOportunidade)
}

export async function getOportunidade(db: D1Database, clientId: string, id: string): Promise<Oportunidade | null> {
  const row = await db
    .prepare('SELECT * FROM opportunities WHERE client_id = ? AND id = ?')
    .bind(clientId, id)
    .first<OportunidadeRow>()
  return row ? rowToOportunidade(row) : null
}

export async function setOportunidadeStatus(
  db: D1Database,
  clientId: string,
  id: string,
  status: OportunidadeStatus,
  ideaId: string | null = null,
): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE opportunities SET status = ?, idea_id = COALESCE(?, idea_id), updated_at = ?
       WHERE client_id = ? AND id = ?`,
    )
    .bind(status, ideaId, new Date().toISOString(), clientId, id)
    .run()
  return (res.meta?.changes ?? 0) > 0
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

export function oportunidadeParaPauta(o: Oportunidade): PautaSugerida {
  const demanda = o.volume_mensal !== null ? `${fmt(o.volume_mensal)} buscas/mês no Brasil` : 'volume não medido'
  const pagina = o.page_url ?? 'uma página do site'
  return {
    tema: o.query.charAt(0).toUpperCase() + o.query.slice(1),
    kw_principal: o.query,
    kws_secundarias: [],
    intencao: 'a definir pelo Pesquisador',
    etapa_funil: 'a definir pelo Pesquisador',
    angulo: 'Aprofundar um ângulo complementar ao da página que já ranqueia e linkar para ela',
    publico: '',
    extensao_alvo: 1500,
    cluster: '',
    justificativa:
      `Busca real no Google: "${o.query}" — posição ${fmt(o.posicao)}, ${fmt(o.impressoes)} impressões e ` +
      `${fmt(o.cliques)} cliques em 28 dias (${o.janela_inicio} a ${o.janela_fim}); ${demanda}. ` +
      `Quick win: o site já aparece, falta subir para o top 3.`,
    artigos_relacionados: o.page_url ? [o.page_url] : [],
    risco_canibalizacao:
      `${pagina} já ranqueia para "${o.query}". O artigo novo não pode competir com ela: ` +
      `cubra uma dúvida ou ângulo complementar e faça link para ela com âncora natural.`,
  }
}

export async function createIdeaFromOportunidade(db: D1Database, clientId: string, o: Oportunidade): Promise<string> {
  const pauta = oportunidadeParaPauta(o)
  const id = crypto.randomUUID()
  await db
    .prepare("INSERT INTO article_ideas (id, client_id, tema, kw_principal, cluster, payload, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'nova', ?)")
    .bind(id, clientId, pauta.tema, pauta.kw_principal, pauta.cluster || null, JSON.stringify(pauta), new Date().toISOString())
    .run()
  return id
}
