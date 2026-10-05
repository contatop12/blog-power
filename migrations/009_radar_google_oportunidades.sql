-- Migration 009: Radar fatia 1 — vínculo do cliente com o Search Console, oportunidades
-- (quick wins do Search Console + volume do Keyword Planner) e registro de custo de LLM.

-- D1: adia a checagem de FK até o fim da transação (ver docs D1 migrations)
PRAGMA defer_foreign_keys = true;

CREATE TABLE IF NOT EXISTS client_google (
    client_id       TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    gsc_site_url    TEXT,
    gsc_conta       TEXT CHECK(gsc_conta IN ('contato', 'ryan')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS opportunities (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL DEFAULT 'quick_win' CHECK(tipo IN ('quick_win')),
    query           TEXT NOT NULL,
    query_norm      TEXT NOT NULL,
    page_url        TEXT,
    posicao         REAL NOT NULL,
    impressoes      INTEGER NOT NULL,
    cliques         INTEGER NOT NULL,
    ctr             REAL NOT NULL,
    volume_mensal   INTEGER,
    concorrencia    TEXT,
    score           INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'nova'
                    CHECK(status IN ('nova', 'em_pauta', 'descartada')),
    janela_inicio   TEXT NOT NULL,
    janela_fim      TEXT NOT NULL,
    idea_id         TEXT REFERENCES article_ideas(id) ON DELETE SET NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(client_id, tipo, query_norm)
);

CREATE INDEX IF NOT EXISTS idx_opportunities_client ON opportunities(client_id, status, score DESC);

CREATE TABLE IF NOT EXISTS llm_usage (
    id              TEXT PRIMARY KEY,
    client_id       TEXT REFERENCES clients(id) ON DELETE SET NULL,
    article_id      TEXT REFERENCES articles(id) ON DELETE SET NULL,
    job_id          TEXT,
    agente          TEXT NOT NULL,
    modelo          TEXT NOT NULL,
    tokens_in       INTEGER NOT NULL DEFAULT 0,
    tokens_out      INTEGER NOT NULL DEFAULT 0,
    custo_usd       REAL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_client ON llm_usage(client_id, created_at);
