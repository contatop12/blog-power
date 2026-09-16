import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
import {
  createClient,
  deleteClient,
  getClient,
  getClientPasswordEnc,
  listClients,
  setClientConnectionStatus,
  updateClient,
  upsertClientUrls,
} from '../lib/db.js'
import {
  calcularCompletude,
  createWpCategory,
  decryptSecret,
  deleteWpCategory,
  deriveConnectionStatus,
  fetchSitemap,
  listWpAuthors,
  listWpCategories,
  listWpTags,
  normalizePerfilCliente,
  testWordPressConnection,
  updateWpCategory,
  urlToSlug,
} from '@publisher-p12/execution'
import type {
  CreateWpCategoryInput,
  PerfilClienteView,
  UpdateWpCategoryInput,
} from '@publisher-p12/types'

const clients = new Hono<{ Bindings: ApiBindings }>()

async function wpCredsForClient(c: { env: ApiBindings }, clientId: string) {
  const client = await getClient(c.env.DB, clientId)
  if (!client) return { error: 'Cliente não encontrado' as const, status: 404 as const }

  const passwordEnc = await getClientPasswordEnc(c.env.DB, clientId)
  if (!passwordEnc) {
    return { error: 'Application Password não configurada' as const, status: 400 as const }
  }

  const password = await decryptSecret(passwordEnc, c.env.ENCRYPTION_KEY)
  return {
    client,
    creds: {
      wpApiUrl: client.wp_api_url,
      wpUser: client.wp_user,
      wpAppPassword: password,
    },
  }
}

clients.get('/', async (c) => {
  const data = await listClients(c.env.DB)
  return c.json(data)
})

clients.post('/', async (c) => {
  const body = await c.req.json()
  const client = await createClient(c.env.DB, body, c.env.ENCRYPTION_KEY)
  return c.json(client, 201)
})

clients.get('/:id', async (c) => {
  const client = await getClient(c.env.DB, c.req.param('id'))
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)
  return c.json(client)
})

clients.patch('/:id', async (c) => {
  const body = await c.req.json()
  const client = await updateClient(c.env.DB, c.req.param('id'), body, c.env.ENCRYPTION_KEY)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)
  return c.json(client)
})

clients.get('/:id/perfil', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const perfil = normalizePerfilCliente(client.perfil_marca)
  const view: PerfilClienteView = {
    client_id: clientId,
    perfil,
    completude: calcularCompletude(perfil),
  }
  return c.json(view)
})

clients.put('/:id/perfil', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  // Salvamento parcial é permitido: a completude diz o que ainda falta para o pipeline rodar
  const perfil = normalizePerfilCliente(await c.req.json())
  const atualizado = await updateClient(
    c.env.DB,
    clientId,
    { perfil_marca: perfil },
    c.env.ENCRYPTION_KEY,
  )
  if (!atualizado) return c.json({ error: 'Cliente não encontrado' }, 404)

  const view: PerfilClienteView = {
    client_id: clientId,
    perfil,
    completude: calcularCompletude(perfil),
  }
  return c.json(view)
})

clients.delete('/:id', async (c) => {
  const ok = await deleteClient(c.env.DB, c.req.param('id'))
  if (!ok) return c.json({ error: 'Cliente não encontrado' }, 404)
  return c.json({ ok: true })
})

clients.post('/:id/test-connection', async (c) => {
  const clientId = c.req.param('id')
  const auth = await wpCredsForClient(c, clientId)
  if ('error' in auth) return c.json({ error: auth.error }, auth.status)

  const result = await testWordPressConnection(auth.creds)
  const status = result.status_conexao ?? deriveConnectionStatus(result)
  await setClientConnectionStatus(c.env.DB, clientId, status)
  return c.json({ ...result, status_conexao: status })
})

clients.get('/:id/wp/categories', async (c) => {
  const auth = await wpCredsForClient(c, c.req.param('id'))
  if ('error' in auth) return c.json({ error: auth.error }, auth.status)
  try {
    const categories = await listWpCategories(auth.creds)
    return c.json(categories)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Falha ao listar categorias' }, 502)
  }
})

clients.post('/:id/wp/categories', async (c) => {
  const auth = await wpCredsForClient(c, c.req.param('id'))
  if ('error' in auth) return c.json({ error: auth.error }, auth.status)
  const body = (await c.req.json()) as CreateWpCategoryInput
  if (!body.name?.trim()) return c.json({ error: 'Nome da categoria é obrigatório' }, 400)
  try {
    const category = await createWpCategory(auth.creds, body)
    return c.json(category, 201)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Falha ao criar categoria' }, 502)
  }
})

clients.patch('/:id/wp/categories/:categoryId', async (c) => {
  const auth = await wpCredsForClient(c, c.req.param('id'))
  if ('error' in auth) return c.json({ error: auth.error }, auth.status)
  const categoryId = Number(c.req.param('categoryId'))
  if (!Number.isFinite(categoryId)) return c.json({ error: 'ID inválido' }, 400)
  const body = (await c.req.json()) as UpdateWpCategoryInput
  try {
    const category = await updateWpCategory(auth.creds, categoryId, body)
    return c.json(category)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Falha ao atualizar categoria' }, 502)
  }
})

clients.delete('/:id/wp/categories/:categoryId', async (c) => {
  const auth = await wpCredsForClient(c, c.req.param('id'))
  if ('error' in auth) return c.json({ error: auth.error }, auth.status)
  const categoryId = Number(c.req.param('categoryId'))
  if (!Number.isFinite(categoryId)) return c.json({ error: 'ID inválido' }, 400)
  try {
    await deleteWpCategory(auth.creds, categoryId)
    return c.json({ ok: true })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Falha ao excluir categoria' }, 502)
  }
})

clients.get('/:id/wp/tags', async (c) => {
  const auth = await wpCredsForClient(c, c.req.param('id'))
  if ('error' in auth) return c.json({ error: auth.error }, auth.status)
  try {
    const tags = await listWpTags(auth.creds)
    return c.json(tags)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Falha ao listar tags' }, 502)
  }
})

clients.get('/:id/wp/authors', async (c) => {
  const auth = await wpCredsForClient(c, c.req.param('id'))
  if ('error' in auth) return c.json({ error: auth.error }, auth.status)
  try {
    const authors = await listWpAuthors(auth.creds)
    return c.json(authors)
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'Falha ao listar autores' }, 502)
  }
})

clients.post('/:id/sync-sitemap', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  try {
    const started = Date.now()
    const { urls, count, sitemaps_fetched } = await fetchSitemap(client.dominio)
    const mapped = urls.map((u) => ({
      url: u.loc,
      slug: urlToSlug(u.loc) ?? undefined,
    }))
    const synced = await upsertClientUrls(c.env.DB, clientId, mapped)
    return c.json({
      count,
      synced,
      sitemaps_fetched,
      duration_ms: Date.now() - started,
    })
  } catch (e) {
    return c.json(
      { error: e instanceof Error ? e.message : 'Falha ao sincronizar sitemap' },
      502,
    )
  }
})

export default clients
