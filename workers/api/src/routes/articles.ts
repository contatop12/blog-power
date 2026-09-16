import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
import { markdownToGutenberg, parsePastedArticle } from '@publisher-p12/execution'
import {
  createArticle,
  enqueueJob,
  getArticle,
  listArticles,
  updateArticle,
} from '../lib/db.js'
import type { ArticleStatus, PublishArticleInput } from '@publisher-p12/types'

const articles = new Hono<{ Bindings: ApiBindings }>()

articles.get('/', async (c) => {
  const clientId = c.req.query('client_id')
  const status = c.req.query('status') as ArticleStatus | undefined
  const data = await listArticles(c.env.DB, {
    client_id: clientId ?? undefined,
    status,
  })
  return c.json(data)
})

articles.post('/', async (c) => {
  const body = await c.req.json()
  if (typeof body.conteudo_colado === 'string' && body.conteudo_colado.trim()) {
    const parsed = parsePastedArticle(body.conteudo_colado)
    body.conteudo_colado = parsed.conteudo_md
    body.briefing = {
      ...body.briefing,
      ...parsed.briefing_patch,
    }
  }
  const article = await createArticle(c.env.DB, body)
  return c.json(article, 201)
})

articles.get('/:id', async (c) => {
  const article = await getArticle(c.env.DB, c.req.param('id'))
  if (!article) return c.json({ error: 'Artigo não encontrado' }, 404)
  return c.json(article)
})

articles.patch('/:id', async (c) => {
  const body = await c.req.json()
  // O WordPress recebe conteudo_html: edição do markdown precisa regerar os blocos
  if (typeof body.conteudo_md === 'string') {
    body.conteudo_html = markdownToGutenberg(body.conteudo_md)
  }
  const article = await updateArticle(c.env.DB, c.req.param('id'), body)
  if (!article) return c.json({ error: 'Artigo não encontrado' }, 404)
  return c.json(article)
})

articles.post('/:id/generate', async (c) => {
  const articleId = c.req.param('id')
  const article = await getArticle(c.env.DB, articleId)
  if (!article) return c.json({ error: 'Artigo não encontrado' }, 404)

  await updateArticle(c.env.DB, articleId, { status: 'gerando', erro_msg: null })
  // Texto colado já existe: pula pesquisa e redação, entra direto na edição.
  // Caso contrário o pipeline começa pelo Pesquisador, que monta o dossiê.
  const nextJob = article.conteudo_md?.trim() ? 'editar' : 'pesquisar'
  const job = await enqueueJob(c.env, articleId, nextJob)
  return c.json({ job_id: job.id, status: 'enqueued' })
})

articles.post('/:id/regenerate-image', async (c) => {
  const articleId = c.req.param('id')
  const article = await getArticle(c.env.DB, articleId)
  if (!article) return c.json({ error: 'Artigo não encontrado' }, 404)

  const job = await enqueueJob(c.env, articleId, 'imagem')
  return c.json({ job_id: job.id, status: 'enqueued' })
})

articles.post('/:id/publish', async (c) => {
  const articleId = c.req.param('id')
  const article = await getArticle(c.env.DB, articleId)
  if (!article) return c.json({ error: 'Artigo não encontrado' }, 404)

  const publish = (await c.req.json()) as PublishArticleInput
  await updateArticle(c.env.DB, articleId, {
    status: 'aprovado',
    agendado_para: publish.agendado_para,
    wp_post_type: publish.wp_post_type ?? article.wp_post_type,
  })
  const job = await enqueueJob(c.env, articleId, 'publicar', publish as unknown as Record<string, unknown>)
  return c.json({ job_id: job.id, status: 'enqueued' })
})

export default articles
