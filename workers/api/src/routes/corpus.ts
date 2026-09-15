import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
import {
  getClientPost,
  getCorpusStatus,
  getIdea,
  listCorpusSummaries,
  listIdeas,
  setIdeaStatus,
} from '@publisher-p12/execution'
import type {
  ArticleIdeaStatus,
  Briefing,
  SuggestPautasInput,
  SyncCorpusInput,
  WpPostType,
} from '@publisher-p12/types'
import {
  createArticle,
  enqueueClientJob,
  getClient,
  getJobAtivoDoCliente,
} from '../lib/db.js'

const corpus = new Hono<{ Bindings: ApiBindings }>()

const STATUS_VALIDOS: ArticleIdeaStatus[] = ['nova', 'descartada', 'usada']

function parseTipos(raw: unknown): WpPostType[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const tipos = raw.filter((t): t is WpPostType => t === 'post' || t === 'page')
  return tipos.length > 0 ? tipos : undefined
}

// ---------------------------------------------------------------------------
// Base de conhecimento (corpus de artigos publicados)
// ---------------------------------------------------------------------------

corpus.get('/:id/corpus/status', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const status = await getCorpusStatus(c.env.DB, clientId)
  return c.json(status)
})

corpus.post('/:id/corpus/sync', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)
  if (!client.wp_app_password_configurado) {
    return c.json({ error: 'Application Password não configurada' }, 400)
  }

  const emAndamento = await getJobAtivoDoCliente(c.env.DB, clientId, 'sincronizar_corpus')
  if (emAndamento) {
    return c.json(
      {
        error: 'Sincronização já em andamento',
        job_id: emAndamento.id,
        status: 'em_andamento',
      },
      409,
    )
  }

  const body: Partial<SyncCorpusInput> = await c.req
    .json<Partial<SyncCorpusInput>>()
    .catch(() => ({}))
  const payload: SyncCorpusInput = {
    completo: Boolean(body.completo),
    tipos: parseTipos(body.tipos) ?? ['post'],
  }

  const job = await enqueueClientJob(
    c.env,
    clientId,
    'sincronizar_corpus',
    payload as unknown as Record<string, unknown>,
  )
  return c.json({ job_id: job.id, status: 'enqueued' })
})

corpus.get('/:id/corpus', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const posts = await listCorpusSummaries(c.env.DB, clientId, {
    limit: Number(c.req.query('limit') ?? 50),
    offset: Number(c.req.query('offset') ?? 0),
    busca: c.req.query('busca') ?? undefined,
  })
  return c.json(posts)
})

corpus.get('/:id/corpus/:postId', async (c) => {
  const post = await getClientPost(c.env.DB, c.req.param('id'), c.req.param('postId'))
  if (!post) return c.json({ error: 'Artigo não encontrado na base' }, 404)
  return c.json(post)
})

// ---------------------------------------------------------------------------
// Pautas sugeridas pela IA
// ---------------------------------------------------------------------------

corpus.post('/:id/pautas/gerar', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const status = await getCorpusStatus(c.env.DB, clientId)
  if (status.total === 0) {
    return c.json(
      { error: 'Base de conhecimento vazia — sincronize os artigos publicados antes' },
      400,
    )
  }

  const emAndamento = await getJobAtivoDoCliente(c.env.DB, clientId, 'sugerir_pautas')
  if (emAndamento) {
    return c.json(
      {
        error: 'Geração de pautas já em andamento',
        job_id: emAndamento.id,
        status: 'em_andamento',
      },
      409,
    )
  }

  const body: Partial<SuggestPautasInput> = await c.req
    .json<Partial<SuggestPautasInput>>()
    .catch(() => ({}))
  const payload: SuggestPautasInput = {
    quantidade: Number(body.quantidade) > 0 ? Number(body.quantidade) : 5,
    foco: typeof body.foco === 'string' && body.foco.trim() ? body.foco.trim() : undefined,
  }

  const job = await enqueueClientJob(
    c.env,
    clientId,
    'sugerir_pautas',
    payload as unknown as Record<string, unknown>,
  )
  return c.json({ job_id: job.id, status: 'enqueued' })
})

corpus.get('/:id/pautas', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const statusFiltro = c.req.query('status') as ArticleIdeaStatus | undefined
  const status = statusFiltro && STATUS_VALIDOS.includes(statusFiltro) ? statusFiltro : undefined

  const ideias = await listIdeas(c.env.DB, clientId, status)
  return c.json(ideias)
})

corpus.patch('/:id/pautas/:ideaId', async (c) => {
  const clientId = c.req.param('id')
  const body: { status?: ArticleIdeaStatus } = await c.req
    .json<{ status?: ArticleIdeaStatus }>()
    .catch(() => ({}))
  const status = body.status

  if (!status || !STATUS_VALIDOS.includes(status)) {
    return c.json({ error: 'Status inválido' }, 400)
  }

  const ok = await setIdeaStatus(c.env.DB, clientId, c.req.param('ideaId'), status)
  if (!ok) return c.json({ error: 'Pauta não encontrada' }, 404)
  return c.json({ ok: true })
})

/** Converte a pauta em artigo com briefing já preenchido. */
corpus.post('/:id/pautas/:ideaId/artigo', async (c) => {
  const clientId = c.req.param('id')
  const ideaId = c.req.param('ideaId')

  const idea = await getIdea(c.env.DB, clientId, ideaId)
  if (!idea) return c.json({ error: 'Pauta não encontrada' }, 404)
  if (idea.status === 'usada' && idea.article_id) {
    return c.json({ error: 'Pauta já virou artigo', article_id: idea.article_id }, 409)
  }

  const body: { wp_post_type?: WpPostType; agendado_para?: string | null } = await c.req
    .json<{ wp_post_type?: WpPostType; agendado_para?: string | null }>()
    .catch(() => ({}))

  const pauta = idea.pauta
  const observacoes = [
    pauta.justificativa ? `Lacuna: ${pauta.justificativa}` : '',
    pauta.cluster ? `Cluster: ${pauta.cluster}` : '',
    pauta.risco_canibalizacao ? `Canibalização: ${pauta.risco_canibalizacao}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const briefing: Briefing = {
    tema: pauta.tema,
    kw_principal: pauta.kw_principal,
    kws_secundarias: pauta.kws_secundarias,
    intencao: pauta.intencao,
    etapa_funil: pauta.etapa_funil,
    angulo: pauta.angulo,
    publico: pauta.publico,
    extensao_alvo: pauta.extensao_alvo,
    artigos_irmaos: pauta.artigos_relacionados,
    observacoes: observacoes || undefined,
  }

  const article = await createArticle(c.env.DB, {
    client_id: clientId,
    briefing,
    wp_post_type: body.wp_post_type ?? 'post',
    agendado_para: body.agendado_para ?? null,
  })

  await setIdeaStatus(c.env.DB, clientId, ideaId, 'usada', article.id)
  return c.json(article, 201)
})

export default corpus
