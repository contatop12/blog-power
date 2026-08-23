#!/usr/bin/env node
/**
 * Push secrets do .env para workers Cloudflare.
 * Uso: node scripts/push-worker-secrets.mjs api|pipeline|all [--dry-run]
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const SECRETS_BY_WORKER = {
  api: [
    'DASHBOARD_USER',
    'DASHBOARD_PASS',
    'ENCRYPTION_KEY',
    'OPENROUTER_API_KEY',
  ],
  pipeline: [
    'ENCRYPTION_KEY',
    'OPENROUTER_API_KEY',
    'EVOLUTION_API_URL',
    'EVOLUTION_API_KEY',
    'EVOLUTION_INSTANCE',
    'EVOLUTION_GROUP_ID',
  ],
}

function parseDotenv(filePath) {
  const out = {}
  if (!existsSync(filePath)) {
    console.error(`Erro: ${filePath} não encontrado`)
    process.exit(1)
  }
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq <= 0) continue
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

function wranglerConfig(worker) {
  return join('workers', worker, 'wrangler.jsonc')
}

function putSecret(worker, name, value, dryRun, env) {
  if (dryRun) {
    console.log(`[dry-run] ${worker}: ${name} (${value.length} chars)`)
    return 0
  }
  const r = spawnSync(
    'npx',
    ['wrangler', 'secret', 'put', name, '--config', wranglerConfig(worker)],
    {
      cwd: root,
      input: `${value}\n`,
      encoding: 'utf8',
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: process.platform === 'win32',
      env,
    },
  )
  if (r.status !== 0) {
    console.error(`Falha: ${worker} → ${name}`)
    return r.status ?? 1
  }
  console.log(`OK: ${worker} → ${name}`)
  return 0
}

const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
const dryRun = process.argv.includes('--dry-run')
const target = args[0]

if (!target || !['api', 'pipeline', 'all'].includes(target)) {
  console.error('Uso: node scripts/push-worker-secrets.mjs <api|pipeline|all> [--dry-run]')
  process.exit(1)
}

const e = parseDotenv(join(root, '.env'))
const childEnv = { ...process.env, ...e }
const workers = target === 'all' ? ['pipeline', 'api'] : [target]

for (const w of workers) {
  console.log(`\n--- ${w} ---`)
  for (const name of SECRETS_BY_WORKER[w]) {
    const value = e[name]
    if (!value) {
      console.warn(`Ignorado (vazio): ${name}`)
      continue
    }
    const code = putSecret(w, name, value, dryRun, childEnv)
    if (code !== 0) process.exit(code)
  }
}
console.log('\nConcluído.')
