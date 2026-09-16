-- Migration 008: time de agentes da Skill P12.
-- Acrescenta o dossiê compartilhado e o relatório de QA ao artigo, e libera os dois
-- novos tipos de job (pesquisar, revisar) no CHECK da tabela jobs.

-- D1: adia a checagem de FK até o fim da transação (ver docs D1 migrations)
PRAGMA defer_foreign_keys = true;

-- 1) Dossiê: estado compartilhado entre Pesquisador, Redator, Editor, Revisor e Imagem
ALTER TABLE articles ADD COLUMN dossie TEXT;

-- 2) QA: score §64 e checklist §63 do Revisor. Read-only sobre conteudo_md.
ALTER TABLE articles ADD COLUMN qa TEXT;

-- 3) jobs: SQLite não altera CHECK, então a tabela é reconstruída
CREATE TABLE jobs_new (
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

INSERT INTO jobs_new (id, article_id, client_id, tipo, status, payload, tentativas, erro, created_at, finished_at)
SELECT id, article_id, client_id, tipo, status, payload, tentativas, erro, created_at, finished_at
FROM jobs;

DROP TABLE jobs;

ALTER TABLE jobs_new RENAME TO jobs;

CREATE INDEX IF NOT EXISTS idx_jobs_article ON jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

-- A junção pós-fan-out consulta o irmão pelo par (article_id, tipo)
CREATE INDEX IF NOT EXISTS idx_jobs_article_tipo ON jobs(article_id, tipo);

-- 4) Modelos dos agentes novos. Vazio = cai no modelo do Editor.
INSERT OR IGNORE INTO app_settings (key, value) VALUES
    ('openrouter_model_pesquisador', 'anthropic/claude-sonnet-4-5'),
    ('openrouter_model_revisor', 'anthropic/claude-sonnet-4-5'),
    ('openrouter_model_pauteiro', 'anthropic/claude-sonnet-4-5');
