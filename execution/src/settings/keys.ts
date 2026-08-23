export const SECRET_SETTING_KEYS = new Set([
  'openrouter_api_key',
  'evolution_api_key',
  'cloudflare_api_token',
])

export const PLAIN_SETTING_KEYS = new Set([
  'openrouter_model_redator',
  'openrouter_model_editor',
  'openrouter_model_imagem',
  'evolution_api_url',
  'evolution_instance',
  'evolution_group_id',
  'cloudflare_account_id',
  'image_provider',
])

export const SETTING_DEFAULTS: Record<string, string> = {
  openrouter_model_redator: 'anthropic/claude-sonnet-4-5',
  openrouter_model_editor: 'anthropic/claude-sonnet-4-5',
  openrouter_model_imagem: 'anthropic/claude-sonnet-4-5',
  image_provider: 'openrouter',
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}
