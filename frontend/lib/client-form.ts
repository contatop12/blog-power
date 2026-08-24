import type { CreateClientInput, SeoPlugin } from '@publisher-p12/types'

export const emptyClientForm = (): CreateClientInput & { wp_app_password: string } => ({
  nome: '',
  dominio: '',
  wp_api_url: '',
  wp_user: '',
  wp_app_password: '',
  seo_plugin: 'yoast',
  timezone: 'America/Sao_Paulo',
  categoria_padrao_id: null,
  autor_padrao_id: null,
  perfil_marca: null,
})

export const SEO_PLUGINS: { value: SeoPlugin; label: string }[] = [
  { value: 'yoast', label: 'Yoast SEO' },
  { value: 'rankmath', label: 'Rank Math' },
  { value: 'nenhum', label: 'Nenhum' },
]

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
