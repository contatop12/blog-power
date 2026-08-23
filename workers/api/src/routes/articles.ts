import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
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
  const article = await updateArticle(c.env.DB, c.req.param('id'), body)
  if (!article) return c.json({ error: 'Artigo não encontrado' }, 404)
  return c.json(article)
})

articles.post('/:id/generate', async (c) => {
  const articleId = c.req.param('id')
  const article = await getArticle(c.env.DB, articleId)
  if (!article) return c.json({ error: 'Artigo não encontrado' }, 404)

  await updateArticle(c.env.DB, articleId, { status: 'gerando', erro_msg: null })
  const job = await enqueueJob(c.env, articleId, 'redigir')
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
  await updateArticle(c.env.DB, articleId, { status: 'aprovado' })
  const job = await enqueueJob(c.env, articleId, 'publicar', publish as unknown as Record<string, unknown>)
  return c.json({ job_id: job.id, status: 'enqueued' })
})

export default articles
