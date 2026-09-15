-- Migration 006: base de conhecimento do cliente (corpus de posts publicados)
-- e pautas sugeridas pela IA. Também libera jobs de escopo "cliente" (sem artigo).

-- D1: adia a checagem de FK até o fim da transação (ver docs D1 migrations)
PRAGMA defer_foreign_keys = true;

-- 1) Corpus: todo post/página publicado no WordPress do cliente
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

-- 2) Pautas sugeridas pela IA a partir do corpus
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

-- 3) jobs: article_id passa a ser opcional e ganha client_id (jobs de escopo cliente)
CREATE TABLE jobs_new (
    id              TEXT PRIMARY KEY,
    article_id      TEXT REFERENCES articles(id) ON DELETE CASCADE,
    client_id       TEXT REFERENCES clients(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL
                    CHECK(tipo IN ('redigir', 'editar', 'imagem', 'publicar',
                                   'validar_links', 'sincronizar_corpus', 'sugerir_pautas')),
    status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK(status IN ('pendente', 'rodando', 'ok', 'erro')),
    payload         TEXT,
    tentativas      INTEGER NOT NULL DEFAULT 0,
    erro            TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at     TEXT
);

INSERT INTO jobs_new (id, article_id, client_id, tipo, status, payload, tentativas, erro, created_at, finished_at)
SELECT j.id, j.article_id, a.client_id, j.tipo, j.status, j.payload, j.tentativas, j.erro, j.created_at, j.finished_at
FROM jobs j
LEFT JOIN articles a ON a.id = j.article_id;

DROP TABLE jobs;

ALTER TABLE jobs_new RENAME TO jobs;

CREATE INDEX IF NOT EXISTS idx_jobs_article ON jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

