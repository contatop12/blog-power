// Enums e tipos compartilhados — Publisher P12 (PRD §5)

export type SeoPlugin = 'yoast' | 'rankmath' | 'nenhum'

export type ConnectionStatus = 'ok' | 'erro' | 'nao_testado'

export type UrlTipo = 'servico' | 'blog' | 'institucional' | 'outro'

export type UrlOrigem = 'sitemap' | 'manual' | 'publicado_aqui'

export type ArticleStatus =
  | 'briefing'
  | 'gerando'
  | 'rascunho'
  | 'em_revisao'
  | 'aprovado'
  | 'agendado'
  | 'publicado'
  | 'erro'

export type JobTipo = 'redigir' | 'editar' | 'imagem' | 'publicar' | 'validar_links'

export type JobStatus = 'pendente' | 'rodando' | 'ok' | 'erro'

export type RevisionOrigem = 'redator' | 'editor' | 'humano'

export interface ServicoMarca {
  nome: string
  url: string
}

export interface PerfilMarca {
  descricao_institucional: string
  segmentos_atendidos: string[]
  servicos: ServicoMarca[]
  provas_eeat: string[]
  tom_de_voz: string
  proibicoes: string[]
  cta_padrao: string
  diretriz_visual: string
}

export interface Briefing {
  tema: string
  kw_principal: string
  kws_secundarias: string[]
  intencao: string
  etapa_funil: string
  angulo: string
  publico: string
  extensao_alvo: number
  artigos_irmaos: string[]
  observacoes?: string
}

export interface LinkInterno {
  url: string
  ancora: string
  posicao?: string
  status_validacao?: number
}

export interface LinkExterno {
  url: string
  fonte: string
  justificativa: string
}

export interface OgMeta {
  title: string
  description: string
  image?: string
}

export interface ImagemSeo {
  prompt: string
  alt: string
}

export interface SeoJson {
  titulo_seo: string
  meta_description: string
  slug: string
  kw_principal: string
  kws_secundarias: string[]
  intencao: string
  etapa_funil: string
  links_internos: LinkInterno[]
  links_internos_futuros: string[]
  link_externo?: LinkExterno
  schema_recomendado: string[]
  og: OgMeta
  imagem: ImagemSeo
}

export interface GeoJson {
  estrategia: string
  blocos_autocontidos: string[]
  canibalizacao: string[]
  oportunidades: string[]
}

export interface Client {
  id: string
  nome: string
  dominio: string
  wp_api_url: string
  wp_user: string
  wp_app_password_configurado: boolean
  seo_plugin: SeoPlugin
  timezone: string
  categoria_padrao_id: number | null
  autor_padrao_id: number | null
  perfil_marca: PerfilMarca | null
  status_conexao: ConnectionStatus
  created_at: string
  updated_at: string
}

export interface ClientUrl {
  id: string
  client_id: string
  url: string
  titulo: string | null
  slug: string | null
  resumo: string | null
  tipo: UrlTipo
  kw_inferida: string | null
  origem: UrlOrigem
  http_status: number | null
  last_checked: string | null
}

export interface Article {
  id: string
  client_id: string
  status: ArticleStatus
  briefing: Briefing | null
  conteudo_md: string | null
  conteudo_html: string | null
  seo: SeoJson | null
  geo: GeoJson | null
  schema_jsonld: Record<string, unknown> | null
  imagem_url: string | null
  imagem_alt: string | null
  wp_post_id: number | null
  wp_url: string | null
  agendado_para: string | null
  publicado_em: string | null
  erro_msg: string | null
  created_at: string
  updated_at: string
}

export interface ArticleRevision {
  id: string
  article_id: string
  versao: number
  origem: RevisionOrigem
  conteudo_md: string
  diff_resumo: string | null
  created_at: string
}

export interface Job {
  id: string
  article_id: string
  tipo: JobTipo
  status: JobStatus
  payload: Record<string, unknown> | null
  tentativas: number
  erro: string | null
  created_at: string
  finished_at: string | null
}

export interface QueueMessage {
  job_id: string
  article_id: string
  tipo: JobTipo
}

export interface ConnectionCheckItem {
  nome: string
  ok: boolean
  instrucao?: string
}

export interface ConnectionCheckResult {
  ok: boolean
  itens: ConnectionCheckItem[]
}

export interface CreateClientInput {
  nome: string
  dominio: string
  wp_api_url: string
  wp_user: string
  wp_app_password?: string
  seo_plugin?: SeoPlugin
  timezone?: string
  categoria_padrao_id?: number | null
  autor_padrao_id?: number | null
  perfil_marca?: PerfilMarca | null
}

export interface CreateArticleInput {
  client_id: string
  briefing: Briefing
}

export interface PublishArticleInput {
  categoria_ids: number[]
  tag_ids: number[]
  autor_id?: number
  agendado_para: string
}

export type MaterialTipo = 'documento' | 'imagem' | 'referencia'

export interface ClientMaterial {
  id: string
  client_id: string
  nome: string
  nome_original: string
  mime_type: string
  tamanho_bytes: number
  created_at: string
}

export type SettingKey =
  | 'openrouter_api_key'
  | 'openrouter_model_redator'
  | 'openrouter_model_editor'
  | 'openrouter_model_imagem'
  | 'evolution_api_url'
  | 'evolution_api_key'
  | 'evolution_instance'
  | 'evolution_group_id'
  | 'cloudflare_account_id'
  | 'cloudflare_api_token'
  | 'image_provider'

export interface SettingFieldMeta {
  key: SettingKey
  label: string
  secret: boolean
  grupo: 'openrouter' | 'evolution' | 'cloudflare' | 'geral'
  placeholder?: string
}

export interface SettingValueView {
  key: SettingKey
  configurado: boolean
  valor_mascarado?: string
  valor?: string
}

export interface SettingsGroupView {
  openrouter: SettingValueView[]
  evolution: SettingValueView[]
  cloudflare: SettingValueView[]
  geral: SettingValueView[]
}

export interface LoginResult {
  ok: boolean
  token?: string
  erro?: string
  tentativas_restantes?: number
  bloqueado_ate?: string
}

export interface UpdateSettingsInput {
  settings: Partial<Record<SettingKey, string>>
}

export interface D1SetupStatus {
  ready: boolean
  tables_found: string[]
  tables_missing: string[]
  migrations_total: number
}

export interface D1ApplyResult {
  ok: boolean
  applied: number
  before_missing: string[]
  after_missing: string[]
}

export interface CfD1DatabaseInfo {
  uuid: string
  name: string
  created_at: string
}
