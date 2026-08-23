import type { SettingKey, SettingsGroupView, SettingValueView } from '@publisher-p12/types'
import { getSetting, setSetting } from '@publisher-p12/execution'
import { maskSecret, PLAIN_SETTING_KEYS, SECRET_SETTING_KEYS, SETTING_DEFAULTS } from '@publisher-p12/execution'

const ALL_KEYS: SettingKey[] = [
  'openrouter_api_key',
  'openrouter_model_redator',
  'openrouter_model_editor',
  'openrouter_model_imagem',
  'evolution_api_url',
  'evolution_api_key',
  'evolution_instance',
  'evolution_group_id',
  'cloudflare_account_id',
  'cloudflare_api_token',
  'image_provider',
]

const GROUP_MAP: Record<SettingKey, keyof SettingsGroupView> = {
  openrouter_api_key: 'openrouter',
  openrouter_model_redator: 'openrouter',
  openrouter_model_editor: 'openrouter',
  openrouter_model_imagem: 'openrouter',
  evolution_api_url: 'evolution',
  evolution_api_key: 'evolution',
  evolution_instance: 'evolution',
  evolution_group_id: 'evolution',
  cloudflare_account_id: 'cloudflare',
  cloudflare_api_token: 'cloudflare',
  image_provider: 'geral',
}

export async function getSettingsView(
  db: D1Database,
  encryptionKey: string,
): Promise<SettingsGroupView> {
  const view: SettingsGroupView = {
    openrouter: [],
    evolution: [],
    cloudflare: [],
    geral: [],
  }

  for (const key of ALL_KEYS) {
    const value = await getSetting(db, key, encryptionKey)
    const configurado = Boolean(value && value.length > 0)
    const item: SettingValueView = {
      key,
      configurado,
      valor_mascarado: configurado && SECRET_SETTING_KEYS.has(key) ? maskSecret(value!) : undefined,
      valor: configurado && PLAIN_SETTING_KEYS.has(key) ? value! : undefined,
    }
    if (!configurado && SETTING_DEFAULTS[key]) {
      item.valor = SETTING_DEFAULTS[key]
    }
    view[GROUP_MAP[key]].push(item)
  }

  return view
}

export async function updateSettings(
  db: D1Database,
  encryptionKey: string,
  patch: Partial<Record<SettingKey, string>>,
): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    if (!value?.trim()) continue
    await setSetting(db, key as SettingKey, value.trim(), encryptionKey)
  }
}
