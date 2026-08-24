# Deploy no Cloudflare (CI + manual)

Este monorepo tem **3 aplicações** Wrangler. O projeto Git `blog-power` no dashboard deve fazer deploy da **API** (`publisher-api`).

## Projeto Git `blog-power` (API)

Configuração recomendada em **Workers & Pages → blog-power → Configurações**:

| Campo | Valor |
|-------|--------|
| Diretório raiz | `/` |
| Comando de build | *(vazio ou `npm run build`)* |
| Comando de deploy | `npx wrangler deploy` |

O arquivo `wrangler.jsonc` na **raiz** existe para o CI do Cloudflare (Wrangler 4 não permite `deploy` na raiz de um npm workspace sem config explícito). Ele publica o worker **`publisher-api`**.

Após o primeiro deploy:

1. Atualize `database_id` em `wrangler.jsonc` (raiz) e em `workers/api/wrangler.jsonc`
2. Em **Variables**, ajuste `ALLOWED_ORIGINS` para o domínio real do frontend
3. Configure secrets: `ENCRYPTION_KEY`, `DASHBOARD_USER`, `DASHBOARD_PASS`, etc. (`npm run cf:secrets:push:api`)

## Pipeline e frontend (projetos separados)

Crie **mais dois** projetos Workers conectados ao mesmo repositório:

### `publisher-pipeline`

| Campo | Valor |
|-------|--------|
| Comando de deploy | `npx wrangler deploy --config workers/pipeline/wrangler.jsonc` |

### `publisher-frontend`

| Campo | Valor |
|-------|--------|
| Comando de build | `npm run cf:build` |
| Comando de deploy | `npx wrangler deploy --config frontend/wrangler.jsonc` |

## Deploy manual (local)

```bash
npm install
npm run cf:validate
npm run cf:deploy:pipeline
npm run cf:deploy:api
npm run cf:deploy:frontend
```

Requer `CLOUDFLARE_API_TOKEN` no `.env` (script `cf-with-env.mjs`).
