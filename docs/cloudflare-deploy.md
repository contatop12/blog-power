# Deploy no Cloudflare (CI + manual)

Este monorepo tem **3 aplicações** Wrangler. O projeto Git `blog-power` no dashboard faz deploy da **API** (worker `blog-power`).

## Projeto Git `blog-power` (API)

Configuração recomendada em **Workers & Pages → blog-power → Configurações**:

| Campo | Valor |
|-------|--------|
| Diretório raiz | `/` |
| Comando de build | *(vazio)* |
| Comando de deploy | `node scripts/ci-deploy.mjs` |

O script `ci-deploy.mjs` executa `wrangler deploy` e aplica `schema.sql` no D1 remoto.

Alternativa (só deploy, sem schema): `npx wrangler deploy`

O `wrangler.jsonc` na raiz **não inclui `database_id`** — o CI do Cloudflare provisiona o D1 `publisher-db` automaticamente (como já faz com R2 e Queues).

Após o primeiro deploy:

1. Configure secrets: `ENCRYPTION_KEY`, `DASHBOARD_USER`, `DASHBOARD_PASS`, etc. (`npm run cf:secrets:push:api`)
2. Em **Variables**, ajuste `ALLOWED_ORIGINS` para o domínio real do frontend

## Pipeline e frontend (projetos separados)

Crie **mais dois** projetos Workers conectados ao mesmo repositório:

### `publisher-pipeline`

| Campo | Valor |
|-------|--------|
| Comando de deploy | `npx wrangler deploy --config workers/pipeline/wrangler.jsonc` |

### `publisher-frontend`

| Campo | Valor |
|-------|--------|
| Comando de build | `npm run cf:build -w frontend` *(preferir build no CI Linux — OpenNext quebra em paths Windows com acento)* |
| Comando de deploy | `npx wrangler deploy --config frontend/wrangler.jsonc` |

URL atual: `https://publisher-frontend.contato-097.workers.dev`

Deploy local (Windows): copiar o monorepo para um path sem acentos (ex.: `C:\tmp\blog-power`) e rodar `npm run deploy -w frontend`.

## Deploy manual (local)

```bash
npm install
npm run cf:validate
npm run cf:deploy:pipeline
npm run cf:deploy:api
npm run cf:deploy:frontend
```

Requer `CLOUDFLARE_API_TOKEN` no `.env` (script `cf-with-env.mjs`).
