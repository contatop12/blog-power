import type { D1Database } from '../types/d1.js'
import { D1_BOOTSTRAP_STATEMENTS, REQUIRED_TABLES } from './migrations.js'

export interface D1SetupStatus {
  ready: boolean
  tables_found: string[]
  tables_missing: string[]
  migrations_total: number
}

export async function getD1SetupStatus(db: D1Database): Promise<D1SetupStatus> {
  const row = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'`,
    )
    .all<{ name: string }>()

  const found = (row.results ?? []).map((r) => r.name)
  const missing = REQUIRED_TABLES.filter((t) => !found.includes(t))

  return {
    ready: missing.length === 0,
    tables_found: found,
    tables_missing: [...missing],
    migrations_total: D1_BOOTSTRAP_STATEMENTS.length,
  }
}

export async function applyD1Bootstrap(db: D1Database): Promise<{ applied: number }> {
  let applied = 0
  for (const sql of D1_BOOTSTRAP_STATEMENTS) {
    await db.prepare(sql).run()
    applied++
  }
  return { applied }
}

export interface CfD1Database {
  uuid: string
  name: string
  created_at: string
}

export async function listCloudflareD1Databases(
  accountId: string,
  apiToken: string,
): Promise<CfD1Database[]> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Cloudflare D1 list ${res.status}: ${err}`)
  }
  const data = (await res.json()) as { result?: CfD1Database[] }
  return data.result ?? []
}

export async function createCloudflareD1Database(
  accountId: string,
  apiToken: string,
  name: string,
): Promise<CfD1Database> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Cloudflare D1 create ${res.status}: ${err}`)
  }
  const data = (await res.json()) as { result?: CfD1Database }
  if (!data.result) throw new Error('Resposta inválida ao criar banco D1')
  return data.result
}

export async function verifyCloudflareToken(apiToken: string): Promise<boolean> {
  const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) return false
  const data = (await res.json()) as { success?: boolean }
  return Boolean(data.success)
}

export function parseAllowedOrigins(raw: string | undefined, environment: string): string[] {
  const fromEnv = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (fromEnv.length > 0) return fromEnv

  if (environment === 'development') {
    return ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8787']
  }

  return []
}

export function isOriginAllowed(origin: string | undefined, allowed: string[], environment: string): boolean {
  if (environment === 'development') return true
  if (!origin) return false
  return allowed.includes(origin)
}
