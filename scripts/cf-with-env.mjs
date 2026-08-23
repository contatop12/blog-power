#!/usr/bin/env node
/**
 * Carrega .env na raiz e executa um comando wrangler.
 * Uso: node scripts/cf-with-env.mjs npx wrangler whoami
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function normalizeValue(v) {
  if (v == null) return v
  let s = String(v).replace(/\r/g, '').trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s
}

const envPath = join(root, '.env')
if (existsSync(envPath)) {
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    process.env[trimmed.slice(0, eq).trim()] = normalizeValue(trimmed.slice(eq + 1))
  }
}

if (!process.env.CLOUDFLARE_API_TOKEN) {
  console.error('Erro: defina CLOUDFLARE_API_TOKEN no .env')
  process.exit(1)
}

const [, , ...cmd] = process.argv
if (cmd.length === 0) {
  console.error('Uso: node scripts/cf-with-env.mjs <comando> [args...]')
  process.exit(1)
}

process.chdir(root)
const r = spawnSync(cmd[0], cmd.slice(1), {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})
process.exit(r.status === null ? 1 : r.status)
