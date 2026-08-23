-- Migration 003: rate limiting de login + credenciais criptografadas
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
