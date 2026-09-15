-- Migration 004: status_conexao 'atencao' (avisos sem falha crítica)
PRAGMA foreign_keys = OFF;

CREATE TABLE clients_new (
    id                      TEXT PRIMARY KEY,
    nome                    TEXT NOT NULL,
    dominio                 TEXT NOT NULL,
    wp_api_url              TEXT NOT NULL,
    wp_user                 TEXT NOT NULL,
    wp_app_password_enc     TEXT,
    seo_plugin              TEXT NOT NULL DEFAULT 'yoast'
                            CHECK(seo_plugin IN ('yoast', 'rankmath', 'nenhum')),
    timezone                TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    categoria_padrao_id     INTEGER,
    autor_padrao_id         INTEGER,
    perfil_marca            TEXT,
    status_conexao          TEXT NOT NULL DEFAULT 'nao_testado'
                            CHECK(status_conexao IN ('ok', 'atencao', 'erro', 'nao_testado')),
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO clients_new SELECT * FROM clients;

DROP TABLE clients;

ALTER TABLE clients_new RENAME TO clients;

PRAGMA foreign_keys = ON;
