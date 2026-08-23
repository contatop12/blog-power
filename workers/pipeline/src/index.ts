import type { D1Database, MessageBatch, Queue, R2Bucket } from '@cloudflare/workers-types'
import type { JobTipo, PublishArticleInput, QueueMessage } from '@publisher-p12/types'
import {
  decryptSecret,
  generateFeaturedImage,
  markdownToGutenberg,
  notifyPublishScheduled,
  publishToWordPress,
  removeInvalidLinksFromMarkdown,
  resolveEvolutionConfig,
  resolveOpenRouterApiKey,
  runEditor,
  runRedator,
  validateInternalLinks,
} from '@publisher-p12/execution'

export interface PipelineBindings {
  DB: D1Database
  IMAGES: R2Bucket
  ARTICLE_QUEUE: Queue
  ENVIRONMENT: string
  ENCRYPTION_KEY: string
  OPENROUTER_API_KEY: string
  OPENROUTER_MODEL_REDATOR: string
  OPENROUTER_MODEL_EDITOR: string
  OPENROUTER_MODEL_IMAGEM: string
  IMAGE_PROVIDER: string
}

async function updateJobStatus(
  db: D1Database,
  jobId: string,
  status: 'rodando' | 'ok' | 'erro',
  erro?: string,
): Promise<void> {
  const finishedAt = status === 'ok' || status === 'erro' ? new Date().toISOString() : null
  await db
    .prepare(
      `UPDATE jobs SET status = ?, erro = ?, finished_at = COALESCE(?, finished_at),
       tentativas = tentativas + 1 WHERE id = ?`,
    )
    .bind(status, erro ?? null, finishedAt, jobId)
    .run()
}

async function enqueueNext(
  env: PipelineBindings,
  articleId: string,
  tipo: JobTipo,
  payload?: Record<string, unknown>,
): Promise<void> {
  const jobId = crypto.randomUUID()
  const ts = new Date().toISOString()
  await env.DB.prepare(
    `INSERT INTO jobs (id, article_id, tipo, status, payload, created_at)
     VALUES (?, ?, ?, 'pendente', ?, ?)`,
  )
    .bind(jobId, articleId, tipo, payload ? JSON.stringify(payload) : null, ts)
    .run()

  await env.ARTICLE_QUEUE.send({ job_id: jobId, article_id: articleId, tipo })
}

async function getArticleRow(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first<{
    id: string
    client_id: string
    briefing: string | null
    conteudo_md: string | null
    seo: string | null
    geo: string | null
    schema_jsonld: string | null
    imagem_url: string | null
    imagem_alt: string | null
    conteudo_html: string | null
  }>()
}

async function getClientRow(db: D1Database, id: string) {
  return db.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<{
    id: string
    nome: string
    wp_api_url: string
    wp_user: string
    wp_app_password_enc: string | null
    seo_plugin: 'yoast' | 'rankmath' | 'nenhum'
    perfil_marca: string | null
    dominio: string
  }>()
}

async function processJob(env: PipelineBindings, msg: QueueMessage): Promise<void> {
  const { job_id: jobId, article_id: articleId, tipo } = msg
  await updateJobStatus(env.DB, jobId, 'rodando')

  const openRouterKey =
    (await resolveOpenRouterApiKey(env.DB, env.ENCRYPTION_KEY, env.OPENROUTER_API_KEY)) ?? ''

  try {
    switch (tipo) {
      case 'redigir': {
        const article = await getArticleRow(env.DB, articleId)
        const client = article ? await getClientRow(env.DB, article.client_id) : null
        if (!article?.briefing || !client?.perfil_marca) {
          throw new Error('Briefing ou perfil de marca ausente')
        }

        const briefing = JSON.parse(article.briefing)
        const perfilMarca = JSON.parse(client.perfil_marca)

        const { results: urlRows } = await env.DB.prepare(
          'SELECT url, titulo, resumo FROM client_urls WHERE client_id = ? LIMIT 20',
        )
          .bind(client.id)
          .all<{ url: string; titulo: string | null; resumo: string | null }>()

        const conteudoMd = await runRedator({
          briefing,
          perfilMarca,
          urlsRelevantes: urlRows ?? [],
          artigosIrmaos: [],
          apiKey: openRouterKey,
          model: env.OPENROUTER_MODEL_REDATOR,
        })

        await env.DB.prepare(
          `UPDATE articles SET conteudo_md = ?, status = 'rascunho', updated_at = ? WHERE id = ?`,
        )
          .bind(conteudoMd, new Date().toISOString(), articleId)
          .run()

        await updateJobStatus(env.DB, jobId, 'ok')
        await enqueueNext(env, articleId, 'editar')
        break
      }

      case 'editar': {
        const article = await getArticleRow(env.DB, articleId)
        const client = article ? await getClientRow(env.DB, article.client_id) : null
        if (!article?.conteudo_md || !article.briefing || !client?.perfil_marca) {
          throw new Error('Artigo ou contexto incompleto para edição')
        }

        const { results: urlRows } = await env.DB.prepare(
          'SELECT url, titulo FROM client_urls WHERE client_id = ?',
        )
          .bind(client.id)
          .all<{ url: string; titulo: string | null }>()

        const output = await runEditor({
          conteudoMd: article.conteudo_md,
          briefing: JSON.parse(article.briefing),
          perfilMarca: JSON.parse(client.perfil_marca),
          clientUrls: urlRows ?? [],
          seoPlugin: client.seo_plugin,
          apiKey: openRouterKey,
          model: env.OPENROUTER_MODEL_EDITOR,
        })

        const html = markdownToGutenberg(output.conteudo_md)
        await env.DB.prepare(
          `UPDATE articles SET conteudo_md = ?, conteudo_html = ?, seo = ?, geo = ?,
           schema_jsonld = ?, status = 'rascunho', updated_at = ? WHERE id = ?`,
        )
          .bind(
            output.conteudo_md,
            html,
            JSON.stringify(output.seo),
            JSON.stringify(output.geo),
            JSON.stringify(output.schema_jsonld),
            new Date().toISOString(),
            articleId,
          )
          .run()

        await updateJobStatus(env.DB, jobId, 'ok')
        await enqueueNext(env, articleId, 'validar_links')
        break
      }

      case 'validar_links': {
        const article = await getArticleRow(env.DB, articleId)
        if (!article?.seo) throw new Error('SEO ausente para validação')

        const seo = JSON.parse(article.seo) as { links_internos: Array<{ url: string; ancora: string }> }
        const result = await validateInternalLinks({ links: seo.links_internos ?? [] })
        seo.links_internos = result.links

        let conteudoMd = article.conteudo_md
        if (conteudoMd && result.invalid.length > 0) {
          conteudoMd = removeInvalidLinksFromMarkdown(
            conteudoMd,
            result.invalid.map((l) => l.url),
          )
        }

        await env.DB.prepare(
          `UPDATE articles SET seo = ?, conteudo_md = COALESCE(?, conteudo_md), updated_at = ? WHERE id = ?`,
        )
          .bind(JSON.stringify(seo), conteudoMd, new Date().toISOString(), articleId)
          .run()

        await updateJobStatus(env.DB, jobId, 'ok')
        await enqueueNext(env, articleId, 'imagem')
        break
      }

      case 'imagem': {
        const article = await getArticleRow(env.DB, articleId)
        const client = article ? await getClientRow(env.DB, article.client_id) : null
        if (!article?.seo || !client?.perfil_marca) throw new Error('SEO ou perfil ausente')

        const seo = JSON.parse(article.seo) as { imagem: { prompt: string; alt: string } }
        const perfil = JSON.parse(client.perfil_marca) as { diretriz_visual: string }

        const image = await generateFeaturedImage({
          prompt: seo.imagem.prompt,
          diretrizVisual: perfil.diretriz_visual,
          alt: seo.imagem.alt,
          provider: env.IMAGE_PROVIDER as 'openrouter' | 'workers_ai',
          apiKey: openRouterKey,
        })

        const key = `articles/${articleId}/featured.webp`
        await env.IMAGES.put(key, image.bytes, { httpMetadata: { contentType: image.contentType } })

        await env.DB.prepare(
          `UPDATE articles SET imagem_url = ?, imagem_alt = ?, status = 'em_revisao', updated_at = ? WHERE id = ?`,
        )
          .bind(key, image.alt, new Date().toISOString(), articleId)
          .run()

        await updateJobStatus(env.DB, jobId, 'ok')
        break
      }

      case 'publicar': {
        const article = await getArticleRow(env.DB, articleId)
        const client = article ? await getClientRow(env.DB, article.client_id) : null
        if (!article || !client || !article.conteudo_html || !article.seo) {
          throw new Error('Artigo incompleto para publicação')
        }

        const jobRow = await env.DB.prepare('SELECT payload FROM jobs WHERE id = ?')
          .bind(jobId)
          .first<{ payload: string | null }>()
        const publish = jobRow?.payload
          ? (JSON.parse(jobRow.payload) as PublishArticleInput)
          : null
        if (!publish) throw new Error('Payload de publicação ausente')

        if (!client.wp_app_password_enc) throw new Error('Credenciais WP ausentes')
        const password = await decryptSecret(client.wp_app_password_enc, env.ENCRYPTION_KEY)

        let imageBytes: Uint8Array | undefined
        if (article.imagem_url) {
          const obj = await env.IMAGES.get(article.imagem_url)
          if (obj) imageBytes = new Uint8Array(await obj.arrayBuffer())
        }

        const seo = JSON.parse(article.seo)
        const schema = article.schema_jsonld ? JSON.parse(article.schema_jsonld) : undefined

        const result = await publishToWordPress({
          creds: {
            wpApiUrl: client.wp_api_url,
            wpUser: client.wp_user,
            wpAppPassword: password,
          },
          seoPlugin: client.seo_plugin,
          title: seo.titulo_seo,
          slug: seo.slug,
          contentHtml: article.conteudo_html,
          seo,
          schemaJsonld: schema,
          imageBytes,
          imageAlt: article.imagem_alt ?? undefined,
          publish,
        })

        await env.DB.prepare(
          `UPDATE articles SET wp_post_id = ?, wp_url = ?, status = 'agendado',
           agendado_para = ?, updated_at = ? WHERE id = ?`,
        )
          .bind(
            result.wp_post_id,
            result.wp_url,
            publish.agendado_para,
            new Date().toISOString(),
            articleId,
          )
          .run()

        const urlId = crypto.randomUUID()
        await env.DB.prepare(
          `INSERT INTO client_urls (id, client_id, url, titulo, slug, origem)
           VALUES (?, ?, ?, ?, ?, 'publicado_aqui')
           ON CONFLICT(client_id, url) DO NOTHING`,
        )
          .bind(urlId, client.id, result.wp_url, seo.titulo_seo, seo.slug)
          .run()

        await updateJobStatus(env.DB, jobId, 'ok')

        try {
          const evolution = await resolveEvolutionConfig(env.DB, env.ENCRYPTION_KEY)
          if (evolution) {
            await notifyPublishScheduled(evolution, {
              clientName: client.nome,
              articleTitle: seo.titulo_seo,
              wpUrl: result.wp_url,
              agendadoPara: publish.agendado_para,
            })
          }
        } catch {
          // Notificação não deve falhar a publicação
        }
        break
      }

      default: {
        const _exhaustive: never = tipo
        throw new Error(`Tipo de job desconhecido: ${String(_exhaustive)}`)
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await updateJobStatus(env.DB, jobId, 'erro', message)
    await env.DB.prepare(
      `UPDATE articles SET status = 'erro', erro_msg = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(message, new Date().toISOString(), articleId)
      .run()
    throw err
  }
}

export default {
  async queue(batch: MessageBatch<QueueMessage>, env: PipelineBindings): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processJob(env, message.body)
        message.ack()
      } catch {
        message.retry()
      }
    }
  },
}
