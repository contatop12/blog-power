-- Migration 007: client_urls aceita origem 'wordpress' (espelho do corpus de posts publicados)
-- e recebe backfill de client_posts. Mantém a regra do PRD: links internos só de client_urls.

PRAGMA foreign_keys = OFF;

CREATE TABLE client_urls_new (
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

INSERT INTO client_urls_new (id, client_id, url, titulo, slug, resumo, tipo, kw_inferida, origem, http_status, last_checked)
SELECT id, client_id, url, titulo, slug, resumo, tipo, kw_inferida, origem, http_status, last_checked
FROM client_urls;

DROP TABLE client_urls;

ALTER TABLE client_urls_new RENAME TO client_urls;

CREATE INDEX IF NOT EXISTS idx_client_urls_client ON client_urls(client_id);

PRAGMA foreign_keys = ON;

-- Backfill: posts já sincronizados passam a fazer parte do inventário de links
INSERT INTO client_urls (id, client_id, url, titulo, slug, resumo, tipo, origem)
SELECT lower(hex(randomblob(16))), client_id, url, titulo, slug,
       NULLIF(substr(COALESCE(excerpt, ''), 1, 300), ''),
       CASE WHEN wp_post_type = 'page' THEN 'institucional' ELSE 'blog' END,
       'wordpress'
FROM client_posts WHERE true
ON CONFLICT(client_id, url) DO UPDATE SET
    titulo = COALESCE(client_urls.titulo, excluded.titulo),
    resumo = COALESCE(client_urls.resumo, excluded.resumo),
    tipo = CASE WHEN client_urls.tipo = 'outro' THEN excluded.tipo ELSE client_urls.tipo END;
