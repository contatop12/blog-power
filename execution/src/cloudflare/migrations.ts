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
    agendado_para TEXT, publicado_em TEXT, wp_post_type TEXT NOT NULL DEFAULT 'post',
    erro_msg TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_articles_client_status ON articles(client_id, status)`,
  `CREATE TABLE IF NOT EXISTS article_revisions (
    id TEXT PRIMARY KEY, article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    versao INTEGER NOT NULL, origem TEXT NOT NULL, conteudo_md TEXT NOT NULL,
    diff_resumo TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_revisions_article ON article_revisions(article_id)`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, article_id TEXT REFERENCES articles(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
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
    ('image_provider', 'workers_ai')`,
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
  `CREATE TABLE IF NOT EXISTS client_posts (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    wp_post_id INTEGER NOT NULL, wp_post_type TEXT NOT NULL DEFAULT 'post',
    titulo TEXT NOT NULL, slug TEXT, url TEXT NOT NULL, excerpt TEXT,
    conteudo_txt TEXT, categorias TEXT, tags TEXT,
    palavras INTEGER NOT NULL DEFAULT 0, publicado_em TEXT, wp_modified TEXT,
    synced_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(client_id, wp_post_type, wp_post_id))`,
  `CREATE INDEX IF NOT EXISTS idx_client_posts_client ON client_posts(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_client_posts_modified ON client_posts(client_id, wp_modified)`,
  `CREATE TABLE IF NOT EXISTS article_ideas (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tema TEXT NOT NULL, kw_principal TEXT, cluster TEXT, payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'nova',
    article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_article_ideas_client ON article_ideas(client_id, status)`,
]

/** Migration 007 (backfill): posts do corpus entram no inventário de links. Idempotente. */
export const CLIENT_URLS_BACKFILL_STATEMENT = `INSERT INTO client_urls (id, client_id, url, titulo, slug, resumo, tipo, origem)
  SELECT lower(hex(randomblob(16))), client_id, url, titulo, slug,
         NULLIF(substr(COALESCE(excerpt, ''), 1, 300), ''),
         CASE WHEN wp_post_type = 'page' THEN 'institucional' ELSE 'blog' END,
         'wordpress'
  FROM client_posts WHERE true
  ON CONFLICT(client_id, url) DO UPDATE SET
    titulo = COALESCE(client_urls.titulo, excluded.titulo),
    resumo = COALESCE(client_urls.resumo, excluded.resumo),
    tipo = CASE WHEN client_urls.tipo = 'outro' THEN excluded.tipo ELSE client_urls.tipo END`

/**
 * Migration 007: bancos criados pelo schema.sql têm CHECK em client_urls.origem
 * sem 'wordpress'. Reconstrói a tabela só nesse caso (ver needsClientUrlsUpgrade).
 */
export const CLIENT_URLS_UPGRADE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS client_urls_upgrade (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    url TEXT NOT NULL, titulo TEXT, slug TEXT, resumo TEXT,
    tipo TEXT NOT NULL DEFAULT 'outro', kw_inferida TEXT,
    origem TEXT NOT NULL DEFAULT 'sitemap', http_status INTEGER, last_checked TEXT,
    UNIQUE(client_id, url))`,
  `INSERT INTO client_urls_upgrade (id, client_id, url, titulo, slug, resumo, tipo, kw_inferida, origem, http_status, last_checked)
    SELECT id, client_id, url, titulo, slug, resumo, tipo, kw_inferida, origem, http_status, last_checked
    FROM client_urls`,
  `DROP TABLE client_urls`,
  `ALTER TABLE client_urls_upgrade RENAME TO client_urls`,
  `CREATE INDEX IF NOT EXISTS idx_client_urls_client ON client_urls(client_id)`,
]

/**
 * Migration 006: `jobs` ganha `client_id` e aceita jobs sem artigo.
 * CREATE TABLE IF NOT EXISTS não altera bancos existentes, então a tabela é
 * reconstruída — só quando a coluna ainda não existe (ver needsJobsUpgrade).
 */
export const JOBS_UPGRADE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS jobs_upgrade (
    id TEXT PRIMARY KEY,
    article_id TEXT REFERENCES articles(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pendente', payload TEXT,
    tentativas INTEGER NOT NULL DEFAULT 0, erro TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT)`,
  `INSERT INTO jobs_upgrade (id, article_id, client_id, tipo, status, payload, tentativas, erro, created_at, finished_at)
    SELECT j.id, j.article_id, a.client_id, j.tipo, j.status, j.payload, j.tentativas, j.erro, j.created_at, j.finished_at
    FROM jobs j LEFT JOIN articles a ON a.id = j.article_id`,
  `DROP TABLE jobs`,
  `ALTER TABLE jobs_upgrade RENAME TO jobs`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_article ON jobs(article_id)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
]

export const REQUIRED_TABLES = [
  'clients',
  'articles',
  'jobs',
  'app_settings',
  'encrypted_settings',
  'auth_attempts',
  'client_posts',
  'article_ideas',
] as const
