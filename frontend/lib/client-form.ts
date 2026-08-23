import type { CreateClientInput, PerfilMarca, SeoPlugin } from '@publisher-p12/types'

export const emptyPerfilMarca = (): PerfilMarca => ({
  descricao_institucional: '',
  segmentos_atendidos: [],
  servicos: [],
  provas_eeat: [],
  tom_de_voz: '',
  proibicoes: [],
  cta_padrao: '',
  diretriz_visual: '',
})

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
  perfil_marca: emptyPerfilMarca(),
})

export function linesToArray(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
}

export function arrayToLines(items: string[]): string {
  return items.join('\n')
}

export function parseServicos(text: string): PerfilMarca['servicos'] {
  return linesToArray(text).map((line) => {
    const [nome, url] = line.split('|').map((p) => p.trim())
    return { nome: nome ?? line, url: url ?? '' }
  })
}

export function formatServicos(servicos: PerfilMarca['servicos']): string {
  return servicos.map((s) => (s.url ? `${s.nome} | ${s.url}` : s.nome)).join('\n')
}

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
