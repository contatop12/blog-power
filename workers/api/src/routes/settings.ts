import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
import {
  applyD1Bootstrap,
  createCloudflareD1Database,
  getD1SetupStatus,
  getSetting,
  listCloudflareD1Databases,
  resolveEvolutionConfig,
  resolveOpenRouterApiKey,
  testEvolutionConnection,
  verifyCloudflareToken,
} from '@publisher-p12/execution'
import { getSettingsView, updateSettings } from '../lib/settingsView.js'
import type { SettingKey } from '@publisher-p12/types'

const settings = new Hono<{ Bindings: ApiBindings }>()

settings.get('/', async (c) => {
  const view = await getSettingsView(c.env.DB, c.env.ENCRYPTION_KEY)
  return c.json(view)
})

settings.patch('/', async (c) => {
  const body = await c.req.json<{ settings?: Partial<Record<SettingKey, string>> }>()
  if (!body.settings) return c.json({ error: 'Campo settings obrigatório' }, 400)
  await updateSettings(c.env.DB, c.env.ENCRYPTION_KEY, body.settings)
  const view = await getSettingsView(c.env.DB, c.env.ENCRYPTION_KEY)
  return c.json(view)
})

settings.post('/test/openrouter', async (c) => {
  const key =
    (await resolveOpenRouterApiKey(c.env.DB, c.env.ENCRYPTION_KEY, c.env.OPENROUTER_API_KEY)) ?? ''
  if (!key) return c.json({ ok: false, erro: 'API key não configurada' }, 400)

  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  })
  return c.json({ ok: res.ok, status: res.status })
})

settings.post('/test/evolution', async (c) => {
  const config = await resolveEvolutionConfig(c.env.DB, c.env.ENCRYPTION_KEY)
  if (!config) return c.json({ ok: false, erro: 'Evolution incompleto' }, 400)
  try {
    const ok = await testEvolutionConnection(config)
    return c.json({ ok })
  } catch (err) {
    return c.json({
      ok: false,
      erro: err instanceof Error ? err.message : 'Falha na conexão',
    })
  }
})

settings.post('/test/cloudflare', async (c) => {
  const accountId = await getSetting(c.env.DB, 'cloudflare_account_id', c.env.ENCRYPTION_KEY)
  const token = await getSetting(c.env.DB, 'cloudflare_api_token', c.env.ENCRYPTION_KEY)
  if (!accountId || !token) {
    return c.json({ ok: false, erro: 'Credenciais Cloudflare incompletas' }, 400)
  }
  const ok = await verifyCloudflareToken(token)
  return c.json({ ok, account_id: accountId })
})

settings.get('/d1/status', async (c) => {
  const status = await getD1SetupStatus(c.env.DB)
  return c.json(status)
})

settings.post('/d1/apply', async (c) => {
  const before = await getD1SetupStatus(c.env.DB)
  const result = await applyD1Bootstrap(c.env.DB)
  const after = await getD1SetupStatus(c.env.DB)
  return c.json({
    ok: after.ready,
    applied: result.applied,
    before_missing: before.tables_missing,
    after_missing: after.tables_missing,
  })
})

settings.get('/cloudflare/d1', async (c) => {
  const accountId = await getSetting(c.env.DB, 'cloudflare_account_id', c.env.ENCRYPTION_KEY)
  const token = await getSetting(c.env.DB, 'cloudflare_api_token', c.env.ENCRYPTION_KEY)
  if (!accountId || !token) {
    return c.json({ error: 'Credenciais Cloudflare incompletas' }, 400)
  }
  try {
    const databases = await listCloudflareD1Databases(accountId, token)
    return c.json({ databases })
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : 'Falha ao listar bancos D1',
    }, 502)
  }
})

settings.post('/cloudflare/d1/create', async (c) => {
  const accountId = await getSetting(c.env.DB, 'cloudflare_account_id', c.env.ENCRYPTION_KEY)
  const token = await getSetting(c.env.DB, 'cloudflare_api_token', c.env.ENCRYPTION_KEY)
  if (!accountId || !token) {
    return c.json({ error: 'Credenciais Cloudflare incompletas' }, 400)
  }
  const body = await c.req.json<{ name?: string }>()
  const name = body.name?.trim() || 'publisher-db'
  try {
    const created = await createCloudflareD1Database(accountId, token, name)
    return c.json({
      ok: true,
      database: created,
      instrucao: `Atualize database_id em wrangler.jsonc: ${created.uuid}`,
    })
  } catch (err) {
    return c.json({
      error: err instanceof Error ? err.message : 'Falha ao criar banco D1',
    }, 502)
  }
})

export default settings
