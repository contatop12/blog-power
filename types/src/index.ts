// Enums e tipos compartilhados — Publisher P12 (PRD §5)

export type WpPostType = 'post' | 'page'

export type SeoPlugin = 'yoast' | 'rankmath' | 'nenhum'

export type ConnectionStatus = 'ok' | 'atencao' | 'erro' | 'nao_testado'

export type UrlTipo = 'servico' | 'blog' | 'institucional' | 'outro'

/** 'wordpress' = espelhado do corpus de posts publicados (sync da base de conhecimento). */
export type UrlOrigem = 'sitemap' | 'manual' | 'publicado_aqui' | 'wordpress'

export type ArticleStatus =
  | 'briefing'
  | 'gerando'
  | 'rascunho'
  | 'em_revisao'
  | 'aprovado'
  | 'agendado'
  | 'publicado'
  | 'erro'

export type JobTipo =
  | 'redigir'
  | 'editar'
  | 'imagem'
  | 'publicar'
  | 'validar_links'
  | 'sincronizar_corpus'
  | 'sugerir_pautas'

/** Jobs de corpus/pautas rodam no escopo do cliente, sem artigo associado. */
export const CLIENT_SCOPED_JOBS: JobTipo[] = ['sincronizar_corpus', 'sugerir_pautas']

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
  /** Nome(s) da(s) categoria(s) WP — usado no contexto editorial. */
  intencao: string
  etapa_funil: string
  angulo: string
  publico: string
  extensao_alvo: number
  artigos_irmaos: string[]
  observacoes?: string
  /** IDs de categorias WordPress selecionadas no briefing. */
  categoria_ids?: number[]
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

/** Imagem de apoio no meio do artigo, sugerida pelo Editor. */
export interface ImagemCorpo {
  /** Texto exato do H2 onde a imagem entra (após o primeiro parágrafo). */
  secao: string
  /** Prompt em inglês, descritivo, sem pedir texto dentro da imagem. */
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
  imagens_corpo?: ImagemCorpo[]
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
  /** Tipo de conteúdo no WordPress: post (blog) ou page. */
  wp_post_type: WpPostType
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
  article_id: string | null
  client_id: string | null
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
  /** Null em jobs de escopo cliente (sincronizar_corpus, sugerir_pautas). */
  article_id: string | null
  client_id?: string | null
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
  /** Status agregado para UI e persistência no cliente. */
  status_conexao: ConnectionStatus
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
  /** Texto completo colado pelo usuário; se informado, pula a redação e vai para edição. */
  conteudo_colado?: string | null
  /** Padrão: post (artigo de blog). */
  wp_post_type?: WpPostType
  /** Data/hora planejada (ISO UTC). Opcional — pode definir na revisão. */
  agendado_para?: string | null
}

export interface PublishArticleInput {
  categoria_ids: number[]
  tag_ids: number[]
  autor_id?: number
  /** ISO 8601 (UTC) ou datetime-local interpretado com timezone do cliente. */
  agendado_para: string
  /** Padrão: post. Páginas não usam categorias/tags. */
  wp_post_type?: WpPostType
}

export interface WpCategoryOption {
  id: number
  name: string
  slug: string
  parent: number
  count?: number
}

export interface CreateWpCategoryInput {
  name: string
  parent?: number
}

export interface UpdateWpCategoryInput {
  name?: string
  slug?: string
  parent?: number
}

export interface WpTagOption {
  id: number
  name: string
  slug: string
}

export interface WpAuthorOption {
  id: number
  name: string
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

export interface DashboardKpis {
  clientes: number
  publicados: number
  agendados: number
  em_andamento: number
  erros_publicacao: number
  erros_servicos: number
}

export interface DashboardArticleRow {
  id: string
  client_id: string
  client_nome: string
  tema: string
  status: ArticleStatus
  wp_url: string | null
  publicado_em: string | null
  agendado_para: string | null
  erro_msg: string | null
  updated_at: string
}

export interface DashboardServiceError {
  id: string
  tipo: 'conexao_wp' | 'job'
  client_id: string | null
  client_nome: string | null
  titulo: string
  detalhe: string | null
  updated_at: string
}

export interface DashboardClientRow {
  id: string
  nome: string
  dominio: string
  status_conexao: ConnectionStatus
  artigos_total: number
  publicados: number
  erros: number
  agendados: number
}

export interface DashboardClientPublications {
  client_id: string
  client_nome: string
  dominio: string
  artigos: DashboardArticleRow[]
}

export interface DashboardPayload {
  kpis: DashboardKpis
  artigos_publicados: DashboardArticleRow[]
  erros_publicacao: DashboardArticleRow[]
  erros_servicos: DashboardServiceError[]
  clientes: DashboardClientRow[]
  publicacoes_por_cliente: DashboardClientPublications[]
}


// ---------------------------------------------------------------------------
// Base de conhecimento do cliente (corpus de posts publicados) + pautas
// ---------------------------------------------------------------------------

export interface WpTermRef {
  id: number
  name: string
}

/** Post/página já publicado no WordPress do cliente, ingerido para a base. */
export interface ClientPost {
  id: string
  client_id: string
  wp_post_id: number
  wp_post_type: WpPostType
  titulo: string
  slug: string | null
  url: string
  excerpt: string | null
  conteudo_txt: string | null
  categorias: WpTermRef[]
  tags: WpTermRef[]
  palavras: number
  publicado_em: string | null
  wp_modified: string | null
  synced_at: string
}

/** Linha enxuta para listagem na UI (sem o conteúdo completo). */
export interface ClientPostSummary {
  id: string
  wp_post_id: number
  wp_post_type: WpPostType
  titulo: string
  url: string
  categorias: WpTermRef[]
  palavras: number
  publicado_em: string | null
  wp_modified: string | null
}

export interface CorpusStatus {
  client_id: string
  total: number
  posts: number
  paginas: number
  palavras_total: number
  ultimo_sync: string | null
  ultimo_modified: string | null
  /** Job de sincronização em andamento, se houver. */
  job_em_andamento: string | null
}

export interface SyncCorpusResult {
  total_lidos: number
  inseridos: number
  atualizados: number
  paginas_lidas: number
  tipos: WpPostType[]
}

export interface SyncCorpusInput {
  /** Ignora wp_modified e reingere tudo. */
  completo?: boolean
  /** Padrão: ['post']. */
  tipos?: WpPostType[]
}

export type ArticleIdeaStatus = 'nova' | 'descartada' | 'usada'

/** Pauta sugerida pela IA — desenhada para virar Briefing sem tradução. */
export interface PautaSugerida {
  tema: string
  kw_principal: string
  kws_secundarias: string[]
  intencao: string
  etapa_funil: string
  angulo: string
  publico: string
  extensao_alvo: number
  /** Tema-pai identificado no corpus do cliente. */
  cluster: string
  /** Qual lacuna de cobertura a pauta preenche. */
  justificativa: string
  /** URLs do corpus que devem virar links internos (semente do sub-projeto B). */
  artigos_relacionados: string[]
  risco_canibalizacao: string | null
}

export interface ArticleIdea {
  id: string
  client_id: string
  tema: string
  kw_principal: string | null
  cluster: string | null
  pauta: PautaSugerida
  status: ArticleIdeaStatus
  article_id: string | null
  created_at: string
}

export interface SuggestPautasInput {
  /** Quantidade de pautas pedidas (1–15). Padrão 5. */
  quantidade?: number
  /** Recorte opcional: tema, categoria ou etapa de funil. */
  foco?: string
}

export interface SuggestPautasResult {
  pautas: PautaSugerida[]
  /** Quantos posts do corpus entraram no prompt. */
  posts_considerados: number
  corpus_truncado: boolean
}
