import type { D1Database } from '../types/d1.js'

const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15
const LOCKOUT_MINUTES = 30

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  lockedUntil: string | null
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function hashClientIp(ip: string, pepper: string): Promise<string> {
  return sha256Hex(`${pepper}:${ip}`)
}

export async function checkRateLimit(
  db: D1Database,
  ipHash: string,
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()

  const row = await db
    .prepare(
      `SELECT COUNT(*) as failures FROM auth_attempts
       WHERE ip_hash = ? AND success = 0 AND created_at >= ?`,
    )
    .bind(ipHash, windowStart)
    .first<{ failures: number }>()

  const failures = row?.failures ?? 0

  if (failures >= MAX_ATTEMPTS) {
    const lastFail = await db
      .prepare(
        `SELECT created_at FROM auth_attempts
         WHERE ip_hash = ? AND success = 0 ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(ipHash)
      .first<{ created_at: string }>()

    const lockedUntil = lastFail
      ? new Date(new Date(lastFail.created_at).getTime() + LOCKOUT_MINUTES * 60_000).toISOString()
      : null

    if (lockedUntil && new Date(lockedUntil) > new Date()) {
      return { allowed: false, remaining: 0, lockedUntil }
    }
  }

  return {
    allowed: failures < MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - failures),
    lockedUntil: null,
  }
}

export async function recordAuthAttempt(
  db: D1Database,
  ipHash: string,
  success: boolean,
): Promise<void> {
  await db
    .prepare('INSERT INTO auth_attempts (id, ip_hash, success) VALUES (?, ?, ?)')
    .bind(crypto.randomUUID(), ipHash, success ? 1 : 0)
    .run()

  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
  await db.prepare('DELETE FROM auth_attempts WHERE created_at < ?').bind(cutoff).run()
}

export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  )
}
