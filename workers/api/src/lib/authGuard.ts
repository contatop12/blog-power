import type { Context } from 'hono'
import type { ApiBindings } from '../bindings.js'
import {
  checkRateLimit,
  getClientIp,
  hashClientIp,
  recordAuthAttempt,
  secureCompare,
} from '@publisher-p12/execution'

export type AuthResult =
  | { ok: true }
  | {
      ok: false
      status: 401 | 429
      body: Record<string, unknown>
    }

export async function authenticateRequest(c: Context<{ Bindings: ApiBindings }>): Promise<AuthResult> {
  const ip = getClientIp(c.req.raw)
  const ipHash = await hashClientIp(ip, c.env.ENCRYPTION_KEY)
  const limit = await checkRateLimit(c.env.DB, ipHash)

  if (!limit.allowed) {
    return {
      ok: false,
      status: 429,
      body: {
        error: 'Muitas tentativas. Acesso bloqueado temporariamente.',
        bloqueado_ate: limit.lockedUntil,
        tentativas_restantes: 0,
      },
    }
  }

  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Basic ')) {
    await recordAuthAttempt(c.env.DB, ipHash, false)
    return {
      ok: false,
      status: 401,
      body: { error: 'Não autorizado', tentativas_restantes: Math.max(0, limit.remaining - 1) },
    }
  }

  let decoded: string
  try {
    decoded = atob(authHeader.slice(6))
  } catch {
    await recordAuthAttempt(c.env.DB, ipHash, false)
    return { ok: false, status: 401, body: { error: 'Não autorizado' } }
  }

  const colonIndex = decoded.indexOf(':')
  if (colonIndex < 0) {
    await recordAuthAttempt(c.env.DB, ipHash, false)
    return { ok: false, status: 401, body: { error: 'Não autorizado' } }
  }

  const user = decoded.slice(0, colonIndex)
  const pass = decoded.slice(colonIndex + 1)
  const valid =
    secureCompare(user, c.env.DASHBOARD_USER) && secureCompare(pass, c.env.DASHBOARD_PASS)

  await recordAuthAttempt(c.env.DB, ipHash, valid)

  if (!valid) {
    const after = await checkRateLimit(c.env.DB, ipHash)
    return {
      ok: false,
      status: 401,
      body: {
        error: 'Não autorizado',
        tentativas_restantes: after.remaining,
        bloqueado_ate: after.lockedUntil,
      },
    }
  }

  return { ok: true }
}
