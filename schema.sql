-- Publisher P12 — D1 schema (PRD §5)
-- Aplicar: npm run cf:d1:local  (dev)  |  npm run cf:d1:remote  (produção)

CREATE TABLE IF NOT EXISTS clients (
    id                      TEXT PRIMARY KEY,
    nome                    TEXT NOT NULL,
    dominio                 TEXT NOT NULL,
    wp_api_url              TEXT NOT NULL,
    wp_user                 TEXT NOT NULL,
    wp_app_password_enc     TEXT,
    seo_plugin              TEXT NOT NULL DEFAULT 'yoast'
                            CHECK(seo_plugin IN ('yoast', 'rankmath', 'nenhum')),
    timezone                TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    categoria_padrao_id   INTEGER,
    autor_padrao_id         INTEGER,
    perfil_marca            TEXT,
    status_conexao          TEXT NOT NULL DEFAULT 'nao_testado'
                            CHECK(status_conexao IN ('ok', 'atencao', 'erro', 'nao_testado')),
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS client_urls (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    url             TEXT NOT NULL,
    titulo          TEXT,
    slug            TEXT,
    resumo          TEXT,
    tipo            TEXT NOT NULL DEFAULT 'outro'
                    CHECK(tipo IN ('servico', 'blog', 'institucional', 'outro')),
    kw_inferida     TEXT,
    origem          TEXT NOT NULL DEFAULT 'sitemap'
                    CHECK(origem IN ('sitemap', 'manual', 'publicado_aqui', 'wordpress')),
    http_status     INTEGER,
    last_checked    TEXT,
    UNIQUE(client_id, url)
);

CREATE INDEX IF NOT EXISTS idx_client_urls_client ON client_urls(client_id);

CREATE TABLE IF NOT EXISTS articles (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'briefing'
                    CHECK(status IN (
                      'briefing', 'gerando', 'rascunho', 'em_revisao',
                      'aprovado', 'agendado', 'publicado', 'erro'
                    )),
    briefing        TEXT,
    conteudo_md     TEXT,
    conteudo_html   TEXT,
    seo             TEXT,
    geo             TEXT,
    schema_jsonld   TEXT,
    -- Estado compartilhado entre os agentes (migration 008)
    dossie          TEXT,
    -- Relatório do Revisor: score §64 e checklist §63 (migration 008)
    qa              TEXT,
    imagem_url      TEXT,
    imagem_alt      TEXT,
    wp_post_id      INTEGER,
    wp_url          TEXT,
    agendado_para   TEXT,
    publicado_em    TEXT,
    wp_post_type    TEXT NOT NULL DEFAULT 'post'
                    CHECK(wp_post_type IN ('post', 'page')),
    erro_msg        TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_articles_client_status ON articles(client_id, status);

CREATE TABLE IF NOT EXISTS article_revisions (
    id              TEXT PRIMARY KEY,
    article_id      TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    versao          INTEGER NOT NULL,
    origem          TEXT NOT NULL CHECK(origem IN ('redator', 'editor', 'humano')),
    conteudo_md     TEXT NOT NULL,
    diff_resumo     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_revisions_article ON article_revisions(article_id);

CREATE TABLE IF NOT EXISTS jobs (
    id              TEXT PRIMARY KEY,
    article_id      TEXT REFERENCES articles(id) ON DELETE CASCADE,
    client_id       TEXT REFERENCES clients(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL
                    CHECK(tipo IN ('pesquisar', 'redigir', 'editar', 'imagem', 'revisar',
                                   'publicar', 'validar_links', 'sincronizar_corpus',
                                   'sugerir_pautas')),
    status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK(status IN ('pendente', 'rodando', 'ok', 'erro')),
    payload         TEXT,
    tentativas      INTEGER NOT NULL DEFAULT 0,
    erro            TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_article ON jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
-- A junção pós-fan-out consulta o job irmão pelo par (article_id, tipo)
CREATE INDEX IF NOT EXISTS idx_jobs_article_tipo ON jobs(article_id, tipo);

CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_settings (key, value) VALUES
    ('openrouter_model_redator', 'anthropic/claude-sonnet-4-5'),
    ('openrouter_model_editor', 'anthropic/claude-sonnet-4-5'),
    ('openrouter_model_imagem', 'anthropic/claude-sonnet-4-5'),
    ('openrouter_model_pesquisador', 'anthropic/claude-sonnet-4-5'),
    ('openrouter_model_revisor', 'anthropic/claude-sonnet-4-5'),
    ('openrouter_model_pauteiro', 'anthropic/claude-sonnet-4-5'),
    ('image_provider', 'workers_ai');

CREATE TABLE IF NOT EXISTS client_materials (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    nome            TEXT NOT NULL,
    nome_original   TEXT NOT NULL,
    mime_type       TEXT NOT NULL,
    r2_key          TEXT NOT NULL,
    tamanho_bytes   INTEGER NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_materials_client ON client_materials(client_id);

CREATE TABLE IF NOT EXISTS auth_attempts (
    id          TEXT PRIMARY KEY,
    ip_hash     TEXT NOT NULL,
    success     INTEGER NOT NULL CHECK(success IN (0, 1)),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_time ON auth_attempts(ip_hash, created_at);

CREATE TABLE IF NOT EXISTS encrypted_settings (
    key         TEXT PRIMARY KEY,
    value_enc   TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);


-- Base de conhecimento: posts publicados no WordPress do cliente (migration 006)
CREATE TABLE IF NOT EXISTS client_posts (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    wp_post_id      INTEGER NOT NULL,
    wp_post_type    TEXT NOT NULL DEFAULT 'post'
                    CHECK(wp_post_type IN ('post', 'page')),
    titulo          TEXT NOT NULL,
    slug            TEXT,
    url             TEXT NOT NULL,
    excerpt         TEXT,
    conteudo_txt    TEXT,
    categorias      TEXT,
    tags            TEXT,
    palavras        INTEGER NOT NULL DEFAULT 0,
    publicado_em    TEXT,
    wp_modified     TEXT,
    synced_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(client_id, wp_post_type, wp_post_id)
);

CREATE INDEX IF NOT EXISTS idx_client_posts_client ON client_posts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_posts_modified ON client_posts(client_id, wp_modified);

-- Pautas sugeridas pela IA a partir do corpus (migration 006)
CREATE TABLE IF NOT EXISTS article_ideas (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tema            TEXT NOT NULL,
    kw_principal    TEXT,
    cluster         TEXT,
    payload         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'nova'
                    CHECK(status IN ('nova', 'descartada', 'usada')),
    article_id      TEXT REFERENCES articles(id) ON DELETE SET NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_article_ideas_client ON article_ideas(client_id, status);
