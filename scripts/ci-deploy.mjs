#!/usr/bin/env node
/**
 * Deploy CI: publica o worker e aplica schema.sql no D1 remoto.
 * Uso no Cloudflare Workers Builds: node scripts/ci-deploy.mjs
 */
import { spawnSync } from 'node:child_process'

function run(args) {
  const r = spawnSync('npx', args, { stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

run(['wrangler', 'deploy'])
run(['wrangler', 'd1', 'execute', 'DB', '--remote', '--file=schema.sql'])
