# Publisher P12

Ferramenta de produção e publicação de conteúdo SEO/GEO em WordPress — scaffold Cloudflare + TypeScript.

## Arquitetura

- **Camada 1:** `directives/` — SOPs por agente (framework AGENTS.md)
- **Camada 2:** `workers/api` + `workers/pipeline` — orquestração
- **Camada 3:** `execution/` — módulos TypeScript determinísticos
- **Frontend:** Next.js 15 + OpenNext no Cloudflare Pages
- **Dados:** D1 (SQLite), R2 (imagens), Queues (jobs)

## Pré-requisitos

- Node.js 18+
- Conta Cloudflare com Workers, D1, R2 e Queues habilitados
- `CLOUDFLARE_API_TOKEN` no `.env` (copie de `.env.example`)

## Credenciais (UI)

Acesse **Credenciais** no menu ou `/settings` para configurar:

- **OpenRouter** — API key e modelos por agente
- **Evolution API** — notificações WhatsApp ao publicar
- **Cloudflare** — Account ID e token (validação via API)

Secrets são criptografados no D1 (`encrypted_settings`). O login em `/login` tem limite de **5 tentativas / 15 min** com bloqueio de 30 min.

Na mesma página, o **Wizard — Setup D1** permite validar o token Cloudflare, listar/criar bancos D1 na conta e aplicar o `schema.sql` no banco vinculado ao Worker.

Migration adicional: `migrations/003_auth_and_settings.sql`

## CORS (produção)

Em produção, defina `ALLOWED_ORIGINS` no Worker API (vírgula) com o domínio do frontend, por exemplo:

```
ALLOWED_ORIGINS=https://publisher.seudominio.com
```

Em desenvolvimento local, `wrangler.jsonc` já inclui `http://localhost:3000` e `http://127.0.0.1:3000`.

## Setup local

```bash
cp .env.example .env
# Edite .env com tokens e credenciais

npm install

# Criar recursos Cloudflare (primeira vez — opcional, o CI provisiona automaticamente)
node scripts/cf-with-env.mjs npx wrangler d1 create publisher-db
node scripts/cf-with-env.mjs npx wrangler r2 bucket create publisher-images
node scripts/cf-with-env.mjs npx wrangler queues create publisher-article-jobs

# Aplicar schema D1 (local)
npm run cf:d1:local

# Secrets
npm run cf:secrets:push:all
```

## Desenvolvimento

Em terminais separados:

```bash
npm run dev:api        # http://127.0.0.1:8787
npm run dev:pipeline   # http://127.0.0.1:8788
npm run dev:frontend   # http://127.0.0.1:3000
```

Configure `NEXT_PUBLIC_API_URL=http://127.0.0.1:8787` no `.env` do frontend.

## Testes

```bash
npm test
```

## Deploy

Ordem recomendada:

```bash
npm run cf:validate
npm run cf:deploy:pipeline
npm run cf:deploy:api
npm run cf:deploy:frontend
```

**CI Git (Cloudflare):** o projeto `blog-power` usa `npx wrangler deploy` na raiz (`wrangler.jsonc` → API). Pipeline e frontend precisam de projetos Workers separados — ver [docs/cloudflare-deploy.md](docs/cloudflare-deploy.md).

## WordPress

Instale `mu-plugin/p12-publisher-bridge.php` em cada cliente. Ver [docs/wordpress-onboarding.md](docs/wordpress-onboarding.md).

## Estrutura

```
directives/     # SOPs (Camada 1)
execution/      # TypeScript determinístico (Camada 3)
workers/api/    # REST Hono
workers/pipeline/  # Queue consumer
frontend/       # Next.js UI
types/          # Tipos compartilhados
schema.sql      # D1
mu-plugin/      # Bridge WordPress
```

## Próxima fase (fora do scaffold)

- Prompts completos Redator/Editor
- Provider real de imagem
- UI de revisão com bloqueio completo
- Integração end-to-end ABX Telecom
