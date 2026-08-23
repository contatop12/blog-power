/** Statements idempotentes para bootstrap do D1 (espelho de schema.sql + migrations). */
export const D1_BOOTSTRAP_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY, nome TEXT NOT NULL, dominio TEXT NOT NULL,
    wp_api_url TEXT NOT NULL, wp_user TEXT NOT NULL, wp_app_password_enc TEXT,
    seo_plugin TEXT NOT NULL DEFAULT 'yoast',
    timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    categoria_padrao_id INTEGER, autor_padrao_id INTEGER, perfil_marca TEXT,
    status_conexao TEXT NOT NULL DEFAULT 'nao_testado',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS client_urls (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    url TEXT NOT NULL, titulo TEXT, slug TEXT, resumo TEXT,
    tipo TEXT NOT NULL DEFAULT 'outro', kw_inferida TEXT,
    origem TEXT NOT NULL DEFAULT 'sitemap', http_status INTEGER, last_checked TEXT,
    UNIQUE(client_id, url))`,
  `CREATE INDEX IF NOT EXISTS idx_client_urls_client ON client_urls(client_id)`,
  `CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'briefing', briefing TEXT, conteudo_md TEXT,
    conteudo_html TEXT, seo TEXT, geo TEXT, schema_jsonld TEXT,
    imagem_url TEXT, imagem_alt TEXT, wp_post_id INTEGER, wp_url TEXT,
    agendado_para TEXT, publicado_em TEXT, erro_msg TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_articles_client_status ON articles(client_id, status)`,
  `CREATE TABLE IF NOT EXISTS article_revisions (
    id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    versao INTEGER NOT NULL, origem TEXT NOT NULL, conteudo_md TEXT NOT NULL,
    diff_resumo TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_revisions_article ON article_revisions(article_id)`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pendente', payload TEXT,
    tentativas INTEGER NOT NULL DEFAULT 0, erro TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_article ON jobs(article_id)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY, value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `INSERT OR IGNORE INTO app_settings (key, value) VALUES
    ('openrouter_model_redator', 'anthropic/claude-sonnet-4-5'),
    ('openrouter_model_editor', 'anthropic/claude-sonnet-4-5'),
    ('openrouter_model_imagem', 'anthropic/claude-sonnet-4-5'),
    ('image_provider', 'openrouter')`,
  `CREATE TABLE IF NOT EXISTS client_materials (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    nome TEXT NOT NULL, nome_original TEXT NOT NULL, mime_type TEXT NOT NULL,
    r2_key TEXT NOT NULL, tamanho_bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_materials_client ON client_materials(client_id)`,
  `CREATE TABLE IF NOT EXISTS auth_attempts (
    id TEXT PRIMARY KEY, ip_hash TEXT NOT NULL, success INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_time ON auth_attempts(ip_hash, created_at)`,
  `CREATE TABLE IF NOT EXISTS encrypted_settings (
    key TEXT PRIMARY KEY, value_enc TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
]

export const REQUIRED_TABLES = [
  'clients',
  'articles',
  'jobs',
  'app_settings',
  'encrypted_settings',
  'auth_attempts',
] as const
