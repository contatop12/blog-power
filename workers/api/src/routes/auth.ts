import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
import {
  checkRateLimit,
  getClientIp,
  hashClientIp,
  recordAuthAttempt,
  secureCompare,
} from '@publisher-p12/execution'

const auth = new Hono<{ Bindings: ApiBindings }>()

auth.post('/login', async (c) => {
  const ip = getClientIp(c.req.raw)
  const ipHash = await hashClientIp(ip, c.env.ENCRYPTION_KEY)
  const limit = await checkRateLimit(c.env.DB, ipHash)

  if (!limit.allowed) {
    return c.json(
      {
        ok: false,
        erro: 'Muitas tentativas. Acesso bloqueado temporariamente.',
        bloqueado_ate: limit.lockedUntil,
        tentativas_restantes: 0,
      },
      429,
    )
  }

  const body = await c.req.json<{ user?: string; pass?: string }>()
  const user = body.user ?? ''
  const pass = body.pass ?? ''

  const validUser = secureCompare(user, c.env.DASHBOARD_USER)
  const validPass = secureCompare(pass, c.env.DASHBOARD_PASS)
  const ok = validUser && validPass

  await recordAuthAttempt(c.env.DB, ipHash, ok)

  if (!ok) {
    const after = await checkRateLimit(c.env.DB, ipHash)
    return c.json(
      {
        ok: false,
        erro: 'Usuário ou senha inválidos.',
        tentativas_restantes: after.remaining,
      },
      401,
    )
  }

  const token = btoa(`${user}:${pass}`)
  return c.json({ ok: true, token, tentativas_restantes: limit.remaining })
})

export default auth
