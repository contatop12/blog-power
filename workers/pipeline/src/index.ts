import type { D1Database, MessageBatch, Queue, R2Bucket } from '@cloudflare/workers-types'
import type {
  Briefing,
  Dossie,
  ImagemRef,
  JobTipo,
  PublishArticleInput,
  QaReport,
  QueueMessage,
  SeoJson,
  SyncCorpusInput,
  SyncCorpusResult,
  SuggestPautasInput,
  WpPostType,
} from '@publisher-p12/types'
import { CLIENT_SCOPED_JOBS, JOBS_PARALELOS } from '@publisher-p12/types'
import {
  R2_IMAGE_SCHEME,
  SKILL_VERSION,
  decidirAcaoPosRevisao,
  decryptSecret,
  enforceInternalLinks,
  extractR2ImageRefs,
  extractTrecho,
  fetchPublishedPosts,
  generateImage,
  getCorpusConteudos,
  insertImagesIntoMarkdown,
  mergeDossie,
  normalizePerfilCliente,
  parseDossie,
  resolveImageSlots,
  resumoQa,
  stripGeneratedImages,
  uploadWpMedia,
  validatePerfilCliente,
  type CorpusBloco,
  type ImageProvider,
  type ImageTransformerLike,
  type UploadedMedia,
  type WorkersAiLike,
  getUltimoModified,
  listCorpusForLinking,
  listCorpusForPrompt,
  mirrorCorpusToClientUrls,
  rankRelatedPosts,
  reconcileLinksInternos,
  listTemasJaSugeridos,
  markdownToGutenberg,
  notifyPublishScheduled,
  publishToWordPress,
  removeInvalidLinksFromMarkdown,
  resolveEvolutionConfig,
  resolveOpenRouterApiKey,
  runEditor,
  runPauteiro,
  runPesquisador,
  runRedator,
  runRevisor,
  saveIdeas,
  upsertCorpusPosts,
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
  /** Opcionais: caem no modelo do Editor quando não definidos. */
  OPENROUTER_MODEL_PAUTEIRO?: string
  OPENROUTER_MODEL_PESQUISADOR?: string
  OPENROUTER_MODEL_REVISOR?: string
  IMAGE_PROVIDER: string
  /** Workers AI — geração de imagem (FLUX). */
  AI?: WorkersAiLike
  /** Cloudflare Images — recorte + WebP. Sem ele, publica o JPEG do modelo. */
  IMAGE_TRANSFORM?: ImageTransformerLike
}

/** Decisão do produto: destacada + 2 imagens de apoio por artigo. */
const IMAGENS_CORPO_POR_ARTIGO = 2

/**
 * Orçamento de tempo da sincronização do corpus dentro de uma invocação do consumer.
 * Com blocos de 5, um blog de 3.000 posts são 600 requisições ao WordPress: não cabe
 * numa execução só. Ao estourar, o job grava o que leu e enfileira uma continuação.
 * Folga proposital sobre o teto de tempo de parede do Queue consumer.
 */
const SYNC_ORCAMENTO_MS = 8 * 60 * 1000

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

/** Continuação de job de escopo cliente (corpus que não coube no orçamento de tempo). */
async function enqueueClientJob(
  env: PipelineBindings,
  clientId: string,
  tipo: JobTipo,
  payload?: Record<string, unknown>,
): Promise<string> {
  const jobId = crypto.randomUUID()
  const ts = new Date().toISOString()
  await env.DB.prepare(
    `INSERT INTO jobs (id, client_id, tipo, status, payload, created_at)
     VALUES (?, ?, ?, 'pendente', ?, ?)`,
  )
    .bind(jobId, clientId, tipo, payload ? JSON.stringify(payload) : null, ts)
    .run()

  await env.ARTICLE_QUEUE.send({ job_id: jobId, article_id: null, client_id: clientId, tipo })
  return jobId
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
    dossie: string | null
    qa: string | null
    imagem_url: string | null
    imagem_alt: string | null
    conteudo_html: string | null
    wp_post_type: string | null
    wp_url: string | null
  }>()
}

// ---------------------------------------------------------------------------
// Dossiê — estado compartilhado entre os agentes
// ---------------------------------------------------------------------------

async function loadDossie(db: D1Database, articleId: string): Promise<Dossie> {
  const row = await db
    .prepare('SELECT dossie FROM articles WHERE id = ?')
    .bind(articleId)
    .first<{ dossie: string | null }>()
  return parseDossie(row?.dossie ?? null)
}

/** Lê, aplica a fatia do agente e grava. Cada agente escreve só o que é seu. */
async function patchDossie(
  db: D1Database,
  articleId: string,
  patch: Partial<Dossie>,
): Promise<Dossie> {
  const atual = await loadDossie(db, articleId)
  const proximo = mergeDossie(atual, patch)
  await db
    .prepare('UPDATE articles SET dossie = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(proximo), new Date().toISOString(), articleId)
    .run()
  return proximo
}

function parseQa(raw: string | null | undefined): QaReport | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as QaReport
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Junção do fan-out (imagem ‖ revisar)
// ---------------------------------------------------------------------------

/**
 * O Queue não tem barreira de sincronização, então o último dos dois jobs a terminar é
 * quem decide. Enquanto o irmão estiver pendente ou rodando, ninguém aplica veredito.
 *
 * Considera apenas o job mais recente daquele tipo: retry cria linha nova, e uma
 * execução anterior com status 'erro' não pode travar a junção para sempre.
 */
async function irmaoConcluido(
  db: D1Database,
  articleId: string,
  tipoIrmao: JobTipo,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT status FROM jobs WHERE article_id = ? AND tipo = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(articleId, tipoIrmao)
    .first<{ status: string }>()

  // Sem job irmão registrado, não há o que esperar
  if (!row) return true
  return row.status === 'ok' || row.status === 'erro'
}

/**
 * Aplica o veredito do Revisor quando `imagem` e `revisar` já terminaram.
 * Devolve a ação tomada, ou null quando ainda falta o irmão.
 */
async function aplicarVeredito(
  env: PipelineBindings,
  articleId: string,
  tipoAtual: JobTipo,
): Promise<'aprovar' | 'corrigir' | 'escalar_humano' | 'aguardando' | 'sem_qa'> {
  const tipoIrmao = JOBS_PARALELOS.find((t) => t !== tipoAtual)
  if (!tipoIrmao) throw new Error(`Job ${tipoAtual} não faz parte do fan-out`)
  if (!(await irmaoConcluido(env.DB, articleId, tipoIrmao))) return 'aguardando'

  const row = await env.DB.prepare('SELECT qa FROM articles WHERE id = ?')
    .bind(articleId)
    .first<{ qa: string | null }>()
  const qa = parseQa(row?.qa)

  // Revisor falhou ou foi pulado: não trava o artigo, segue para revisão humana
  if (!qa) {
    await marcarEmRevisao(env.DB, articleId)
    return 'sem_qa'
  }

  const acao = decidirAcaoPosRevisao(qa)

  if (acao === 'corrigir') {
    // Os dois jobs do fan-out podem terminar quase juntos e ambos enxergarem o irmão
    // pronto. O UPDATE condicional é a trava: só quem muda a linha enfileira a correção.
    const claim = await env.DB.prepare(
      `UPDATE articles SET status = 'gerando', updated_at = ?
       WHERE id = ? AND status <> 'gerando'`,
    )
      .bind(new Date().toISOString(), articleId)
      .run()

    if (!claim.meta?.changes) return 'aguardando'

    const dossie = await patchDossie(env.DB, articleId, { rodada: qa.rodada + 1 })
    await enqueueNext(env, articleId, 'redigir', { rodada: dossie.rodada })
    return acao
  }

  await marcarEmRevisao(env.DB, articleId)
  return acao
}

/**
 * Chegar à junção significa que o artigo está pronto para o humano, então o estado é
 * definido de uma vez: status e `erro_msg` juntos.
 *
 * Sem limpar `erro_msg`, a falha de um Revisor deixaria o artigo preso em 'erro' mesmo
 * depois de o retry da fila dar certo — e a ordem em que os dois jobs paralelos terminam
 * decidiria o status final. O erro do job continua registrado em `jobs` e aparece no
 * painel de erros de serviço.
 */
async function marcarEmRevisao(db: D1Database, articleId: string): Promise<void> {
  await db
    .prepare(
      `UPDATE articles SET status = 'em_revisao', erro_msg = NULL, updated_at = ? WHERE id = ?`,
    )
    .bind(new Date().toISOString(), articleId)
    .run()
}

/** Máximo de URLs do inventário enviadas ao Editor antes de recortar por relevância. */
const INVENTARIO_PROMPT_MAX = 150

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
    timezone: string
    categoria_padrao_id: number | null
    autor_padrao_id: number | null
  }>()
}

async function getJobPayload<T>(db: D1Database, jobId: string): Promise<T | null> {
  const row = await db
    .prepare('SELECT payload FROM jobs WHERE id = ?')
    .bind(jobId)
    .first<{ payload: string | null }>()
  if (!row?.payload) return null
  try {
    return JSON.parse(row.payload) as T
  } catch {
    return null
  }
}

/** Guarda o resultado do job no próprio payload, para a UI ler depois. */
async function setJobResultado(
  db: D1Database,
  jobId: string,
  resultado: Record<string, unknown>,
): Promise<void> {
  const atual = (await getJobPayload<Record<string, unknown>>(db, jobId)) ?? {}
  await db
    .prepare('UPDATE jobs SET payload = ? WHERE id = ?')
    .bind(JSON.stringify({ ...atual, resultado }), jobId)
    .run()
}

/** Credenciais WordPress descriptografadas do cliente. */
async function wpCreds(env: PipelineBindings, clientId: string) {
  const client = await getClientRow(env.DB, clientId)
  if (!client) throw new Error('Cliente não encontrado')
  if (!client.wp_app_password_enc) throw new Error('Credenciais WP ausentes')
  const wpAppPassword = await decryptSecret(client.wp_app_password_enc, env.ENCRYPTION_KEY)
  return {
    client,
    creds: { wpApiUrl: client.wp_api_url, wpUser: client.wp_user, wpAppPassword },
  }
}

async function processJob(env: PipelineBindings, msg: QueueMessage): Promise<void> {
  const { job_id: jobId, tipo } = msg
  const escopoCliente = CLIENT_SCOPED_JOBS.includes(tipo)

  if (!escopoCliente && !msg.article_id) {
    throw new Error(`Job ${tipo} recebido sem article_id`)
  }

  const articleId = msg.article_id ?? ''
  const clientIdMsg = msg.client_id ?? null
  await updateJobStatus(env.DB, jobId, 'rodando')

  const openRouterKey =
    (await resolveOpenRouterApiKey(env.DB, env.ENCRYPTION_KEY, env.OPENROUTER_API_KEY)) ?? ''

  try {
    switch (tipo) {
      case 'pesquisar': {
        const article = await getArticleRow(env.DB, articleId)
        const client = article ? await getClientRow(env.DB, article.client_id) : null
        if (!article?.briefing) throw new Error('Briefing ausente')
        if (!client) throw new Error('Cliente não encontrado')

        const perfilValido = validatePerfilCliente(
          client.perfil_marca ? JSON.parse(client.perfil_marca) : null,
        )
        if (!perfilValido.ok) throw new Error(perfilValido.mensagem)

        const briefing = JSON.parse(article.briefing) as Briefing

        // Inventário publicado: base da checagem de canibalização (§46) e do cluster (§6)
        const corpus = await listCorpusForLinking(env.DB, client.id)
        const relevantes = rankRelatedPosts(briefing, corpus, {
          limit: 60,
          boostUrls: briefing.artigos_irmaos ?? [],
        })

        const { pesquisa, pendencias } = await runPesquisador({
          briefing,
          perfil: JSON.parse(client.perfil_marca ?? 'null'),
          inventario: relevantes.map((r) => ({
            titulo: r.post.titulo,
            url: r.post.url,
            categorias: r.post.categorias.join('|'),
            excerpt: (r.post.excerpt ?? '').slice(0, 200),
            publicado_em: '',
          })),
          apiKey: openRouterKey,
          model: env.OPENROUTER_MODEL_PESQUISADOR || env.OPENROUTER_MODEL_EDITOR,
        })

        await patchDossie(env.DB, articleId, {
          skill_version: SKILL_VERSION,
          pesquisa,
          pendencias,
        })

        const conflitos = pesquisa.canibalizacao.filter((c) => c.recomendacao !== 'seguir')
        await setJobResultado(env.DB, jobId, {
          intencao: pesquisa.intencao,
          cluster: pesquisa.cluster,
          canibalizacao: conflitos.length,
          posts_analisados: relevantes.length,
          pendencias: pendencias.length,
        })

        await updateJobStatus(env.DB, jobId, 'ok')
        await enqueueNext(env, articleId, 'redigir')
        break
      }

      case 'redigir': {
        const article = await getArticleRow(env.DB, articleId)
        const client = article ? await getClientRow(env.DB, article.client_id) : null
        if (!article?.briefing) throw new Error('Briefing ausente')
        if (!client) throw new Error('Cliente não encontrado')

        const perfilValido = validatePerfilCliente(
          client.perfil_marca ? JSON.parse(client.perfil_marca) : null,
        )
        if (!perfilValido.ok) throw new Error(perfilValido.mensagem)

        const briefing = JSON.parse(article.briefing) as Briefing
        const dossie = parseDossie(article.dossie)
        const qaAnterior = parseQa(article.qa)
        // Rodada 2: corrige a versão reprovada em vez de recomeçar do zero
        const corrigindo = dossie.rodada > 1 && qaAnterior?.veredito === 'reprovado'

        const { results: urlRows } = await env.DB.prepare(
          'SELECT url, titulo, resumo FROM client_urls WHERE client_id = ? LIMIT 20',
        )
          .bind(client.id)
          .all<{ url: string; titulo: string | null; resumo: string | null }>()

        // Redator conhece os temas vizinhos já publicados (só títulos — URL é papel do Editor)
        const relacionados = rankRelatedPosts(
          briefing,
          await listCorpusForLinking(env.DB, client.id),
          { limit: 6, boostUrls: briefing.artigos_irmaos ?? [] },
        )

        const conteudoMd = await runRedator({
          briefing,
          perfil: JSON.parse(client.perfil_marca ?? 'null'),
          pesquisa: dossie.pesquisa,
          qaAnterior: corrigindo ? qaAnterior : null,
          conteudoAnterior: corrigindo ? article.conteudo_md : null,
          urlsRelevantes: urlRows ?? [],
          artigosIrmaos: relacionados.map((r) =>
            r.post.excerpt ? `${r.post.titulo} — ${r.post.excerpt.slice(0, 160)}` : r.post.titulo,
          ),
          apiKey: openRouterKey,
          model: env.OPENROUTER_MODEL_REDATOR,
        })

        await env.DB.prepare(
          `UPDATE articles SET conteudo_md = ?, status = 'rascunho', updated_at = ? WHERE id = ?`,
        )
          .bind(conteudoMd, new Date().toISOString(), articleId)
          .run()

        await setJobResultado(env.DB, jobId, {
          rodada: dossie.rodada,
          corrigindo,
          correcoes_aplicadas: corrigindo ? (qaAnterior?.correcoes.length ?? 0) : 0,
        })

        await updateJobStatus(env.DB, jobId, 'ok')
        await enqueueNext(env, articleId, 'editar')
        break
      }

      case 'editar': {
        const article = await getArticleRow(env.DB, articleId)
        const client = article ? await getClientRow(env.DB, article.client_id) : null
        if (!article?.conteudo_md || !article.briefing) {
          throw new Error('Artigo ou contexto incompleto para edição')
        }
        if (!client) throw new Error('Cliente não encontrado')

        const perfilValido = validatePerfilCliente(
          client.perfil_marca ? JSON.parse(client.perfil_marca) : null,
        )
        if (!perfilValido.ok) throw new Error(perfilValido.mensagem)

        const briefing = JSON.parse(article.briefing) as Briefing
        const dossieEditor = parseDossie(article.dossie)
        const selfUrl = article.wp_url ?? null

        const { results: urlRows } = await env.DB.prepare(
          'SELECT url, titulo, resumo, tipo FROM client_urls WHERE client_id = ?',
        )
          .bind(client.id)
          .all<{ url: string; titulo: string | null; resumo: string | null; tipo: string }>()
        const inventario = urlRows ?? []

        // 1) Lê todos os títulos do corpus e escolhe os temas mais próximos
        const relacionados = rankRelatedPosts(
          briefing,
          await listCorpusForLinking(env.DB, client.id),
          {
            limit: 8,
            boostUrls: briefing.artigos_irmaos ?? [],
            excludeUrls: selfUrl ? [selfUrl] : [],
          },
        )

        // 2) Lê o conteúdo só desses e extrai o trecho que justifica o link
        const conteudos = await getCorpusConteudos(
          env.DB,
          client.id,
          relacionados.map((r) => r.post.url),
        )
        const linksCandidatos = relacionados.map((r) => ({
          url: r.post.url,
          titulo: r.post.titulo,
          trecho: extractTrecho(conteudos.get(r.post.url) || r.post.excerpt, r.termos, 600),
        }))

        // Inventário grande: manda serviços/institucionais + os mais relevantes, não milhares de URLs
        const clientUrlsPrompt =
          inventario.length <= INVENTARIO_PROMPT_MAX
            ? inventario
            : [
                ...inventario.filter((u) => u.tipo === 'servico' || u.tipo === 'institucional').slice(0, 30),
                ...rankRelatedPosts(
                  briefing,
                  inventario.map((u) => ({
                    titulo: u.titulo ?? '',
                    url: u.url,
                    categorias: [],
                    tags: [],
                    excerpt: u.resumo ?? '',
                  })),
                  { limit: 40, minScore: 1 },
                ).map((r) => ({ url: r.post.url, titulo: r.post.titulo })),
              ]

        const output = await runEditor({
          conteudoMd: article.conteudo_md,
          briefing,
          perfil: JSON.parse(client.perfil_marca ?? 'null'),
          pesquisa: dossieEditor.pesquisa,
          clientUrls: clientUrlsPrompt.map((u) => ({ url: u.url, titulo: u.titulo })),
          linksCandidatos,
          seoPlugin: client.seo_plugin,
          apiKey: openRouterKey,
          model: env.OPENROUTER_MODEL_EDITOR,
        })

        // 3) Trava determinística: nenhum link interno fora de client_urls chega ao WordPress
        const links = enforceInternalLinks(output.conteudo_md ?? '', {
          allowedUrls: inventario.map((u) => u.url),
          dominio: client.dominio,
          selfUrl,
          maxLinks: 8,
        })
        output.conteudo_md = links.markdown
        output.seo = {
          ...output.seo,
          links_internos: reconcileLinksInternos(output.seo?.links_internos ?? [], links.mantidos),
        }

        await setJobResultado(env.DB, jobId, {
          links_candidatos: linksCandidatos.length,
          links_mantidos: links.mantidos.length,
          links_removidos: links.removidos,
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

        // HTML é o que vai ao WordPress: precisa refletir a remoção dos links inválidos
        const conteudoHtml = conteudoMd ? markdownToGutenberg(conteudoMd) : null

        await env.DB.prepare(
          `UPDATE articles SET seo = ?, conteudo_md = COALESCE(?, conteudo_md),
           conteudo_html = COALESCE(?, conteudo_html), updated_at = ? WHERE id = ?`,
        )
          .bind(JSON.stringify(seo), conteudoMd, conteudoHtml, new Date().toISOString(), articleId)
          .run()

        await updateJobStatus(env.DB, jobId, 'ok')

        // Fan-out: imagem e revisão rodam juntas. O Revisor é read-only sobre conteudo_md,
        // então só o job de imagem escreve o markdown — sem lost update.
        // Rodada 2 reaproveita as imagens já geradas: reposiciona em vez de pagar de novo.
        const dossieFanOut = parseDossie(article.dossie)
        await enqueueNext(env, articleId, 'imagem', {
          reaproveitar: dossieFanOut.rodada > 1 && dossieFanOut.imagens_refs.length > 0,
        })
        await enqueueNext(env, articleId, 'revisar', { rodada: dossieFanOut.rodada })
        break
      }

      case 'imagem': {
        const article = await getArticleRow(env.DB, articleId)
        const client = article ? await getClientRow(env.DB, article.client_id) : null
        if (!article?.seo) throw new Error('SEO ausente')
        if (!client) throw new Error('Cliente não encontrado')

        const seo = JSON.parse(article.seo) as SeoJson
        const perfil = normalizePerfilCliente(
          client.perfil_marca ? JSON.parse(client.perfil_marca) : null,
        )
        const briefing = article.briefing ? (JSON.parse(article.briefing) as Briefing) : null
        const tema = briefing?.tema || seo.titulo_seo

        const dossieImagem = parseDossie(article.dossie)
        const payloadImagem =
          (await getJobPayload<{ reaproveitar?: boolean }>(env.DB, jobId)) ?? {}
        // Rodada de correção: o texto mudou, as imagens não. Reposiciona o que já está no R2.
        const reaproveitar =
          payloadImagem.reaproveitar === true && dossieImagem.imagens_refs.length > 0

        const gerar = {
          diretrizVisual: perfil.diretriz_visual,
          provider: (env.IMAGE_PROVIDER || 'workers_ai') as ImageProvider,
          ai: env.AI,
          transformer: env.IMAGE_TRANSFORM,
        }

        let destacadaKey = article.imagem_url
        let destacadaAlt = article.imagem_alt
        let destacadaConvertida = false

        if (!reaproveitar || !destacadaKey) {
          // Destacada: sem ela o post fica sem Open Graph, então a falha interrompe o job
          const destacada = await generateImage({
            ...gerar,
            prompt: seo.imagem?.prompt || tema,
            alt: seo.imagem?.alt || seo.titulo_seo,
            width: 1200,
            height: 630,
          })
          destacadaKey = `articles/${articleId}/featured`
          destacadaAlt = destacada.alt
          destacadaConvertida = destacada.convertido
          await env.IMAGES.put(destacadaKey, destacada.bytes, {
            httpMetadata: { contentType: destacada.contentType },
          })
        }

        // Corpo: remove imagens de uma geração anterior antes de posicionar as novas
        const markdownBase = stripGeneratedImages(article.conteudo_md ?? '')
        const slots = article.conteudo_md
          ? resolveImageSlots(markdownBase, seo.imagens_corpo, { tema }, IMAGENS_CORPO_POR_ARTIGO)
          : []

        const inserir: Array<{ secao: string; src: string; alt: string }> = []
        const refs: ImagemRef[] = []
        const falhas: Array<{ secao: string; erro: string }> = []

        for (const [indice, slot] of slots.entries()) {
          if (reaproveitar) {
            // Os refs mantêm a ordem em que foram gerados; a seção é a do texto novo
            const ref = dossieImagem.imagens_refs[indice]
            if (!ref) continue
            inserir.push({
              secao: slot.secao,
              src: `${R2_IMAGE_SCHEME}${ref.r2_key}`,
              alt: slot.alt || ref.alt,
            })
            refs.push({ secao: slot.secao, r2_key: ref.r2_key, alt: slot.alt || ref.alt })
            continue
          }

          try {
            const imagem = await generateImage({
              ...gerar,
              prompt: slot.prompt,
              alt: slot.alt,
              width: 1200,
              height: 675,
            })
            const key = `articles/${articleId}/corpo-${indice + 1}`
            await env.IMAGES.put(key, imagem.bytes, { httpMetadata: { contentType: imagem.contentType } })
            inserir.push({ secao: slot.secao, src: `${R2_IMAGE_SCHEME}${key}`, alt: imagem.alt })
            refs.push({ secao: slot.secao, r2_key: key, alt: imagem.alt })
          } catch (err) {
            // Imagem de apoio é complementar: registra e segue com o artigo
            falhas.push({ secao: slot.secao, erro: err instanceof Error ? err.message : String(err) })
          }
        }

        const { markdown } = insertImagesIntoMarkdown(markdownBase, inserir)
        const temConteudo = Boolean(article.conteudo_md)

        await env.DB.prepare(
          `UPDATE articles SET imagem_url = ?, imagem_alt = ?,
           conteudo_md = COALESCE(?, conteudo_md), conteudo_html = COALESCE(?, conteudo_html),
           updated_at = ? WHERE id = ?`,
        )
          .bind(
            destacadaKey,
            destacadaAlt,
            temConteudo ? markdown : null,
            temConteudo ? markdownToGutenberg(markdown) : null,
            new Date().toISOString(),
            articleId,
          )
          .run()

        // Refs no dossiê: é o que permite reposicionar sem gerar de novo na rodada 2
        await patchDossie(env.DB, articleId, { imagens_refs: refs })

        await updateJobStatus(env.DB, jobId, 'ok')

        const acaoImagem = await aplicarVeredito(env, articleId, 'imagem')
        await setJobResultado(env.DB, jobId, {
          reaproveitou: reaproveitar,
          destacada_webp: destacadaConvertida,
          imagens_corpo: inserir.length,
          falhas,
          juncao: acaoImagem,
        })
        break
      }

      case 'revisar': {
        const article = await getArticleRow(env.DB, articleId)
        const client = article ? await getClientRow(env.DB, article.client_id) : null
        if (!article?.conteudo_md || !article.briefing) {
          throw new Error('Artigo incompleto para revisão')
        }
        if (!client) throw new Error('Cliente não encontrado')

        const dossieRevisor = parseDossie(article.dossie)
        const payloadRevisor = (await getJobPayload<{ rodada?: number }>(env.DB, jobId)) ?? {}
        const rodada = payloadRevisor.rodada ?? dossieRevisor.rodada

        const qa = await runRevisor({
          conteudoMd: article.conteudo_md,
          briefing: JSON.parse(article.briefing) as Briefing,
          perfil: JSON.parse(client.perfil_marca ?? 'null'),
          seo: article.seo ? (JSON.parse(article.seo) as SeoJson) : null,
          pesquisa: dossieRevisor.pesquisa,
          rodada,
          apiKey: openRouterKey,
          model: env.OPENROUTER_MODEL_REVISOR || env.OPENROUTER_MODEL_EDITOR,
        })

        // Revisor é read-only sobre conteudo_md: grava só a coluna qa
        await env.DB.prepare('UPDATE articles SET qa = ?, updated_at = ? WHERE id = ?')
          .bind(JSON.stringify(qa), new Date().toISOString(), articleId)
          .run()

        await updateJobStatus(env.DB, jobId, 'ok')

        const acaoRevisor = await aplicarVeredito(env, articleId, 'revisar')
        await setJobResultado(env.DB, jobId, {
          veredito: qa.veredito,
          rodada: qa.rodada,
          reprovadas: qa.reprovadas,
          correcoes: qa.correcoes.length,
          fatos_sem_fonte: qa.fatos_sem_fonte.length,
          resumo: resumoQa(qa),
          juncao: acaoRevisor,
        })
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
        const publishRaw = jobRow?.payload
          ? (JSON.parse(jobRow.payload) as PublishArticleInput)
          : null
        if (!publishRaw) throw new Error('Payload de publicação ausente')

        const publish: PublishArticleInput = {
          ...publishRaw,
          wp_post_type:
            publishRaw.wp_post_type ??
            (article.wp_post_type === 'page' ? 'page' : 'post'),
          categoria_ids:
            publishRaw.categoria_ids.length > 0
              ? publishRaw.categoria_ids
              : client.categoria_padrao_id
                ? [client.categoria_padrao_id]
                : [],
          autor_id: publishRaw.autor_id ?? client.autor_padrao_id ?? undefined,
        }

        if (!client.wp_app_password_enc) throw new Error('Credenciais WP ausentes')
        const password = await decryptSecret(client.wp_app_password_enc, env.ENCRYPTION_KEY)

        const creds = {
          wpApiUrl: client.wp_api_url,
          wpUser: client.wp_user,
          wpAppPassword: password,
        }

        let imageBytes: Uint8Array | undefined
        let imageContentType: string | undefined
        if (article.imagem_url) {
          const obj = await env.IMAGES.get(article.imagem_url)
          if (obj) {
            imageBytes = new Uint8Array(await obj.arrayBuffer())
            imageContentType = obj.httpMetadata?.contentType
          }
        }

        const seo = JSON.parse(article.seo)
        const schema = article.schema_jsonld ? JSON.parse(article.schema_jsonld) : undefined

        // Imagens do corpo: R2 → biblioteca de mídia do WP → bloco wp:image com o id da mídia
        let contentHtml = article.conteudo_html
        const refs = extractR2ImageRefs(article.conteudo_md ?? '')
        if (article.conteudo_md && refs.length > 0) {
          const midias = new Map<string, UploadedMedia>()
          for (const [indice, ref] of refs.entries()) {
            const obj = await env.IMAGES.get(ref.key)
            if (!obj) continue
            const media = await uploadWpMedia(
              creds,
              new Uint8Array(await obj.arrayBuffer()),
              obj.httpMetadata?.contentType ?? 'image/webp',
              `${seo.slug}-${indice + 1}`,
              ref.alt,
            )
            midias.set(ref.src, media)
          }
          contentHtml = markdownToGutenberg(article.conteudo_md, {
            resolveImage: (src) => midias.get(src) ?? null,
          })
        }

        const result = await publishToWordPress({
          creds,
          seoPlugin: client.seo_plugin,
          title: seo.titulo_seo,
          slug: seo.slug,
          contentHtml,
          seo,
          schemaJsonld: schema,
          imageBytes,
          imageAlt: article.imagem_alt ?? undefined,
          imageContentType,
          publish,
          timezone: client.timezone,
        })

        const articleStatus = result.scheduled ? 'agendado' : 'publicado'
        const agendadoPara = result.scheduled
          ? publish.agendado_para
          : new Date().toISOString()

        await env.DB.prepare(
          `UPDATE articles SET wp_post_id = ?, wp_url = ?, status = ?,
           agendado_para = ?, publicado_em = ?, updated_at = ? WHERE id = ?`,
        )
          .bind(
            result.wp_post_id,
            result.wp_url,
            articleStatus,
            agendadoPara,
            result.scheduled ? null : new Date().toISOString(),
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

      case 'sincronizar_corpus': {
        if (!clientIdMsg) throw new Error('Job de corpus sem client_id')
        const { creds } = await wpCreds(env, clientIdMsg)

        const payload = (await getJobPayload<SyncCorpusInput>(env.DB, jobId)) ?? {}
        const tipos: WpPostType[] = payload.tipos?.length ? payload.tipos : ['post']

        const resultado: SyncCorpusResult = {
          total_lidos: 0,
          inseridos: 0,
          atualizados: 0,
          blocos_lidos: 0,
          continua: false,
          tipos,
        }

        // Orçamento compartilhado entre os tipos: o consumer tem teto de tempo de parede
        const inicioSync = Date.now()
        const tiposPendentes: WpPostType[] = []

        for (const postType of tipos) {
          if (Date.now() - inicioSync >= SYNC_ORCAMENTO_MS) {
            tiposPendentes.push(postType)
            continue
          }

          // Continuação retoma pelo que já está no banco; `completo` só vale na 1ª chamada
          const modifiedAfter =
            payload.completo && !payload.continuacao
              ? null
              : await getUltimoModified(env.DB, clientIdMsg, postType)

          const leitura = await fetchPublishedPosts({
            creds,
            postType,
            modifiedAfter,
            orcamentoMs: SYNC_ORCAMENTO_MS - (Date.now() - inicioSync),
            // Grava bloco a bloco: falha no bloco 40 preserva os 39 anteriores
            onBloco: async ({ posts }: CorpusBloco) => {
              const { inseridos, atualizados } = await upsertCorpusPosts(
                env.DB,
                clientIdMsg,
                posts,
              )
              // PRD: links internos só de client_urls — o corpus precisa estar no inventário
              await mirrorCorpusToClientUrls(env.DB, clientIdMsg, posts)

              resultado.inseridos += inseridos
              resultado.atualizados += atualizados
            },
          })

          resultado.total_lidos += leitura.total_lidos
          resultado.blocos_lidos += leitura.blocos_lidos

          if (leitura.incompleto) tiposPendentes.push(postType)
        }

        // O que não coube vira um job novo, que retoma pelo MAX(wp_modified) já gravado
        if (tiposPendentes.length > 0) {
          resultado.continua = true
          const continuacaoId = await enqueueClientJob(env, clientIdMsg, 'sincronizar_corpus', {
            tipos: tiposPendentes,
            continuacao: true,
          })
          await setJobResultado(env.DB, jobId, {
            ...(resultado as unknown as Record<string, unknown>),
            continuacao_job_id: continuacaoId,
          })
        } else {
          await setJobResultado(env.DB, jobId, resultado as unknown as Record<string, unknown>)
        }

        await updateJobStatus(env.DB, jobId, 'ok')
        break
      }

      case 'sugerir_pautas': {
        if (!clientIdMsg) throw new Error('Job de pautas sem client_id')
        const client = await getClientRow(env.DB, clientIdMsg)
        if (!client) throw new Error('Cliente não encontrado')

        const corpus = await listCorpusForPrompt(env.DB, clientIdMsg)
        if (corpus.length === 0) {
          throw new Error('Base de conhecimento vazia — sincronize os artigos publicados antes')
        }

        const payload = (await getJobPayload<SuggestPautasInput>(env.DB, jobId)) ?? {}

        const categorias = [
          ...new Set(corpus.flatMap((item) => item.categorias).filter(Boolean)),
        ]

        const resultado = await runPauteiro({
          corpus,
          perfil: client.perfil_marca ? JSON.parse(client.perfil_marca) : null,
          categorias,
          pautasExistentes: await listTemasJaSugeridos(env.DB, clientIdMsg),
          quantidade: payload.quantidade,
          foco: payload.foco,
          apiKey: openRouterKey,
          model: env.OPENROUTER_MODEL_PAUTEIRO || env.OPENROUTER_MODEL_EDITOR,
        })

        if (resultado.pautas.length === 0) {
          throw new Error('O modelo não devolveu nenhuma pauta válida')
        }

        await saveIdeas(env.DB, clientIdMsg, resultado.pautas)
        await setJobResultado(env.DB, jobId, {
          pautas_geradas: resultado.pautas.length,
          posts_considerados: resultado.posts_considerados,
          corpus_truncado: resultado.corpus_truncado,
        })
        await updateJobStatus(env.DB, jobId, 'ok')
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

    // Jobs de escopo cliente (corpus/pautas) não têm artigo para marcar como erro
    if (articleId) {
      await env.DB.prepare(
        `UPDATE articles SET status = 'erro', erro_msg = ?, updated_at = ? WHERE id = ?`,
      )
        .bind(message, new Date().toISOString(), articleId)
        .run()
    }
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
