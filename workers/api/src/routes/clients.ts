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
import { decryptSecret, fetchSitemap, testWordPressConnection, urlToSlug } from '@publisher-p12/execution'

const clients = new Hono<{ Bindings: ApiBindings }>()

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

clients.delete('/:id', async (c) => {
  const ok = await deleteClient(c.env.DB, c.req.param('id'))
  if (!ok) return c.json({ error: 'Cliente não encontrado' }, 404)
  return c.json({ ok: true })
})

clients.post('/:id/test-connection', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const passwordEnc = await getClientPasswordEnc(c.env.DB, clientId)
  if (!passwordEnc) {
    return c.json({ error: 'Application Password não configurada' }, 400)
  }

  const password = await decryptSecret(passwordEnc, c.env.ENCRYPTION_KEY)
  const result = await testWordPressConnection({
    wpApiUrl: client.wp_api_url,
    wpUser: client.wp_user,
    wpAppPassword: password,
  })

  await setClientConnectionStatus(c.env.DB, clientId, result.ok ? 'ok' : 'erro')
  return c.json(result)
})

clients.post('/:id/sync-sitemap', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const { urls, count } = await fetchSitemap(client.dominio)
  const mapped = urls.map((u) => ({
    url: u.loc,
    slug: urlToSlug(u.loc) ?? undefined,
  }))
  await upsertClientUrls(c.env.DB, clientId, mapped)
  return c.json({ count, synced: mapped.length })
})

export default clients
