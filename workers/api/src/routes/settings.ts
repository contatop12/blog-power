import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
import { applyD1Bootstrap, getD1SetupStatus } from '@publisher-p12/execution'

/**
 * Rotas operacionais de D1 apenas.
 * Credenciais (OpenRouter, Evolution, Cloudflare, dashboard) NÃO são expostas
 * nem editáveis via API — somente Worker secrets / .env.
 */
const settings = new Hono<{ Bindings: ApiBindings }>()

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

export default settings
