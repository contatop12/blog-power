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
  | 'pesquisar'
  | 'redigir'
  | 'editar'
  | 'imagem'
  | 'revisar'
  | 'publicar'
  | 'validar_links'
  | 'sincronizar_corpus'
  | 'sugerir_pautas'

/** Jobs de corpus/pautas rodam no escopo do cliente, sem artigo associado. */
export const CLIENT_SCOPED_JOBS: JobTipo[] = ['sincronizar_corpus', 'sugerir_pautas']

/**
 * Jobs disparados juntos após `validar_links`. O último a terminar consulta o irmão e só
 * então aplica o veredito do Revisor — não existe barreira de sincronização no Queue.
 */
export const JOBS_PARALELOS: JobTipo[] = ['imagem', 'revisar']

export type JobStatus = 'pendente' | 'rodando' | 'ok' | 'erro'

export type RevisionOrigem = 'redator' | 'editor' | 'humano'

export interface ServicoMarca {
  nome: string
  url: string
}

/**
 * Forma legada do perfil (8 campos). Continua sendo o que os agentes leem como fallback.
 * `normalizePerfilCliente` deriva todos estes campos a partir do perfil completo, então
 * nenhum consumidor antigo quebra quando o cliente preenche só os campos novos.
 */
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

/** Profissional real do cliente. Skill §36: nunca inventar especialista. */
export interface ProfissionalResponsavel {
  nome: string
  funcao: string
  especialidade: string
  /** Página de autor no site, quando existir. Alimenta autoria/E-E-A-T. */
  url_autor?: string
}

/** Página do site do cliente citada no perfil. */
export interface PaginaRef {
  url: string
  titulo: string
}

/**
 * Perfil completo do cliente — as 32 perguntas de briefing + `diretriz_visual`.
 * Superset de PerfilMarca: os campos legados seguem declarados e são derivados.
 * Persistido como JSON em `clients.perfil_marca`.
 */
export interface PerfilCliente extends Partial<PerfilMarca> {
  // --- Identidade e marca ---
  nome_empresa: string
  site: string
  posicionamento: string
  tom_de_voz: string
  /** Direção visual para o gerador de imagem. Não consta da lista de briefing, mas
   *  `directives/imagem.md` depende dele. */
  diretriz_visual: string

  // --- Oferta ---
  servicos: ServicoMarca[]
  produtos: string[]
  servicos_prioritarios: string[]
  especialidades: string[]
  /** Diferenciais alegados pela empresa (posicionamento). */
  diferenciais: string[]
  ticket_medio: string

  // --- Mercado ---
  publico_alvo: string
  icp: string
  area_geografica: string
  cidades_prioritarias: string[]
  concorrentes: string[]

  // --- Autoridade (E-E-A-T) ---
  profissionais_responsaveis: ProfissionalResponsavel[]
  certificacoes: string[]
  /** Diferenciais comprováveis. Só estes viram `provas_eeat` (Skill §21/§22). */
  diferenciais_reais: string[]
  dados_proprietarios: string[]
  cases: string[]

  // --- Site e conteúdo ---
  paginas_importantes: PaginaRef[]
  paginas_servicos: PaginaRef[]
  /** Complementar. A fonte primária de artigos publicados é o corpus `client_posts`. */
  artigos_publicados: PaginaRef[]

  // --- Comercial ---
  objetivos_comerciais: string[]
  ctas_permitidos: string[]
  formas_contato: string[]
  crm_qualificacao: string

  // --- Insights do comercial ---
  perguntas_frequentes: string[]
  objecoes_comerciais: string[]

  // --- Compliance ---
  restricoes_legais: string[]
  restricoes_compliance: string[]
  informacoes_proibidas: string[]
}

export type PerfilBloco =
  | 'identidade'
  | 'oferta'
  | 'mercado'
  | 'autoridade'
  | 'conteudo'
  | 'comercial'
  | 'insights'
  | 'compliance'

export type PerfilCampoTipo =
  /** Uma linha. */
  | 'texto'
  /** Várias linhas. */
  | 'texto_longo'
  /** Lista de strings, um item por linha. */
  | 'lista'
  /** Lista de PaginaRef: { url, titulo }. */
  | 'lista_url'
  /** Lista de ServicoMarca: { nome, url }. */
  | 'lista_servico'
  /** Lista de ProfissionalResponsavel. */
  | 'lista_pessoa'

/** Metadado de um campo do perfil. Fonte única para UI, validação e completude. */
export interface PerfilCampoMeta {
  chave: keyof PerfilCliente
  label: string
  bloco: PerfilBloco
  tipo: PerfilCampoTipo
  /** Campos exigidos pelo pipeline antes de redigir. */
  obrigatorio: boolean
  dica: string
  placeholder?: string
}

export interface PerfilBlocoCompletude {
  bloco: PerfilBloco
  preenchidos: number
  total: number
}

export interface PerfilCompletude {
  /** 0 a 100, considerando todos os campos. */
  percentual: number
  preenchidos: number
  total: number
  blocos: PerfilBlocoCompletude[]
  /** Campos obrigatórios ainda vazios. Vazio = pipeline liberado. */
  faltando_obrigatorios: Array<keyof PerfilCliente>
}

export interface PerfilClienteView {
  client_id: string
  perfil: PerfilCliente
  completude: PerfilCompletude
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
  /** Skill §12/§13: fontes que sustentam as afirmações factuais do artigo. */
  links_externos?: LinkExterno[]
  schema_recomendado: string[]
  og: OgMeta
  imagem: ImagemSeo
  imagens_corpo?: ImagemCorpo[]

  // --- Skill §31: campos SEO complementares ---
  canonical?: string
  categoria_sugerida?: string
  tags_sugeridas?: string[]
  /** Ex.: "Home > Blog > Aparelhos Auditivos > Como escolher". */
  breadcrumb?: string
  /** Skill §49: define a cadência de revisão do artigo. */
  freshness?: Freshness
}

export interface GeoJson {
  estrategia: string
  blocos_autocontidos: string[]
  canibalizacao: string[]
  oportunidades: string[]
}

// ---------------------------------------------------------------------------
// Dossiê — contrato de handoff entre os agentes (articles.dossie)
// ---------------------------------------------------------------------------

export type IntencaoBusca =
  | 'informacional'
  | 'comercial'
  | 'transacional'
  | 'navegacional'
  | 'local'
  | 'comparativa'
  | 'investigativa'
  | 'problema_solucao'

/** Skill §3: estágio de consciência do usuário. Define profundidade e carga comercial. */
export type EstagioConsciencia =
  | 'desconhece_problema'
  | 'reconhece_problema'
  | 'procura_solucoes'
  | 'compara_alternativas'
  | 'escolhe_fornecedor'
  | 'pronto_para_contratar'

export type RiscoCanibalizacao = 'alto' | 'medio' | 'baixo'

export type RecomendacaoCanibalizacao =
  | 'atualizar'
  | 'consolidar'
  | 'redirecionar'
  | 'mudar_intencao'
  | 'mudar_palavra_chave'
  | 'cluster_complementar'
  | 'seguir'

/** Skill §46: artigo do próprio domínio que disputa a mesma intenção. */
export interface CanibalizacaoItem {
  url: string
  titulo: string
  risco: RiscoCanibalizacao
  recomendacao: RecomendacaoCanibalizacao
  motivo: string
}

/** Saída do Pesquisador (Skill §3-§8, §46). */
export interface PesquisaDossie {
  intencao: IntencaoBusca
  estagio_consciencia: EstagioConsciencia
  /** Skill §7: entidades que explicam o assunto, não termos para manipular ranking. */
  entidades: string[]
  kws_relacionadas: string[]
  perguntas: string[]
  cluster: string
  pagina_pilar: string
  canibalizacao: CanibalizacaoItem[]
  /** Skill §10: trechos que devem fazer sentido extraídos isoladamente. */
  blocos_citaveis: string[]
  /** Skill §49: evergreen | semi_evergreen | alta_volatilidade. */
  freshness: Freshness
  /** Por que este artigo merece existir em vez de atualizar um já publicado. */
  justificativa: string
}

export type Freshness = 'evergreen' | 'semi_evergreen' | 'alta_volatilidade'

/** Imagem já gravada no R2 — permite reposicionar sem gerar de novo na rodada 2. */
export interface ImagemRef {
  secao: string
  r2_key: string
  alt: string
}

/**
 * Estado compartilhado entre os agentes. Cada agente lê o dossiê inteiro e escreve
 * apenas a sua fatia.
 */
export interface Dossie {
  /** Versão da Skill que produziu este artigo. */
  skill_version: string
  /** 1 = primeira passada. 2 = rodada de correção após reprovação no gate §64. */
  rodada: number
  pesquisa: PesquisaDossie | null
  imagens_refs: ImagemRef[]
  /** Skill §2: o que faltou no perfil e foi sinalizado em vez de inventado. */
  pendencias: string[]
}

// ---------------------------------------------------------------------------
// QA — relatório do Revisor (articles.qa)
// ---------------------------------------------------------------------------

/** Skill §64. Nenhuma categoria pode ficar abaixo de 8. */
export interface QaScore {
  intencao_busca: number
  profundidade: number
  originalidade: number
  seo: number
  geo_aeo: number
  eeat: number
  ux: number
  conversao: number
  atualidade: number
  qualidade_fontes: number
  naturalidade: number
}

export const QA_SCORE_MINIMO = 8

export type QaVeredito = 'aprovado' | 'reprovado'

/** Item do checklist §63 que falhou, com a correção que o Redator deve aplicar. */
export interface QaCorrecao {
  categoria: keyof QaScore
  problema: string
  correcao: string
  /** Trecho do artigo onde o problema aparece, quando localizável. */
  trecho?: string
}

export interface QaReport {
  veredito: QaVeredito
  score: QaScore
  /** Categorias abaixo de QA_SCORE_MINIMO. */
  reprovadas: Array<keyof QaScore>
  correcoes: QaCorrecao[]
  /** Skill §12/§57: afirmações sem fonte que sustente. */
  fatos_sem_fonte: string[]
  /** Skill §50: o artigo poderia ter sido escrito sem conhecer este cliente? */
  diferenciacao_ia: string
  rodada: number
  avaliado_em: string
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
  /** Guarda o PerfilCliente completo. O nome da coluna é legado. */
  perfil_marca: PerfilCliente | null
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
  /** Estado compartilhado entre os agentes (pesquisa, rodada, refs de imagem, pendências). */
  dossie: Dossie | null
  /** Relatório do Revisor: score §64, checklist §63 e correções da rodada seguinte. */
  qa: QaReport | null
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
  perfil_marca?: PerfilCliente | null
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
  | 'openrouter_model_pesquisador'
  | 'openrouter_model_revisor'
  | 'openrouter_model_pauteiro'
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
  /**
   * Quando uma execução posterior do mesmo tipo, no mesmo artigo ou cliente, terminou `ok`.
   * Null = erro ainda pendente. O erro continua listado como histórico, marcado como resolvido.
   */
  resolvido_em?: string | null
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
  /** Blocos de leitura consumidos da REST API (5 posts por bloco). */
  blocos_lidos: number
  /** True quando a sync parou por orçamento e uma continuação foi enfileirada. */
  continua: boolean
  tipos: WpPostType[]
}

export interface SyncCorpusInput {
  /** Ignora wp_modified e reingere tudo. */
  completo?: boolean
  /** Padrão: ['post']. */
  tipos?: WpPostType[]
  /**
   * Marca um job criado pelo próprio pipeline para retomar uma sync que não coube no
   * orçamento de tempo. Continuação sempre parte do MAX(wp_modified) já gravado, mesmo
   * quando a chamada original pediu `completo`.
   */
  continuacao?: boolean
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

// Metadados dos campos do perfil do cliente (fonte única para UI, API e prompts).
// Sem extensão de propósito: este pacote é consumido como fonte TS pelo webpack do Next,
// que não mapeia `.js` para `.ts`. esbuild (wrangler), Vite e tsc (bundler) resolvem igual.
export * from './perfil-campos'
