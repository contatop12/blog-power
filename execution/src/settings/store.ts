import { decryptSecret, encryptSecret } from '../crypto/encrypt.js'
import { PLAIN_SETTING_KEYS, SECRET_SETTING_KEYS, SETTING_DEFAULTS } from './keys.js'
import type { SettingKey } from '@publisher-p12/types'
import type { D1Database } from '../types/d1.js'

export async function getSetting(
  db: D1Database,
  key: SettingKey,
  encryptionKey: string,
): Promise<string | null> {
  if (PLAIN_SETTING_KEYS.has(key)) {
    const row = await db
      .prepare('SELECT value FROM app_settings WHERE key = ?')
      .bind(key)
      .first<{ value: string }>()
    return row?.value ?? SETTING_DEFAULTS[key] ?? null
  }

  if (SECRET_SETTING_KEYS.has(key)) {
    const row = await db
      .prepare('SELECT value_enc FROM encrypted_settings WHERE key = ?')
      .bind(key)
      .first<{ value_enc: string }>()
    if (!row?.value_enc) return null
    return decryptSecret(row.value_enc, encryptionKey)
  }

  return null
}

export async function setSetting(
  db: D1Database,
  key: SettingKey,
  value: string,
  encryptionKey: string,
): Promise<void> {
  const ts = new Date().toISOString()

  if (PLAIN_SETTING_KEYS.has(key)) {
    await db
      .prepare(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .bind(key, value, ts)
      .run()
    return
  }

  if (SECRET_SETTING_KEYS.has(key)) {
    const enc = await encryptSecret(value, encryptionKey)
    await db
      .prepare(
        `INSERT INTO encrypted_settings (key, value_enc, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_enc = excluded.value_enc, updated_at = excluded.updated_at`,
      )
      .bind(key, enc, ts)
      .run()
  }
}

export async function resolveOpenRouterApiKey(
  db: D1Database,
  encryptionKey: string,
  envFallback?: string,
): Promise<string | null> {
  const fromDb = await getSetting(db, 'openrouter_api_key', encryptionKey)
  return fromDb ?? envFallback ?? null
}

export interface EvolutionConfig {
  apiUrl: string
  apiKey: string
  instance: string
  groupId: string
}

export async function resolveEvolutionConfig(
  db: D1Database,
  encryptionKey: string,
): Promise<EvolutionConfig | null> {
  const [apiUrl, apiKey, instance, groupId] = await Promise.all([
    getSetting(db, 'evolution_api_url', encryptionKey),
    getSetting(db, 'evolution_api_key', encryptionKey),
    getSetting(db, 'evolution_instance', encryptionKey),
    getSetting(db, 'evolution_group_id', encryptionKey),
  ])
  if (!apiUrl || !apiKey || !instance || !groupId) return null
  return { apiUrl, apiKey, instance, groupId }
}
