#!/usr/bin/env node
/**
 * Valida presença de arquivos de config Cloudflare antes do deploy.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const required = [
  'schema.sql',
  'workers/api/wrangler.jsonc',
  'workers/pipeline/wrangler.jsonc',
  'frontend/wrangler.jsonc',
  'workers/api/src/index.ts',
  'workers/pipeline/src/index.ts',
]

let ok = true
for (const f of required) {
  const path = join(root, f)
  if (!existsSync(path)) {
    console.error(`❌ Ausente: ${f}`)
    ok = false
  } else {
    console.log(`✅ ${f}`)
  }
}

for (const w of ['api', 'pipeline']) {
  const cfg = JSON.parse(
    readFileSync(join(root, `workers/${w}/wrangler.jsonc`), 'utf8')
      .replace(/\/\/.*$/gm, '')
      .replace(/,\s*([\]}])/g, '$1'),
  )
  if (!cfg.d1_databases?.length) {
    console.error(`❌ workers/${w}: D1 binding ausente`)
    ok = false
  }
}

if (!ok) process.exit(1)
console.log('\nConfiguração válida.')
