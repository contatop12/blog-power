-- Migration 002: materiais de referência por cliente
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
