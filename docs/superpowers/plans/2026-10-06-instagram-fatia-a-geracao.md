# Instagram — fatia A (geração) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar posts de Instagram (estático e carrossel) com roteiro escrito por LLM e artes geradas pelo GPT Image, revisão em duas etapas (texto, depois arte), download das artes e cópia da legenda. Publicar e agendar ficam para a fatia B.

**Architecture:** A lógica fica em módulos determinísticos de `execution/src/openai/` e `execution/src/instagram/`: cliente da OpenAI, roteirista, validação, prompts, geração de slide, store D1, fila e orquestração dos jobs. O worker do pipeline só monta as dependências e roteia jobs `ig_*` para `processIgJob`. A API Hono expõe rotas finas sobre o store. O frontend Next ganha o menu Instagram, as telas de lista, criação e editor, e uma aba nova na página do cliente.

**Tech Stack:** TypeScript, Cloudflare Workers (D1, R2, Queues, binding Images), Hono, Next.js 15, Vitest, OpenAI Images API (`gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`), OpenRouter.

**Spec:** `docs/superpowers/specs/2026-10-06-instagram-posts-design.md`

## Global Constraints

- Textos de UI, mensagens de erro e comentários em PT-BR. Prompt para o modelo de imagem em inglês, com o texto da arte em PT-BR entre aspas.
- OpenAI e OpenRouter são chamados só no backend (pipeline/API), nunca no browser.
- A chave da OpenAI nunca volta em claro pela API. Ela vem do secret `OPENAI_API_KEY` do worker do pipeline, com fallback em `encrypted_settings` (`openai_api_key`), igual ao OpenRouter.
- Geração em `1280x1600`. Saída final em 1080×1350 JPEG q85; sem o binding Images, fica o JPEG 1280×1600.
- Limites do roteiro (`IG_LIMITES`): título ≤ 60, texto ≤ 180 por slide, legenda ≤ 2.200, no máximo 30 hashtags. Carrossel tem 2 a 10 slides; estático tem 1.
- Padrões: `gpt-image-2.5-flare` para gerar, `gpt-image-2.5-sunburst` para corrigir, qualidade `high`, roteirista `anthropic/claude-sonnet-4-5`.
- Datas em ISO UTC (`new Date().toISOString()`).
- Chave no R2: `instagram/{post_id}/slide-{ordem}-v{versao}.jpg`.
- A fila tem `max_retries: 3`, ou seja, até 4 entregas. `ErroDefinitivo` não volta para a fila.
- Testes: `npx vitest run <arquivo>`. Typecheck: `npx tsc --noEmit -p <workspace>` (`types`, `execution`, `workers/api`, `workers/pipeline`, `frontend`). Baseline: 213 testes verdes e typecheck limpo em todos.
- Fora desta fatia: publicação, agendamento, cron, Graph API e a rota pública `/public/ig/:token.jpg`. O `token_publico` já é gravado agora.
- Desvios da spec (a Task 18 atualiza a spec):
  - Não existe tela de Settings; credenciais entram como secrets.
  - As colunas `ig_*` de `client_instagram` aceitam NULL, porque a fatia A só grava o logo.
  - O job `ig_slide` aceita `cascata` no payload.
  - Regerar ou corrigir é recusado (409) enquanto algum slide do post está em geração.

## Review Focus

1. **Logo em SVG ou PDF nos Materiais:** a OpenAI não aceita esses formatos. O logo é ignorado e a geração segue sem ele. (Task 11, teste "ignora logo em formato que a OpenAI não aceita")
2. **Duplo clique em "Gerar artes":** só a primeira transição de status passa; a segunda recebe 409. (Task 9, teste "claimIgPostStatus devolve false quando nenhuma linha muda")
3. **Retry da fila depois que a capa já saiu:** a capa não é gerada nem paga de novo. (Task 11, teste "retry do ig_artes não regera a capa")
4. **PATCH no texto de slide com o post em `revisao`:** recusado, para a arte e o banco não divergirem. (Task 9, teste "em revisao só legenda e hashtags mudam")
5. **Artigo de origem sem `conteudo_md`:** erro definitivo com mensagem clara, sem chamar o modelo. (Task 11, teste "artigo sem texto falha sem chamar o modelo")

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `types/src/index.ts` (mod) | Tipos IG, `IG_LIMITES`, `JobTipo`, `IG_JOBS`, `QueueMessage.ig_post_id`, `SettingKey` |
| `execution/src/erros.ts` | `ErroDefinitivo` |
| `execution/src/settings/keys.ts`, `store.ts` (mod) | Chaves da OpenAI e `resolveOpenAiApiKey` |
| `migrations/010_instagram.sql`, `schema.sql` (mod) | DDL canônico |
| `execution/src/cloudflare/migrations.ts`, `d1Setup.ts` (mod) | Statements da 010 e upgrade idempotente |
| `execution/src/openai/images.ts` | Cliente da Images API e custo |
| `execution/src/instagram/validar.ts` | Normalização e validação do roteiro |
| `execution/src/instagram/roteiro.ts` | Agente roteirista |
| `execution/src/instagram/prompt.ts` | Prompt por slide e prompt de correção |
| `execution/src/instagram/imagem.ts` | Gera 1 slide (geração ou edição, depois recorte) |
| `execution/src/instagram/store.ts` | D1: posts, slides, logo, edição, junção, claim |
| `execution/src/instagram/fila.ts` | Jobs IG: enfileirar, despachar slide, status, payload |
| `execution/src/instagram/orquestrar.ts` | `processIgJob` e os 3 jobs |
| `execution/src/usage/llmUsage.ts` (mod) | `igPostId` opcional |
| `workers/pipeline/src/index.ts` (mod) | Roteamento e dependências |
| `workers/api/src/routes/instagram.ts`, `index.ts` | Rotas |
| `frontend/lib/api.ts`, `frontend/lib/instagram.ts` | Cliente HTTP e status |
| `frontend/app/instagram/**`, `frontend/components/instagram/*` | Telas |
| `frontend/app/clients/[id]/page.tsx` (mod) | Aba Instagram |
| `directives/instagram.md`, `directives/README.md` | Diretiva |

---

### Task 1: Tipos compartilhados e `ErroDefinitivo`

**Files:**
- Modify: `types/src/index.ts` (união `JobTipo` nas linhas 24-33, `QueueMessage` em ~501, final do arquivo)
- Create: `execution/src/erros.ts`
- Test: `execution/src/erros.test.ts`
- Modify: `execution/src/index.ts`
- Modify: `workers/pipeline/src/index.ts` (switch de `processJob`, antes do `default`)

**Interfaces:**
- Produces: `ErroDefinitivo`; tipos `IgFormato`, `IgOrigem`, `IgPostStatus`, `IgSlideStatus`, `IgSlideModo`, `IgSlide`, `IgPost`, `IgPostDetalhe`, `CreateIgPostInput`, `IgRoteiro`, `IgRoteiroSlide`, `UpdateIgPostInput`, `IgSlideJobPayload`, `ClientInstagram`; constantes `IG_LIMITES`, `IG_MAX_SLIDES`, `IG_MIN_SLIDES_CARROSSEL`, `IG_JOBS`; `QueueMessage.ig_post_id`.

- [ ] **Step 1: Teste que falha**

`execution/src/erros.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ErroDefinitivo } from './erros.js'

class Filho extends ErroDefinitivo {}

describe('ErroDefinitivo', () => {
  it('subclasses continuam sendo ErroDefinitivo e guardam o próprio nome', () => {
    const err = new Filho('moderação')
    expect(err).toBeInstanceOf(ErroDefinitivo)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('Filho')
    expect(err.message).toBe('moderação')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/erros.test.ts`
Expected: FAIL, `Cannot find module './erros.js'`

- [ ] **Step 3: Implementar**

`execution/src/erros.ts`:

```ts
/**
 * Falha que não adianta repetir: moderação, credencial inválida, entrada inválida.
 * Jobs de Instagram dão ack nela em vez de devolver a mensagem para a fila.
 */
export class ErroDefinitivo extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}
```

Em `execution/src/index.ts`, primeira linha nova no topo:

```ts
export * from './erros.js'
```

Em `types/src/index.ts`, troque a união `JobTipo`:

```ts
export type JobTipo =
  | 'pesquisar'
  | 'redigir'
  | 'editar'
  | 'imagem'
  | 'revisar'
  | 'publicar'
  | 'validar_links'
  | 'sincronizar_corpus'
  | 'sugerir_pautas'
  | 'ig_roteiro'
  | 'ig_artes'
  | 'ig_slide'
```

Logo depois de `export const JOBS_PARALELOS ...`:

```ts
/** Jobs de Instagram: roteados para `processIgJob` no handler da fila do pipeline. */
export const IG_JOBS: JobTipo[] = ['ig_roteiro', 'ig_artes', 'ig_slide']
```

Em `QueueMessage`, depois de `client_id?: string | null`:

```ts
  /** Só nos jobs de Instagram. */
  ig_post_id?: string | null
```

No final do arquivo:

```ts
// ---------------------------------------------------------------------------
// Instagram (spec 2026-10-06-instagram-posts-design)
// ---------------------------------------------------------------------------

export type IgFormato = 'estatico' | 'carrossel'
export type IgOrigem = 'tema' | 'artigo'
export type IgPostStatus =
  | 'gerando_roteiro'
  | 'roteiro'
  | 'gerando_artes'
  | 'revisao'
  | 'agendado'
  | 'publicando'
  | 'publicado'
  | 'erro'
export type IgSlideStatus = 'pendente' | 'gerando' | 'ok' | 'erro'
export type IgSlideModo = 'gerar' | 'regerar' | 'corrigir'

export const IG_MAX_SLIDES = 10
export const IG_MIN_SLIDES_CARROSSEL = 2

/** Texto curto sai legível na arte; os outros dois são limites do Instagram. */
export const IG_LIMITES = { titulo: 60, texto: 180, legenda: 2200, hashtags: 30 } as const

export interface IgRoteiroSlide {
  titulo: string
  texto: string
  ideia_visual: string
}

export interface IgRoteiro {
  direcao_arte: string
  slides: IgRoteiroSlide[]
  legenda: string
  hashtags: string[]
}

export interface IgSlide extends IgRoteiroSlide {
  id: string
  post_id: string
  ordem: number
  versao: number
  tem_imagem: boolean
  status: IgSlideStatus
  erro: string | null
  updated_at: string
}

export interface IgPost {
  id: string
  client_id: string
  formato: IgFormato
  num_slides: number
  origem: IgOrigem
  article_id: string | null
  briefing: string | null
  direcao_arte: string | null
  legenda: string | null
  hashtags: string[]
  status: IgPostStatus
  agendado_para: string | null
  publicado_em: string | null
  ig_permalink: string | null
  erro: string | null
  created_at: string
  updated_at: string
}

export interface IgPostDetalhe extends IgPost {
  slides: IgSlide[]
}

export interface CreateIgPostInput {
  client_id: string
  formato: IgFormato
  num_slides: number
  origem: IgOrigem
  article_id?: string | null
  briefing?: string | null
}

export interface UpdateIgPostInput {
  direcao_arte?: string
  legenda?: string
  hashtags?: string[]
  slides?: Array<{ ordem: number } & Partial<IgRoteiroSlide>>
}

export interface IgSlideJobPayload {
  ordem: number
  modo: IgSlideModo
  /** Obrigatória em `corrigir`. */
  instrucao?: string
  /** Só na capa: depois dela, regera os demais slides com o estilo novo. */
  cascata?: boolean
}

export interface ClientInstagram {
  client_id: string
  ig_user_id: string | null
  ig_username: string | null
  page_id: string | null
  logo_material_id: string | null
  updated_at: string
}
```

Em `workers/pipeline/src/index.ts`, no `switch (tipo)` de `processJob`, imediatamente antes de `default: {`:

```ts
      case 'ig_roteiro':
      case 'ig_artes':
      case 'ig_slide':
        // O handler da fila manda esses tipos para processIgJob; chegar aqui é bug de roteamento
        throw new Error(`Job ${tipo} deveria ter sido roteado para o Instagram`)
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npx vitest run execution/src/erros.test.ts && npx tsc --noEmit -p types && npx tsc --noEmit -p execution && npx tsc --noEmit -p workers/pipeline && npx tsc --noEmit -p workers/api && npx tsc --noEmit -p frontend`
Expected: 1 teste PASS; typecheck sem erros.

- [ ] **Step 5: Commit**

```bash
git add types/src/index.ts execution/src/erros.ts execution/src/erros.test.ts execution/src/index.ts workers/pipeline/src/index.ts
git commit -m "feat(instagram): tipos compartilhados e ErroDefinitivo"
```

---

### Task 2: Settings da OpenAI

**Files:**
- Modify: `types/src/index.ts` (`SettingKey`, ~linha 598)
- Modify: `execution/src/settings/keys.ts`
- Modify: `execution/src/settings/store.ts`
- Modify: `workers/api/src/lib/settingsView.ts`
- Modify: `workers/pipeline/src/index.ts` (`PipelineBindings`)
- Modify: `scripts/push-worker-secrets.mjs` (lista `pipeline`)
- Test: `execution/src/settings/openai.test.ts`

**Interfaces:**
- Consumes: `getSetting`, `SETTING_DEFAULTS` (existentes)
- Produces: `resolveOpenAiApiKey(db: D1Database, encryptionKey: string, envFallback?: string): Promise<string | null>`; chaves `openai_api_key`, `openai_model_imagem`, `openai_model_imagem_edicao`, `openai_qualidade_imagem`, `openrouter_model_instagram`; `PipelineBindings.OPENAI_API_KEY?: string`

- [ ] **Step 1: Teste que falha**

`execution/src/settings/openai.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FakeD1 } from '../test-support/fakeD1.js'
import { PLAIN_SETTING_KEYS, SECRET_SETTING_KEYS, SETTING_DEFAULTS } from './keys.js'
import { getSetting, resolveOpenAiApiKey } from './store.js'

describe('settings da OpenAI', () => {
  it('chave da OpenAI é secreta; modelos e qualidade são comuns com padrão', () => {
    expect(SECRET_SETTING_KEYS.has('openai_api_key')).toBe(true)
    expect(PLAIN_SETTING_KEYS.has('openai_api_key')).toBe(false)
    expect(SETTING_DEFAULTS.openai_model_imagem).toBe('gpt-image-2.5-flare')
    expect(SETTING_DEFAULTS.openai_model_imagem_edicao).toBe('gpt-image-2.5-sunburst')
    expect(SETTING_DEFAULTS.openai_qualidade_imagem).toBe('high')
    expect(SETTING_DEFAULTS.openrouter_model_instagram).toBe('anthropic/claude-sonnet-4-5')
  })

  it('sem valor no banco, o modelo cai no padrão', async () => {
    expect(await getSetting(new FakeD1(), 'openai_model_imagem', 'k')).toBe('gpt-image-2.5-flare')
  })

  it('sem chave no banco, usa o secret do worker', async () => {
    expect(await resolveOpenAiApiKey(new FakeD1(), 'k', 'sk-env')).toBe('sk-env')
    expect(await resolveOpenAiApiKey(new FakeD1(), 'k')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/settings/openai.test.ts`
Expected: FAIL (`resolveOpenAiApiKey` não exportado)

- [ ] **Step 3: Implementar**

`types/src/index.ts`, ao final da união `SettingKey` (depois de `| 'image_provider'`):

```ts
  | 'openai_api_key'
  | 'openai_model_imagem'
  | 'openai_model_imagem_edicao'
  | 'openai_qualidade_imagem'
  | 'openrouter_model_instagram'
```

`execution/src/settings/keys.ts`: acrescente `'openai_api_key'` ao `SECRET_SETTING_KEYS`; acrescente `'openai_model_imagem'`, `'openai_model_imagem_edicao'`, `'openai_qualidade_imagem'` e `'openrouter_model_instagram'` ao `PLAIN_SETTING_KEYS`; e em `SETTING_DEFAULTS`:

```ts
  openai_model_imagem: 'gpt-image-2.5-flare',
  openai_model_imagem_edicao: 'gpt-image-2.5-sunburst',
  openai_qualidade_imagem: 'high',
  openrouter_model_instagram: 'anthropic/claude-sonnet-4-5',
```

`execution/src/settings/store.ts`, depois de `resolveOpenRouterApiKey`:

```ts
/** Mesmo padrão do OpenRouter: valor criptografado no D1 vence o secret do worker. */
export async function resolveOpenAiApiKey(
  db: D1Database,
  encryptionKey: string,
  envFallback?: string,
): Promise<string | null> {
  const fromDb = await getSetting(db, 'openai_api_key', encryptionKey)
  return fromDb ?? envFallback ?? null
}
```

`workers/api/src/lib/settingsView.ts`: acrescente as 5 chaves ao fim de `ALL_KEYS` e ao `GROUP_MAP`:

```ts
  openai_api_key: 'geral',
  openai_model_imagem: 'geral',
  openai_model_imagem_edicao: 'geral',
  openai_qualidade_imagem: 'geral',
  openrouter_model_instagram: 'openrouter',
```

`workers/pipeline/src/index.ts`, em `PipelineBindings`, depois de `OPENROUTER_API_KEY: string`:

```ts
  /** GPT Image (posts de Instagram). Opcional: o valor em encrypted_settings vence. */
  OPENAI_API_KEY?: string
```

`scripts/push-worker-secrets.mjs`: na lista `pipeline`, depois de `'OPENROUTER_API_KEY',`, acrescente `'OPENAI_API_KEY',`. O script já ignora variáveis vazias no `.env`.

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npx vitest run execution/src/settings && npx tsc --noEmit -p execution && npx tsc --noEmit -p workers/api && npx tsc --noEmit -p workers/pipeline`
Expected: PASS; sem erros de tipo.

- [ ] **Step 5: Commit**

```bash
git add types/src/index.ts execution/src/settings workers/api/src/lib/settingsView.ts workers/pipeline/src/index.ts scripts/push-worker-secrets.mjs
git commit -m "feat(instagram): settings e secret da OpenAI"
```

---

### Task 3: Migration 010

**Files:**
- Create: `migrations/010_instagram.sql`
- Modify: `schema.sql`
- Modify: `execution/src/cloudflare/migrations.ts`
- Modify: `execution/src/cloudflare/d1Setup.ts`
- Modify: `package.json` (scripts)
- Test: `execution/src/cloudflare/migrations.instagram.test.ts`

**Interfaces:**
- Produces: `INSTAGRAM_STATEMENTS`, `IG_JOB_TIPOS`, `JOBS_IG_UPGRADE_STATEMENTS`, `LLM_USAGE_IG_COLUMN`, `INSTAGRAM_SETTINGS_STATEMENT`; `needsJobsIgUpgrade(db)`, `needsLlmUsageIgColumn(db)`; `applyD1Upgrades` passa a aplicar a 010.

- [ ] **Step 1: Teste que falha**

`execution/src/cloudflare/migrations.instagram.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { FakeD1 } from '../test-support/fakeD1.js'
import { applyD1Upgrades, needsJobsIgUpgrade, needsLlmUsageIgColumn } from './d1Setup.js'
import { IG_JOB_TIPOS, INSTAGRAM_STATEMENTS, JOBS_IG_UPGRADE_STATEMENTS, REQUIRED_TABLES } from './migrations.js'

const JOBS_ANTIGO = `CREATE TABLE jobs (id TEXT PRIMARY KEY, article_id TEXT, client_id TEXT, tipo TEXT NOT NULL CHECK(tipo IN ('pesquisar','revisar')))`
const JOBS_NOVO = `CREATE TABLE jobs (id TEXT PRIMARY KEY, client_id TEXT, ig_post_id TEXT, tipo TEXT NOT NULL CHECK(tipo IN ('pesquisar','revisar','ig_roteiro')))`

describe('migration 010 — Instagram', () => {
  it('tabelas novas são obrigatórias e criadas de forma idempotente', () => {
    for (const tabela of ['client_instagram', 'ig_posts', 'ig_slides']) {
      expect(REQUIRED_TABLES).toContain(tabela)
      expect(INSTAGRAM_STATEMENTS.some((s) => s.includes(`CREATE TABLE IF NOT EXISTS ${tabela}`))).toBe(true)
    }
    for (const sql of INSTAGRAM_STATEMENTS) expect(sql).toMatch(/IF NOT EXISTS/)
  })

  it('a reconstrução de jobs aceita os tipos de Instagram e preserva os antigos', () => {
    const create = JOBS_IG_UPGRADE_STATEMENTS[0]
    for (const tipo of IG_JOB_TIPOS) expect(create).toContain(`'${tipo}'`)
    expect(create).toContain('ig_post_id')
    expect(create).toContain("'revisar'")
    expect(JOBS_IG_UPGRADE_STATEMENTS[1]).toMatch(/SELECT id, article_id, client_id, tipo/)
  })

  it('detecta jobs e llm_usage sem ig_post_id', async () => {
    const antigo = new FakeD1([
      { match: /name='jobs'/, rows: [{ sql: JOBS_ANTIGO }] },
      { match: /name='llm_usage'/, rows: [{ sql: 'CREATE TABLE llm_usage (id TEXT)' }] },
    ])
    expect(await needsJobsIgUpgrade(antigo)).toBe(true)
    expect(await needsLlmUsageIgColumn(antigo)).toBe(true)

    const novo = new FakeD1([
      { match: /name='jobs'/, rows: [{ sql: JOBS_NOVO }] },
      { match: /name='llm_usage'/, rows: [{ sql: 'CREATE TABLE llm_usage (id TEXT, ig_post_id TEXT)' }] },
    ])
    expect(await needsJobsIgUpgrade(novo)).toBe(false)
    expect(await needsLlmUsageIgColumn(novo)).toBe(false)
  })

  it('applyD1Upgrades reconstrói jobs e adiciona a coluna quando faltam', async () => {
    const db = new FakeD1([
      { match: /name='jobs'/, rows: [{ sql: JOBS_ANTIGO }] },
      { match: /name='llm_usage'/, rows: [{ sql: 'CREATE TABLE llm_usage (id TEXT)' }] },
    ])
    await applyD1Upgrades(db)
    const sqls = db.executed.map((e) => e.sql)
    expect(sqls.some((s) => s.includes('CREATE TABLE IF NOT EXISTS jobs_ig_upgrade'))).toBe(true)
    expect(sqls).toContain(
      'ALTER TABLE llm_usage ADD COLUMN ig_post_id TEXT REFERENCES ig_posts(id) ON DELETE SET NULL',
    )
    expect(sqls.some((s) => s.includes("'openai_model_imagem'"))).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/cloudflare/migrations.instagram.test.ts`
Expected: FAIL (exports inexistentes)

- [ ] **Step 3: Implementar**

`migrations/010_instagram.sql`:

```sql
-- Migration 010: posts de Instagram (fatia A — geração).
-- Spec: docs/superpowers/specs/2026-10-06-instagram-posts-design.md
-- Rodar uma vez. Em banco que já passou pelo applyD1Upgrades, a 010 já está aplicada.

-- D1: adia a checagem de FK até o fim da transação (ver docs D1 migrations)
PRAGMA defer_foreign_keys = true;

-- 1) Vínculo do cliente com o Instagram. Na fatia A só o logo é gravado.
CREATE TABLE IF NOT EXISTS client_instagram (
    client_id         TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    ig_user_id        TEXT,
    ig_username       TEXT,
    page_id           TEXT,
    logo_material_id  TEXT REFERENCES client_materials(id) ON DELETE SET NULL,
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2) Posts
CREATE TABLE IF NOT EXISTS ig_posts (
    id              TEXT PRIMARY KEY,
    client_id       TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    formato         TEXT NOT NULL CHECK(formato IN ('estatico', 'carrossel')),
    num_slides      INTEGER NOT NULL CHECK(num_slides BETWEEN 1 AND 10),
    origem          TEXT NOT NULL CHECK(origem IN ('tema', 'artigo')),
    article_id      TEXT REFERENCES articles(id) ON DELETE SET NULL,
    briefing        TEXT,
    direcao_arte    TEXT,
    legenda         TEXT,
    hashtags        TEXT,
    status          TEXT NOT NULL DEFAULT 'gerando_roteiro'
                    CHECK(status IN ('gerando_roteiro', 'roteiro', 'gerando_artes', 'revisao',
                                     'agendado', 'publicando', 'publicado', 'erro')),
    agendado_para   TEXT,
    ig_creation_id  TEXT,
    ig_media_id     TEXT,
    ig_permalink    TEXT,
    publicado_em    TEXT,
    erro            TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ig_posts_client ON ig_posts(client_id, status);
CREATE INDEX IF NOT EXISTS idx_ig_posts_agenda ON ig_posts(status, agendado_para);

-- 3) Slides
CREATE TABLE IF NOT EXISTS ig_slides (
    id              TEXT PRIMARY KEY,
    post_id         TEXT NOT NULL REFERENCES ig_posts(id) ON DELETE CASCADE,
    ordem           INTEGER NOT NULL CHECK(ordem BETWEEN 1 AND 10),
    titulo          TEXT NOT NULL DEFAULT '',
    texto           TEXT NOT NULL DEFAULT '',
    ideia_visual    TEXT NOT NULL DEFAULT '',
    r2_key          TEXT,
    versao          INTEGER NOT NULL DEFAULT 0,
    token_publico   TEXT UNIQUE,
    status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK(status IN ('pendente', 'gerando', 'ok', 'erro')),
    erro            TEXT,
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(post_id, ordem)
);

-- 4) jobs: ig_post_id + tipos de Instagram. SQLite não altera CHECK: a tabela é reconstruída.
CREATE TABLE jobs_new (
    id              TEXT PRIMARY KEY,
    article_id      TEXT REFERENCES articles(id) ON DELETE CASCADE,
    client_id       TEXT REFERENCES clients(id) ON DELETE CASCADE,
    ig_post_id      TEXT REFERENCES ig_posts(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL
                    CHECK(tipo IN ('pesquisar', 'redigir', 'editar', 'imagem', 'revisar',
                                   'publicar', 'validar_links', 'sincronizar_corpus',
                                   'sugerir_pautas', 'ig_roteiro', 'ig_artes', 'ig_slide',
                                   'ig_publicar')),
    status          TEXT NOT NULL DEFAULT 'pendente'
                    CHECK(status IN ('pendente', 'rodando', 'ok', 'erro')),
    payload         TEXT,
    tentativas      INTEGER NOT NULL DEFAULT 0,
    erro            TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at     TEXT
);

INSERT INTO jobs_new (id, article_id, client_id, tipo, status, payload, tentativas, erro, created_at, finished_at)
SELECT id, article_id, client_id, tipo, status, payload, tentativas, erro, created_at, finished_at
FROM jobs;

DROP TABLE jobs;

ALTER TABLE jobs_new RENAME TO jobs;

CREATE INDEX IF NOT EXISTS idx_jobs_article ON jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_article_tipo ON jobs(article_id, tipo);
CREATE INDEX IF NOT EXISTS idx_jobs_ig_post ON jobs(ig_post_id);

-- 5) Custo por post de Instagram
ALTER TABLE llm_usage ADD COLUMN ig_post_id TEXT REFERENCES ig_posts(id) ON DELETE SET NULL;

-- 6) Modelos padrão
INSERT OR IGNORE INTO app_settings (key, value) VALUES
    ('openai_model_imagem', 'gpt-image-2.5-flare'),
    ('openai_model_imagem_edicao', 'gpt-image-2.5-sunburst'),
    ('openai_qualidade_imagem', 'high'),
    ('openrouter_model_instagram', 'anthropic/claude-sonnet-4-5');
```

`schema.sql`:
- Na tabela `jobs`, acrescente `ig_post_id TEXT REFERENCES ig_posts(id) ON DELETE CASCADE,` depois de `client_id` e troque o CHECK de `tipo` pelo da migration acima (com os 4 tipos `ig_*`). Depois de `idx_jobs_article_tipo`, acrescente `CREATE INDEX IF NOT EXISTS idx_jobs_ig_post ON jobs(ig_post_id);`.
- Na tabela `llm_usage`, depois de `custo_usd REAL,`, acrescente `ig_post_id TEXT REFERENCES ig_posts(id) ON DELETE SET NULL,`.
- No `INSERT` de `app_settings`, acrescente as 4 linhas de modelo da seção 6.
- No fim do arquivo, cole os blocos 1, 2 e 3 da migration (com comentário `-- Instagram (migration 010)`).

`execution/src/cloudflare/migrations.ts`, depois de `RADAR_FATIA1_STATEMENTS`:

```ts
/** Migration 010 (Instagram fatia A). Idempotente: entra no applyD1Upgrades. */
// Cópias de bootstrap omitem CHECK constraints por convenção; o DDL canônico está em schema.sql / migrations/010.
export const INSTAGRAM_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS client_instagram (
    client_id TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
    ig_user_id TEXT, ig_username TEXT, page_id TEXT,
    logo_material_id TEXT REFERENCES client_materials(id) ON DELETE SET NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS ig_posts (
    id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    formato TEXT NOT NULL, num_slides INTEGER NOT NULL, origem TEXT NOT NULL,
    article_id TEXT REFERENCES articles(id) ON DELETE SET NULL,
    briefing TEXT, direcao_arte TEXT, legenda TEXT, hashtags TEXT,
    status TEXT NOT NULL DEFAULT 'gerando_roteiro',
    agendado_para TEXT, ig_creation_id TEXT, ig_media_id TEXT, ig_permalink TEXT,
    publicado_em TEXT, erro TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE INDEX IF NOT EXISTS idx_ig_posts_client ON ig_posts(client_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_ig_posts_agenda ON ig_posts(status, agendado_para)`,
  `CREATE TABLE IF NOT EXISTS ig_slides (
    id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES ig_posts(id) ON DELETE CASCADE,
    ordem INTEGER NOT NULL, titulo TEXT NOT NULL DEFAULT '', texto TEXT NOT NULL DEFAULT '',
    ideia_visual TEXT NOT NULL DEFAULT '', r2_key TEXT, versao INTEGER NOT NULL DEFAULT 0,
    token_publico TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pendente', erro TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(post_id, ordem))`,
]

/** `ig_publicar` já entra no CHECK para a fatia B não reconstruir `jobs` de novo. */
export const IG_JOB_TIPOS = ['ig_roteiro', 'ig_artes', 'ig_slide', 'ig_publicar'] as const

/**
 * Migration 010: `jobs` ganha `ig_post_id` e os tipos de Instagram. SQLite não altera
 * CHECK, então a tabela é reconstruída — só quando a coluna falta (ver needsJobsIgUpgrade).
 */
export const JOBS_IG_UPGRADE_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS jobs_ig_upgrade (
    id TEXT PRIMARY KEY,
    article_id TEXT REFERENCES articles(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES clients(id) ON DELETE CASCADE,
    ig_post_id TEXT REFERENCES ig_posts(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL
      CHECK(tipo IN ('pesquisar', 'redigir', 'editar', 'imagem', 'revisar',
                     'publicar', 'validar_links', 'sincronizar_corpus', 'sugerir_pautas',
                     'ig_roteiro', 'ig_artes', 'ig_slide', 'ig_publicar')),
    status TEXT NOT NULL DEFAULT 'pendente'
      CHECK(status IN ('pendente', 'rodando', 'ok', 'erro')),
    payload TEXT, tentativas INTEGER NOT NULL DEFAULT 0, erro TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), finished_at TEXT)`,
  `INSERT INTO jobs_ig_upgrade (id, article_id, client_id, tipo, status, payload, tentativas, erro, created_at, finished_at)
    SELECT id, article_id, client_id, tipo, status, payload, tentativas, erro, created_at, finished_at
    FROM jobs`,
  `DROP TABLE jobs`,
  `ALTER TABLE jobs_ig_upgrade RENAME TO jobs`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_article ON jobs(article_id)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_client ON jobs(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_article_tipo ON jobs(article_id, tipo)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_ig_post ON jobs(ig_post_id)`,
]

/** Migration 010: custo por post. ADD COLUMN falha se a coluna existe (ver needsLlmUsageIgColumn). */
export const LLM_USAGE_IG_COLUMN =
  'ALTER TABLE llm_usage ADD COLUMN ig_post_id TEXT REFERENCES ig_posts(id) ON DELETE SET NULL'

/** Migration 010: modelos padrão. Idempotente. */
export const INSTAGRAM_SETTINGS_STATEMENT = `INSERT OR IGNORE INTO app_settings (key, value) VALUES
    ('openai_model_imagem', 'gpt-image-2.5-flare'),
    ('openai_model_imagem_edicao', 'gpt-image-2.5-sunburst'),
    ('openai_qualidade_imagem', 'high'),
    ('openrouter_model_instagram', 'anthropic/claude-sonnet-4-5')`
```

No `REQUIRED_TABLES`, depois de `'llm_usage',`, acrescente `'client_instagram'`, `'ig_posts'` e `'ig_slides'`.

`execution/src/cloudflare/d1Setup.ts`: importe `INSTAGRAM_STATEMENTS`, `JOBS_IG_UPGRADE_STATEMENTS`, `LLM_USAGE_IG_COLUMN` e `INSTAGRAM_SETTINGS_STATEMENT` de `./migrations.js` e acrescente, antes de `applyD1Upgrades`:

```ts
/** True quando `jobs` ainda não tem `ig_post_id` (migration 010). */
export async function needsJobsIgUpgrade(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='jobs'`)
    .first<{ sql: string | null }>()

  if (!row?.sql) return false
  return !/ig_post_id/.test(row.sql)
}

/** True quando `llm_usage` existe sem `ig_post_id` (migration 010). */
export async function needsLlmUsageIgColumn(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='llm_usage'`)
    .first<{ sql: string | null }>()

  if (!row?.sql) return false
  return !/ig_post_id/.test(row.sql)
}
```

Em `applyD1Upgrades`, depois do loop de `RADAR_FATIA1_STATEMENTS` e antes do `return`:

```ts
  // Migration 010: Instagram (tabelas novas, jobs com ig_post_id, custo por post)
  for (const sql of INSTAGRAM_STATEMENTS) {
    await db.prepare(sql).run()
    applied++
  }

  if (await needsJobsIgUpgrade(db)) {
    for (const sql of JOBS_IG_UPGRADE_STATEMENTS) {
      await db.prepare(sql).run()
      applied++
    }
  }

  if (await needsLlmUsageIgColumn(db)) {
    await db.prepare(LLM_USAGE_IG_COLUMN).run()
    applied++
  }

  await db.prepare(INSTAGRAM_SETTINGS_STATEMENT).run()
  applied++
```

`package.json`, depois de `cf:d1:migrate:009:remote`:

```json
    "cf:d1:migrate:010:local": "node scripts/cf-with-env.mjs npx wrangler d1 execute publisher-db --local --file=migrations/010_instagram.sql --config workers/api/wrangler.jsonc",
    "cf:d1:migrate:010:remote": "node scripts/cf-with-env.mjs npx wrangler d1 execute publisher-db --remote --file=migrations/010_instagram.sql --config workers/api/wrangler.jsonc",
```

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run execution/src/cloudflare && npx tsc --noEmit -p execution`
Expected: PASS, inclusive `migrations.radar.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add migrations/010_instagram.sql schema.sql execution/src/cloudflare package.json
git commit -m "feat(instagram): migration 010 com posts, slides e jobs ig_*"
```

---

### Task 4: Cliente da OpenAI Images API

**Files:**
- Create: `execution/src/openai/images.ts`
- Test: `execution/src/openai/images.test.ts`
- Modify: `execution/src/index.ts`

**Interfaces:**
- Consumes: `ErroDefinitivo` (Task 1), `base64ToBytes` (`execution/src/images/generate.ts`)
- Produces:
  - `type OpenAiQualidade = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto'`
  - `interface OpenAiImageUsage { textTokensIn: number; imageTokensIn: number; tokensOut: number }`
  - `interface OpenAiImageResult { bytes: Uint8Array; modelo: string; usage: OpenAiImageUsage }`
  - `gerarImagem(input: GerarImagemInput): Promise<OpenAiImageResult>`; `GerarImagemInput = { apiKey: string | null; model: string; prompt: string; size: string; quality: OpenAiQualidade; compression?: number }`
  - `editarImagem(input: GerarImagemInput & { imagens: Array<{ bytes: Uint8Array; contentType: string; nome: string }> })`
  - `custoImagemUsd(u: OpenAiImageUsage): number`
  - `class OpenAiModeracaoError`, `class OpenAiConfigError` (ambas `extends ErroDefinitivo`)

- [ ] **Step 1: Teste que falha**

`execution/src/openai/images.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErroDefinitivo } from '../erros.js'
import {
  OpenAiConfigError,
  OpenAiModeracaoError,
  custoImagemUsd,
  editarImagem,
  gerarImagem,
} from './images.js'

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 7])
const B64 = btoa(String.fromCharCode(...JPEG))

function resposta(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const OK = {
  data: [{ b64_json: B64 }],
  usage: {
    input_tokens: 1300,
    output_tokens: 4000,
    input_tokens_details: { text_tokens: 300, image_tokens: 1000 },
  },
}

const BASE = {
  apiKey: 'sk-test',
  model: 'gpt-image-2.5-flare',
  prompt: 'p',
  size: '1280x1600',
  quality: 'high' as const,
}

afterEach(() => vi.unstubAllGlobals())

describe('gerarImagem', () => {
  it('pede JPEG no tamanho informado e devolve bytes e uso', async () => {
    const fetchMock = vi.fn(async () => resposta(OK))
    vi.stubGlobal('fetch', fetchMock)

    const r = await gerarImagem(BASE)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/images/generations')
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'gpt-image-2.5-flare',
      size: '1280x1600',
      quality: 'high',
      output_format: 'jpeg',
      n: 1,
    })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test')
    expect([...r.bytes]).toEqual([...JPEG])
    expect(r.usage).toEqual({ textTokensIn: 300, imageTokensIn: 1000, tokensOut: 4000 })
  })

  it('sem chave falha como configuração, sem chamar a API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(gerarImagem({ ...BASE, apiKey: null })).rejects.toBeInstanceOf(OpenAiConfigError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('moderação e credencial são definitivas; 429 não', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta({ error: { code: 'moderation_blocked', message: 'blocked by safety system' } }, 400),
      ),
    )
    await expect(gerarImagem(BASE)).rejects.toBeInstanceOf(OpenAiModeracaoError)

    vi.stubGlobal('fetch', vi.fn(async () => resposta({ error: { message: 'bad key' } }, 401)))
    await expect(gerarImagem(BASE)).rejects.toBeInstanceOf(OpenAiConfigError)

    vi.stubGlobal('fetch', vi.fn(async () => resposta({ error: { message: 'slow down' } }, 429)))
    const err = await gerarImagem(BASE).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err).not.toBeInstanceOf(ErroDefinitivo)
  })
})

describe('editarImagem', () => {
  it('envia cada referência como image[] no multipart', async () => {
    const fetchMock = vi.fn(async () => resposta(OK))
    vi.stubGlobal('fetch', fetchMock)

    await editarImagem({
      ...BASE,
      imagens: [
        { bytes: JPEG, contentType: 'image/jpeg', nome: 'ref-1.jpg' },
        { bytes: JPEG, contentType: 'image/png', nome: 'ref-2.png' },
      ],
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.openai.com/v1/images/edits')
    const form = init.body as FormData
    expect(form.getAll('image[]')).toHaveLength(2)
    expect(form.get('size')).toBe('1280x1600')
    expect(form.get('output_format')).toBe('jpeg')
    // O fetch monta o boundary do multipart; Content-Type manual quebraria o corpo
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
  })

  it('sem referência é erro definitivo', async () => {
    await expect(editarImagem({ ...BASE, imagens: [] })).rejects.toBeInstanceOf(ErroDefinitivo)
  })
})

describe('custoImagemUsd', () => {
  it('soma texto, imagem de entrada e saída pelos preços por milhão', () => {
    expect(custoImagemUsd({ textTokensIn: 1000, imageTokensIn: 2000, tokensOut: 4000 })).toBe(0.141)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/openai/images.test.ts`
Expected: FAIL (módulo inexistente)

- [ ] **Step 3: Implementar**

`execution/src/openai/images.ts`:

```ts
/** Cliente da OpenAI Images API (GPT Image): geração e edição com imagens de referência. */
import { ErroDefinitivo } from '../erros.js'
import { base64ToBytes } from '../images/generate.js'

export const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images'

export type OpenAiQualidade = 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'auto'

export interface OpenAiImageUsage {
  textTokensIn: number
  imageTokensIn: number
  tokensOut: number
}

export interface OpenAiImageResult {
  bytes: Uint8Array
  modelo: string
  usage: OpenAiImageUsage
}

export interface OpenAiImagemEntrada {
  bytes: Uint8Array
  contentType: string
  nome: string
}

export interface GerarImagemInput {
  apiKey: string | null
  model: string
  prompt: string
  size: string
  quality: OpenAiQualidade
  /** 0–100, vale para jpeg/webp. */
  compression?: number
}

export interface EditarImagemInput extends GerarImagemInput {
  imagens: OpenAiImagemEntrada[]
}

export class OpenAiModeracaoError extends ErroDefinitivo {}
export class OpenAiConfigError extends ErroDefinitivo {}

/** USD por 1M de tokens, gpt-image-2.5 (flare e sunburst), conferido em 2026-10-06. */
export const OPENAI_IMAGEM_PRECO_POR_MILHAO = { textoIn: 5, imagemIn: 8, saida: 30 } as const

const COMPRESSAO_PADRAO = 90

export function custoImagemUsd(u: OpenAiImageUsage): number {
  const p = OPENAI_IMAGEM_PRECO_POR_MILHAO
  const usd = (u.textTokensIn * p.textoIn + u.imageTokensIn * p.imagemIn + u.tokensOut * p.saida) / 1_000_000
  return Math.round(usd * 1_000_000) / 1_000_000
}

function exigirChave(apiKey: string | null): string {
  const chave = apiKey?.trim()
  if (!chave) throw new OpenAiConfigError('OPENAI_API_KEY não configurada no worker do pipeline')
  return chave
}

async function falhar(res: Response): Promise<never> {
  const corpo = await res.text()
  let code = ''
  let mensagem = corpo
  try {
    const json = JSON.parse(corpo) as { error?: { code?: string | null; message?: string } }
    code = json.error?.code ?? ''
    mensagem = json.error?.message ?? corpo
  } catch {
    // corpo não-JSON: fica o texto cru
  }
  const resumo = mensagem.slice(0, 300)

  if (code === 'moderation_blocked' || /safety system/i.test(mensagem)) {
    throw new OpenAiModeracaoError(`OpenAI recusou o pedido pela moderação: ${resumo}`)
  }
  if (res.status === 401) throw new OpenAiConfigError('Chave da OpenAI inválida: confira OPENAI_API_KEY')
  if (res.status === 403) {
    throw new OpenAiConfigError(`OpenAI negou acesso ao modelo (organização verificada?): ${resumo}`)
  }
  // 400 é pedido malformado: repetir dá o mesmo erro
  if (res.status === 400) throw new ErroDefinitivo(`OpenAI 400: ${resumo}`)
  throw new Error(`OpenAI ${res.status}: ${resumo}`)
}

interface RespostaImagens {
  data?: Array<{ b64_json?: string }>
  usage?: {
    input_tokens?: number
    output_tokens?: number
    input_tokens_details?: { text_tokens?: number; image_tokens?: number }
  }
}

function lerResposta(data: RespostaImagens, modelo: string): OpenAiImageResult {
  const b64 = data.data?.[0]?.b64_json
  if (!b64) throw new Error('OpenAI respondeu sem imagem')
  const u = data.usage ?? {}
  const imageTokensIn = u.input_tokens_details?.image_tokens ?? 0
  const textTokensIn =
    u.input_tokens_details?.text_tokens ?? Math.max(0, (u.input_tokens ?? 0) - imageTokensIn)
  return {
    bytes: base64ToBytes(b64),
    modelo,
    usage: { textTokensIn, imageTokensIn, tokensOut: u.output_tokens ?? 0 },
  }
}

export async function gerarImagem(input: GerarImagemInput): Promise<OpenAiImageResult> {
  const chave = exigirChave(input.apiKey)
  const res = await fetch(`${OPENAI_IMAGES_URL}/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      size: input.size,
      quality: input.quality,
      n: 1,
      output_format: 'jpeg',
      output_compression: input.compression ?? COMPRESSAO_PADRAO,
    }),
  })
  if (!res.ok) await falhar(res)
  return lerResposta((await res.json()) as RespostaImagens, input.model)
}

export async function editarImagem(input: EditarImagemInput): Promise<OpenAiImageResult> {
  const chave = exigirChave(input.apiKey)
  if (input.imagens.length === 0) throw new ErroDefinitivo('Edição de imagem sem referência')

  const form = new FormData()
  form.append('model', input.model)
  form.append('prompt', input.prompt)
  form.append('size', input.size)
  form.append('quality', input.quality)
  form.append('n', '1')
  form.append('output_format', 'jpeg')
  form.append('output_compression', String(input.compression ?? COMPRESSAO_PADRAO))
  // Várias referências vão como campos `image[]` repetidos
  for (const img of input.imagens) {
    // Cópia em Uint8Array<ArrayBuffer>: o tipo do Blob recusa buffer compartilhado
    form.append('image[]', new Blob([new Uint8Array(img.bytes)], { type: img.contentType }), img.nome)
  }

  const res = await fetch(`${OPENAI_IMAGES_URL}/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}` },
    body: form,
  })
  if (!res.ok) await falhar(res)
  return lerResposta((await res.json()) as RespostaImagens, input.model)
}
```

Em `execution/src/index.ts`, depois de `export * from './images/generate.js'`:

```ts
export * from './openai/images.js'
```

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run execution/src/openai && npx tsc --noEmit -p execution`
Expected: 6 testes PASS; sem erro de tipo.

- [ ] **Step 5: Commit**

```bash
git add execution/src/openai execution/src/index.ts
git commit -m "feat(openai): cliente da Images API com custo por token"
```

---

### Task 5: Validação do roteiro

**Files:**
- Create: `execution/src/instagram/validar.ts`
- Test: `execution/src/instagram/validar.test.ts`

**Interfaces:**
- Consumes: `IG_LIMITES`, `IgRoteiro`, `IgRoteiroSlide` (Task 1)
- Produces: `contarCaracteres(texto: string): number`, `normalizarHashtag(valor: string): string`, `normalizarRoteiro(raw: unknown): IgRoteiro`, `validarRoteiro(roteiro: IgRoteiro, numSlides: number): string[]`

- [ ] **Step 1: Teste que falha**

`execution/src/instagram/validar.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizarHashtag, normalizarRoteiro, validarRoteiro } from './validar.js'

function roteiro(n = 3) {
  return {
    direcao_arte: 'Flat azul',
    slides: Array.from({ length: n }, (_, i) => ({ titulo: `T${i + 1}`, texto: '', ideia_visual: 'cena' })),
    legenda: 'Legenda',
    hashtags: ['#a'],
  }
}

describe('normalizarHashtag', () => {
  it('tira espaço, garante um # só e descarta vazio', () => {
    expect(normalizarHashtag('marketing digital')).toBe('#marketingdigital')
    expect(normalizarHashtag('##fibra')).toBe('#fibra')
    expect(normalizarHashtag('  ')).toBe('')
  })
})

describe('normalizarRoteiro', () => {
  it('tolera campos ausentes e remove hashtags repetidas', () => {
    const r = normalizarRoteiro({ slides: [{ titulo: ' Oi ' }, null], hashtags: ['a', '#a', 3] })
    expect(r.slides).toEqual([
      { titulo: 'Oi', texto: '', ideia_visual: '' },
      { titulo: '', texto: '', ideia_visual: '' },
    ])
    expect(r.hashtags).toEqual(['#a'])
    expect(r.direcao_arte).toBe('')
  })
})

describe('validarRoteiro', () => {
  it('roteiro válido não tem problema; texto vazio é permitido', () => {
    expect(validarRoteiro(roteiro(3), 3)).toEqual([])
  })

  it('conta acento como 1 caractere', () => {
    const r = roteiro(1)
    r.slides[0].titulo = 'ç'.repeat(60)
    expect(validarRoteiro(r, 1)).toEqual([])
    r.slides[0].titulo = 'ç'.repeat(61)
    expect(validarRoteiro(r, 1)).toEqual(['Slide 1: título com 61 caracteres (máx. 60)'])
  })

  it('nomeia cada problema', () => {
    const r = roteiro(2)
    r.slides[1].texto = 'x'.repeat(181)
    r.slides[1].ideia_visual = ''
    r.legenda = 'y'.repeat(2201)
    r.hashtags = Array.from({ length: 31 }, (_, i) => `#h${i}`)
    expect(validarRoteiro(r, 3)).toEqual([
      'Esperava 3 slide(s), veio 2',
      'Slide 2: texto com 181 caracteres (máx. 180)',
      'Slide 2: ideia visual vazia',
      'Legenda com 2201 caracteres (máx. 2200)',
      '31 hashtags (máx. 30)',
    ])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/instagram/validar.test.ts`
Expected: FAIL (módulo inexistente)

- [ ] **Step 3: Implementar**

`execution/src/instagram/validar.ts`:

```ts
/** Normalização e validação determinística do roteiro de Instagram. */
import { IG_LIMITES, type IgRoteiro, type IgRoteiroSlide } from '@publisher-p12/types'

/** Conta como o leitor vê: acento e emoji valem 1. */
export function contarCaracteres(texto: string): number {
  return [...texto].length
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/** `marketing digital` → `#marketingdigital`; vazio continua vazio. */
export function normalizarHashtag(valor: string): string {
  const limpo = valor.trim().replace(/\s+/g, '').replace(/^#+/, '')
  return limpo ? `#${limpo}` : ''
}

/** Blinda a saída do modelo: campo ausente vira string vazia, hashtags normalizadas e únicas. */
export function normalizarRoteiro(raw: unknown): IgRoteiro {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}

  const slides: IgRoteiroSlide[] = Array.isArray(obj.slides)
    ? obj.slides.map((s) => {
        const slide = s && typeof s === 'object' ? (s as Record<string, unknown>) : {}
        return {
          titulo: texto(slide.titulo),
          texto: texto(slide.texto),
          ideia_visual: texto(slide.ideia_visual),
        }
      })
    : []

  const hashtags = Array.isArray(obj.hashtags)
    ? [
        ...new Set(
          obj.hashtags
            .filter((h): h is string => typeof h === 'string')
            .map(normalizarHashtag)
            .filter(Boolean),
        ),
      ]
    : []

  return { direcao_arte: texto(obj.direcao_arte), slides, legenda: texto(obj.legenda), hashtags }
}

/** Problemas em PT-BR, na ordem em que aparecem; lista vazia = roteiro válido. */
export function validarRoteiro(roteiro: IgRoteiro, numSlides: number): string[] {
  const problemas: string[] = []

  if (!roteiro.direcao_arte) problemas.push('Direção de arte vazia')
  if (roteiro.slides.length !== numSlides) {
    problemas.push(`Esperava ${numSlides} slide(s), veio ${roteiro.slides.length}`)
  }

  roteiro.slides.forEach((slide, i) => {
    const n = i + 1
    if (!slide.titulo) problemas.push(`Slide ${n}: título vazio`)
    const t = contarCaracteres(slide.titulo)
    if (t > IG_LIMITES.titulo) {
      problemas.push(`Slide ${n}: título com ${t} caracteres (máx. ${IG_LIMITES.titulo})`)
    }
    const c = contarCaracteres(slide.texto)
    if (c > IG_LIMITES.texto) {
      problemas.push(`Slide ${n}: texto com ${c} caracteres (máx. ${IG_LIMITES.texto})`)
    }
    if (!slide.ideia_visual) problemas.push(`Slide ${n}: ideia visual vazia`)
  })

  if (!roteiro.legenda) problemas.push('Legenda vazia')
  const l = contarCaracteres(roteiro.legenda)
  if (l > IG_LIMITES.legenda) problemas.push(`Legenda com ${l} caracteres (máx. ${IG_LIMITES.legenda})`)
  if (roteiro.hashtags.length > IG_LIMITES.hashtags) {
    problemas.push(`${roteiro.hashtags.length} hashtags (máx. ${IG_LIMITES.hashtags})`)
  }

  return problemas
}
```

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run execution/src/instagram/validar.test.ts`
Expected: 5 testes PASS

- [ ] **Step 5: Commit**

```bash
git add execution/src/instagram/validar.ts execution/src/instagram/validar.test.ts
git commit -m "feat(instagram): validação e normalização do roteiro"
```

---
### Task 6: Agente roteirista

**Files:**
- Create: `execution/src/instagram/roteiro.ts`
- Test: `execution/src/instagram/roteiro.test.ts`

**Interfaces:**
- Consumes: `chatJson`, `OpenRouterMessage`, `OpenRouterOptions` (`openrouter/client.ts`); `renderPerfilParaPrompt` (`skill/perfil.ts`); `normalizarRoteiro`, `validarRoteiro` (Task 5); `ErroDefinitivo`
- Produces:
  - `interface ArtigoOrigem { titulo: string; conteudo_md: string; url: string | null }`
  - `interface RoteiristaInput { perfil: unknown; formato: IgFormato; numSlides: number; origem: IgOrigem; briefing?: string | null; artigo?: ArtigoOrigem | null; apiKey: string; model?: string; onUsage?: OpenRouterOptions['onUsage'] }`
  - `montarMensagensRoteiro(input): OpenRouterMessage[]`
  - `runRoteirista(input): Promise<IgRoteiro>` (lança `ErroDefinitivo` se a correção também falhar)
  - `MAX_ARTIGO_CHARS = 12_000`

- [ ] **Step 1: Teste que falha**

`execution/src/instagram/roteiro.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErroDefinitivo } from '../erros.js'
import { montarMensagensRoteiro, runRoteirista } from './roteiro.js'

function respostaModelo(conteudo: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify(conteudo) } }], usage: {} }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function roteiro(n: number) {
  return {
    direcao_arte: 'Fundo off-white, tipografia sans grossa, ilustrações flat em azul',
    slides: Array.from({ length: n }, (_, i) => ({
      titulo: `Título ${i + 1}`,
      texto: 'Texto curto',
      ideia_visual: 'Técnico instalando roteador',
    })),
    legenda: 'Legenda com CTA no final.',
    hashtags: ['#internet', 'fibra óptica'],
  }
}

const BASE = {
  perfil: { nome_empresa: 'ABX Telecom', tom_de_voz: 'consultivo' },
  formato: 'carrossel' as const,
  numSlides: 3,
  origem: 'tema' as const,
  briefing: 'Wi-Fi lento em casa',
  apiKey: 'k',
}

afterEach(() => vi.unstubAllGlobals())

describe('montarMensagensRoteiro', () => {
  it('leva perfil, quantidade de slides e o tema', () => {
    const [, user] = montarMensagensRoteiro(BASE)
    expect(user.content).toContain('ABX Telecom')
    expect(user.content).toContain('exatamente 3 slides')
    expect(user.content).toContain('Wi-Fi lento em casa')
  })

  it('origem artigo pede "link na bio" e corta artigo longo', () => {
    const [, user] = montarMensagensRoteiro({
      ...BASE,
      origem: 'artigo',
      artigo: { titulo: 'Guia de fibra', conteudo_md: 'x'.repeat(20_000), url: 'https://abx.com.br/guia' },
    })
    expect(user.content).toContain('link na bio')
    expect(user.content).toContain('https://abx.com.br/guia')
    expect(user.content.length).toBeLessThan(14_000)
  })
})

describe('runRoteirista', () => {
  it('devolve o roteiro normalizado quando vem válido', async () => {
    const fetchMock = vi.fn(async () => respostaModelo(roteiro(3)))
    vi.stubGlobal('fetch', fetchMock)

    const r = await runRoteirista(BASE)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(r.slides).toHaveLength(3)
    expect(r.hashtags).toEqual(['#internet', '#fibraóptica'])
  })

  it('pede uma correção quando a quantidade de slides não bate', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respostaModelo(roteiro(2)))
      .mockResolvedValueOnce(respostaModelo(roteiro(3)))
    vi.stubGlobal('fetch', fetchMock)

    const r = await runRoteirista(BASE)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const corpo = JSON.parse(String((fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body))
    expect(corpo.messages.at(-1).content).toContain('Esperava 3 slide(s), veio 2')
    expect(r.slides).toHaveLength(3)
  })

  it('erro definitivo quando a correção também falha', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respostaModelo(roteiro(2))))
    await expect(runRoteirista(BASE)).rejects.toBeInstanceOf(ErroDefinitivo)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/instagram/roteiro.test.ts`
Expected: FAIL (módulo inexistente)

- [ ] **Step 3: Implementar**

`execution/src/instagram/roteiro.ts`:

```ts
/** Agente roteirista: transforma tema ou artigo em roteiro de post/carrossel de Instagram. */
import { IG_LIMITES, type IgFormato, type IgOrigem, type IgRoteiro } from '@publisher-p12/types'
import { ErroDefinitivo } from '../erros.js'
import { chatJson, type OpenRouterMessage, type OpenRouterOptions } from '../openrouter/client.js'
import { renderPerfilParaPrompt } from '../skill/perfil.js'
import { normalizarRoteiro, validarRoteiro } from './validar.js'

/** Teto do artigo enviado ao modelo (~3k tokens): o carrossel resume, não reescreve. */
export const MAX_ARTIGO_CHARS = 12_000

export interface ArtigoOrigem {
  titulo: string
  conteudo_md: string
  url: string | null
}

export interface RoteiristaInput {
  perfil: unknown
  formato: IgFormato
  numSlides: number
  origem: IgOrigem
  briefing?: string | null
  artigo?: ArtigoOrigem | null
  apiKey: string
  model?: string
  onUsage?: OpenRouterOptions['onUsage']
}

const SYSTEM = `Você é roteirista de Instagram de uma agência brasileira. Escreve posts estáticos e carrosséis para o feed.

Regras:
- Fonte primária é o PERFIL DO CLIENTE. Não invente serviço, número, prêmio ou promessa que não esteja nele.
- Restrições legais, de compliance e informações proibidas do perfil vencem qualquer outra regra.
- Use o tom de voz do perfil. Português do Brasil com acentuação correta.
- Carrossel: o slide 1 é o gancho (capa); os do meio entregam o conteúdo, uma ideia por slide; o último é o CTA, escolhido entre os CTAs permitidos do perfil.
- Post estático: um slide só, com gancho e CTA curto.
- O texto de cada slide será desenhado dentro da arte, então seja curto: título até ${IG_LIMITES.titulo} caracteres, texto de apoio até ${IG_LIMITES.texto} (pode ficar vazio na capa).
- ideia_visual: a cena ou ilustração do slide em 1 ou 2 frases, sem repetir o texto.
- direcao_arte: um parágrafo que vale para todos os slides (paleta, tipografia, composição, estilo de ilustração ou foto), coerente com a diretriz visual do perfil.
- Legenda até ${IG_LIMITES.legenda} caracteres, com quebra de linha entre blocos e CTA no final. Link na legenda não é clicável.
- Hashtags: de 5 a 15, relevantes, sem espaço, nunca mais de ${IG_LIMITES.hashtags}.

Retorne só JSON: { "direcao_arte": "", "slides": [ { "titulo": "", "texto": "", "ideia_visual": "" } ], "legenda": "", "hashtags": ["#..."] }`

function blocoOrigem(input: RoteiristaInput): string {
  if (input.origem === 'artigo' && input.artigo) {
    const cabecalho = [
      'ORIGEM: artigo do blog do cliente. Resuma as ideias principais no post.',
      'O CTA final leva para o artigo: use "link na bio".',
      `Título: ${input.artigo.titulo}`,
      input.artigo.url ? `URL: ${input.artigo.url}` : null,
      input.briefing?.trim() ? `Instruções extras: ${input.briefing.trim()}` : null,
    ].filter((linha): linha is string => linha !== null)
    return `${cabecalho.join('\n')}\n\n${input.artigo.conteudo_md.slice(0, MAX_ARTIGO_CHARS)}`
  }
  return `ORIGEM: tema livre.\nTema e briefing: ${input.briefing?.trim() ?? ''}`
}

export function montarMensagensRoteiro(input: RoteiristaInput): OpenRouterMessage[] {
  const formato =
    input.formato === 'carrossel'
      ? `FORMATO: carrossel com exatamente ${input.numSlides} slides.`
      : 'FORMATO: post estático, exatamente 1 slide.'
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `PERFIL DO CLIENTE:\n${renderPerfilParaPrompt(input.perfil)}\n\n${formato}\n\n${blocoOrigem(input)}`,
    },
  ]
}

export async function runRoteirista(input: RoteiristaInput): Promise<IgRoteiro> {
  const mensagens = montarMensagensRoteiro(input)
  const chamar = (messages: OpenRouterMessage[]) =>
    chatJson<unknown>({
      apiKey: input.apiKey,
      model: input.model,
      messages,
      temperature: 0.6,
      maxTokens: 6000,
      onUsage: input.onUsage,
    })

  const primeiro = normalizarRoteiro(await chamar(mensagens))
  const problemas = validarRoteiro(primeiro, input.numSlides)
  if (problemas.length === 0) return primeiro

  // Uma correção guiada: o modelo recebe o próprio JSON e a lista do que quebrou
  const corrigido = normalizarRoteiro(
    await chamar([
      ...mensagens,
      { role: 'assistant', content: JSON.stringify(primeiro) },
      {
        role: 'user',
        content: `Corrija o roteiro e devolva o JSON completo. Problemas:\n- ${problemas.join('\n- ')}`,
      },
    ]),
  )
  const restantes = validarRoteiro(corrigido, input.numSlides)
  if (restantes.length > 0) {
    throw new ErroDefinitivo(`Roteiro inválido depois da correção: ${restantes.join('; ')}`)
  }
  return corrigido
}
```

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run execution/src/instagram/roteiro.test.ts`
Expected: 5 testes PASS

- [ ] **Step 5: Commit**

```bash
git add execution/src/instagram/roteiro.ts execution/src/instagram/roteiro.test.ts
git commit -m "feat(instagram): agente roteirista com uma correção guiada"
```

---

### Task 7: Prompts dos slides

**Files:**
- Create: `execution/src/instagram/prompt.ts`
- Test: `execution/src/instagram/prompt.test.ts`

**Interfaces:**
- Produces:
  - `type ReferenciaSlide = 'estilo' | 'logo'`
  - `interface SlideTexto { ordem: number; titulo: string; texto: string; ideia_visual: string }`
  - `referenciasDoSlide(ordem: number, total: number, temLogo: boolean): ReferenciaSlide[]`
  - `montarPromptSlide(input: { direcaoArte: string; diretrizVisual: string; slide: SlideTexto; total: number; referencias: ReferenciaSlide[] }): string`
  - `montarPromptCorrecao(instrucao: string): string`

- [ ] **Step 1: Teste que falha**

`execution/src/instagram/prompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { montarPromptCorrecao, montarPromptSlide, referenciasDoSlide } from './prompt.js'

const SLIDE = {
  ordem: 3,
  titulo: 'Manutenção preventiva',
  texto: 'Evite a queda do sinal',
  ideia_visual: 'Técnico com cabo de fibra',
}

describe('referenciasDoSlide', () => {
  it('capa sem estilo; meio só estilo; último estilo e logo', () => {
    expect(referenciasDoSlide(1, 5, true)).toEqual(['logo'])
    expect(referenciasDoSlide(3, 5, true)).toEqual(['estilo'])
    expect(referenciasDoSlide(5, 5, true)).toEqual(['estilo', 'logo'])
    expect(referenciasDoSlide(1, 5, false)).toEqual([])
    expect(referenciasDoSlide(1, 1, true)).toEqual(['logo'])
  })
})

describe('montarPromptSlide', () => {
  it('texto exato entre aspas, posição, margem e estilo da referência', () => {
    const p = montarPromptSlide({
      direcaoArte: 'Flat azul',
      diretrizVisual: 'Cores da marca',
      slide: SLIDE,
      total: 8,
      referencias: ['estilo'],
    })
    expect(p).toContain('Headline: "Manutenção preventiva"')
    expect(p).toContain('Body: "Evite a queda do sinal"')
    expect(p).toContain('Slide 3 of 8')
    expect(p).toContain('8% away from every edge')
    expect(p).toContain('reference image 1')
    expect(p).toContain('Do not draw any logo.')
  })

  it('índice do logo segue a ordem das referências', () => {
    const p = montarPromptSlide({
      direcaoArte: '',
      diretrizVisual: '',
      slide: { ...SLIDE, ordem: 8 },
      total: 8,
      referencias: ['estilo', 'logo'],
    })
    expect(p).toContain('logo from reference image 2')
    expect(p).not.toContain('Art direction')
  })

  it('post estático sem texto de apoio não tem linha Body', () => {
    const p = montarPromptSlide({
      direcaoArte: 'x',
      diretrizVisual: '',
      slide: { ...SLIDE, ordem: 1, texto: '' },
      total: 1,
      referencias: [],
    })
    expect(p).toContain('Single image post.')
    expect(p).not.toContain('Body:')
  })
})

describe('montarPromptCorrecao', () => {
  it('pede só a correção e preserva o resto', () => {
    const p = montarPromptCorrecao(" troque 'mantenção' por 'manutenção' ")
    expect(p).toContain(`"troque 'mantenção' por 'manutenção'"`)
    expect(p).toContain('Keep everything else identical')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/instagram/prompt.test.ts`
Expected: FAIL (módulo inexistente)

- [ ] **Step 3: Implementar**

`execution/src/instagram/prompt.ts`:

```ts
/** Prompts do GPT Image por slide. Instruções em inglês; o texto da arte em PT-BR, entre aspas. */

export type ReferenciaSlide = 'estilo' | 'logo'

export interface SlideTexto {
  ordem: number
  titulo: string
  texto: string
  ideia_visual: string
}

export interface PromptSlideInput {
  direcaoArte: string
  diretrizVisual: string
  slide: SlideTexto
  total: number
  /** Ordem das imagens enviadas à edição; vazio = geração do zero. */
  referencias: ReferenciaSlide[]
}

/** Slide 2..N copia o estilo da capa; o logo vai só na capa e no último. */
export function referenciasDoSlide(ordem: number, total: number, temLogo: boolean): ReferenciaSlide[] {
  const refs: ReferenciaSlide[] = []
  if (ordem > 1) refs.push('estilo')
  if (temLogo && (ordem === 1 || ordem === total)) refs.push('logo')
  return refs
}

/** Aspas duplas delimitam o texto da arte; as de dentro viram simples. */
function aspas(valor: string): string {
  return `"${valor.replace(/"/g, "'")}"`
}

export function montarPromptSlide(input: PromptSlideInput): string {
  const { slide, total, referencias } = input
  const estilo = referencias.indexOf('estilo') + 1
  const logo = referencias.indexOf('logo') + 1

  const linhas = [
    'Instagram feed post, portrait 4:5.',
    total > 1 ? `Slide ${slide.ordem} of ${total} of a carousel.` : 'Single image post.',
    input.direcaoArte.trim() ? `Art direction: ${input.direcaoArte.trim()}` : null,
    input.diretrizVisual.trim() ? `Brand visual guidelines: ${input.diretrizVisual.trim()}` : null,
    `Visual idea: ${slide.ideia_visual}`,
    'Render EXACTLY the following Brazilian Portuguese text, with correct accents and spelling, and no other text:',
    `Headline: ${aspas(slide.titulo)}`,
    slide.texto.trim() ? `Body: ${aspas(slide.texto.trim())}` : null,
    'Keep all text and important elements at least 8% away from every edge.',
    estilo
      ? `Use the same visual system as reference image ${estilo} (palette, typography, layout grid, illustration style), with new content.`
      : null,
    logo
      ? `Place the logo from reference image ${logo} small in a corner, without altering it.`
      : 'Do not draw any logo.',
  ]
  return linhas.filter((linha): linha is string => linha !== null).join('\n')
}

export function montarPromptCorrecao(instrucao: string): string {
  return [
    'Edit this image. Apply only this correction:',
    aspas(instrucao.trim()),
    'Keep everything else identical: layout, colors, typography and illustration.',
    'All text must stay in Brazilian Portuguese with correct accents and spelling.',
  ].join('\n')
}
```

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run execution/src/instagram/prompt.test.ts`
Expected: 5 testes PASS

- [ ] **Step 5: Commit**

```bash
git add execution/src/instagram/prompt.ts execution/src/instagram/prompt.test.ts
git commit -m "feat(instagram): prompts por slide e de correção"
```

---

### Task 8: Geração de um slide

**Files:**
- Create: `execution/src/instagram/imagem.ts`
- Test: `execution/src/instagram/imagem.test.ts`

**Interfaces:**
- Consumes: `gerarImagem`, `editarImagem`, `custoImagemUsd`, `OpenAiImageUsage`, `OpenAiQualidade` (Task 4); `ImageTransformerLike` (`images/generate.ts`); `ErroDefinitivo`
- Produces:
  - `IG_TAMANHO_GERACAO = '1280x1600'`, `IG_LARGURA = 1080`, `IG_ALTURA = 1350`, `LOGO_MIME_ACEITOS`
  - `interface ImagemReferencia { bytes: Uint8Array; contentType: string }`
  - `logoAceito(mime: string): boolean`
  - `gerarSlide(input: GerarSlideInput): Promise<GerarSlideResult>` com `GerarSlideInput = { apiKey: string | null; modelo: string; modeloEdicao: string; qualidade: OpenAiQualidade; modo: IgSlideModo; prompt: string; referencias: ImagemReferencia[]; transformer?: ImageTransformerLike }` e `GerarSlideResult = { bytes: Uint8Array; redimensionado: boolean; modelo: string; usage: OpenAiImageUsage; custoUsd: number }`

- [ ] **Step 1: Teste que falha**

`execution/src/instagram/imagem.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErroDefinitivo } from '../erros.js'
import type { ImageTransformerLike } from '../images/generate.js'
import { gerarSlide, logoAceito } from './imagem.js'

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 9])
const OK = {
  data: [{ b64_json: btoa(String.fromCharCode(...JPEG)) }],
  usage: { input_tokens: 100, output_tokens: 1000, input_tokens_details: { text_tokens: 100, image_tokens: 0 } },
}

function okFetch() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(OK), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function chamada(fetchMock: ReturnType<typeof okFetch>, i = 0) {
  return fetchMock.mock.calls[i] as unknown as [string, RequestInit]
}

function fakeTransformer(falhar = false) {
  const chamadas: Array<{ transform: Record<string, unknown>; output: Record<string, unknown> }> = []
  const transformer: ImageTransformerLike = {
    input() {
      let transform: Record<string, unknown> = {}
      const chain = {
        transform(t: Record<string, unknown>) {
          transform = t
          return chain
        },
        async output(o: { format: string; quality?: number }) {
          if (falhar) throw new Error('sem cota')
          chamadas.push({ transform, output: o })
          return { response: () => new Response(new Uint8Array([1, 2, 3])) }
        },
      }
      return chain
    },
  }
  return { transformer, chamadas }
}

const REF = { bytes: JPEG, contentType: 'image/jpeg' }
const BASE = {
  apiKey: 'sk',
  modelo: 'gpt-image-2.5-flare',
  modeloEdicao: 'gpt-image-2.5-sunburst',
  qualidade: 'high' as const,
  prompt: 'p',
}

afterEach(() => vi.unstubAllGlobals())

describe('gerarSlide', () => {
  it('sem referência gera do zero e recorta para 1080×1350 JPEG', async () => {
    const fetchMock = okFetch()
    const { transformer, chamadas } = fakeTransformer()

    const r = await gerarSlide({ ...BASE, modo: 'gerar', referencias: [], transformer })

    expect(chamada(fetchMock)[0]).toMatch(/\/generations$/)
    expect(JSON.parse(String(chamada(fetchMock)[1].body)).size).toBe('1280x1600')
    expect(chamadas[0]).toEqual({
      transform: { width: 1080, height: 1350, fit: 'cover' },
      output: { format: 'image/jpeg', quality: 85 },
    })
    expect([...r.bytes]).toEqual([1, 2, 3])
    expect(r.redimensionado).toBe(true)
    expect(r.custoUsd).toBe(0.0305)
  })

  it('com referências usa a edição e o modelo de geração', async () => {
    const fetchMock = okFetch()
    await gerarSlide({ ...BASE, modo: 'gerar', referencias: [REF, { ...REF, contentType: 'image/png' }] })
    const [url, init] = chamada(fetchMock)
    expect(url).toMatch(/\/edits$/)
    const form = init.body as FormData
    expect(form.get('model')).toBe('gpt-image-2.5-flare')
    expect(form.getAll('image[]')).toHaveLength(2)
  })

  it('corrigir usa o modelo de edição', async () => {
    const fetchMock = okFetch()
    await gerarSlide({ ...BASE, modo: 'corrigir', referencias: [REF] })
    expect((chamada(fetchMock)[1].body as FormData).get('model')).toBe('gpt-image-2.5-sunburst')
  })

  it('corrigir sem a imagem atual é erro definitivo, sem chamar a API', async () => {
    const fetchMock = okFetch()
    await expect(gerarSlide({ ...BASE, modo: 'corrigir', referencias: [] })).rejects.toBeInstanceOf(ErroDefinitivo)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sem o binding Images (ou com falha) entrega o JPEG original', async () => {
    okFetch()
    const { transformer } = fakeTransformer(true)
    const r = await gerarSlide({ ...BASE, modo: 'gerar', referencias: [], transformer })
    expect([...r.bytes]).toEqual([...JPEG])
    expect(r.redimensionado).toBe(false)
  })
})

describe('logoAceito', () => {
  it('aceita PNG, JPEG e WebP; recusa SVG e PDF', () => {
    expect(logoAceito('image/png')).toBe(true)
    expect(logoAceito('image/webp')).toBe(true)
    expect(logoAceito('image/svg+xml')).toBe(false)
    expect(logoAceito('application/pdf')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/instagram/imagem.test.ts`
Expected: FAIL (módulo inexistente)

- [ ] **Step 3: Implementar**

`execution/src/instagram/imagem.ts`:

```ts
/** Gera um slide: GPT Image (geração ou edição com referências) e recorte final 1080×1350. */
import type { IgSlideModo } from '@publisher-p12/types'
import { ErroDefinitivo } from '../erros.js'
import type { ImageTransformerLike } from '../images/generate.js'
import {
  custoImagemUsd,
  editarImagem,
  gerarImagem,
  type OpenAiImageUsage,
  type OpenAiQualidade,
} from '../openai/images.js'

/** 4:5 exato em múltiplos de 16, como a API exige. */
export const IG_TAMANHO_GERACAO = '1280x1600'
export const IG_LARGURA = 1080
export const IG_ALTURA = 1350
const IG_QUALIDADE_JPEG = 85

/** Formatos que a edição da OpenAI aceita como referência. SVG e PDF ficam de fora. */
export const LOGO_MIME_ACEITOS = ['image/png', 'image/jpeg', 'image/webp'] as const

export interface ImagemReferencia {
  bytes: Uint8Array
  contentType: string
}

export interface GerarSlideInput {
  apiKey: string | null
  modelo: string
  modeloEdicao: string
  qualidade: OpenAiQualidade
  modo: IgSlideModo
  prompt: string
  /** Na ordem de referenciasDoSlide. Em `corrigir`, só a imagem atual do slide. */
  referencias: ImagemReferencia[]
  transformer?: ImageTransformerLike
}

export interface GerarSlideResult {
  bytes: Uint8Array
  redimensionado: boolean
  modelo: string
  usage: OpenAiImageUsage
  custoUsd: number
}

const EXTENSAO: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export function logoAceito(mime: string): boolean {
  return (LOGO_MIME_ACEITOS as readonly string[]).includes(mime)
}

async function redimensionar(
  transformer: ImageTransformerLike | undefined,
  original: Uint8Array,
): Promise<{ bytes: Uint8Array; redimensionado: boolean }> {
  if (!transformer) return { bytes: original, redimensionado: false }
  try {
    const stream = new Response(original as BodyInit).body as ReadableStream<Uint8Array>
    const saida = await transformer
      .input(stream)
      .transform({ width: IG_LARGURA, height: IG_ALTURA, fit: 'cover' })
      .output({ format: 'image/jpeg', quality: IG_QUALIDADE_JPEG })
    return { bytes: new Uint8Array(await saida.response().arrayBuffer()), redimensionado: true }
  } catch {
    // Sem cota ou sem binding do Images: 1280×1600 também é 4:5 e o IG aceita
    return { bytes: original, redimensionado: false }
  }
}

export async function gerarSlide(input: GerarSlideInput): Promise<GerarSlideResult> {
  if (input.modo === 'corrigir' && input.referencias.length === 0) {
    throw new ErroDefinitivo('Corrigir exige a imagem atual do slide')
  }

  const modelo = input.modo === 'corrigir' ? input.modeloEdicao : input.modelo
  const comum = {
    apiKey: input.apiKey,
    model: modelo,
    prompt: input.prompt,
    size: IG_TAMANHO_GERACAO,
    quality: input.qualidade,
  }

  const resultado =
    input.referencias.length === 0
      ? await gerarImagem(comum)
      : await editarImagem({
          ...comum,
          imagens: input.referencias.map((ref, i) => ({
            bytes: ref.bytes,
            contentType: ref.contentType,
            nome: `ref-${i + 1}.${EXTENSAO[ref.contentType] ?? 'jpg'}`,
          })),
        })

  const final = await redimensionar(input.transformer, resultado.bytes)
  return {
    bytes: final.bytes,
    redimensionado: final.redimensionado,
    modelo: resultado.modelo,
    usage: resultado.usage,
    custoUsd: custoImagemUsd(resultado.usage),
  }
}
```

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run execution/src/instagram/imagem.test.ts`
Expected: 6 testes PASS

- [ ] **Step 5: Commit**

```bash
git add execution/src/instagram/imagem.ts execution/src/instagram/imagem.test.ts
git commit -m "feat(instagram): geração de slide com recorte 1080x1350"
```

---

### Task 9: Store D1 dos posts

**Files:**
- Create: `execution/src/instagram/store.ts`
- Test: `execution/src/instagram/store.test.ts`

**Interfaces:**
- Consumes: tipos e constantes IG (Task 1); `contarCaracteres`, `normalizarHashtag` (Task 5); `logoAceito` (Task 8)
- Produces:
  - `class IgEntradaInvalida extends Error` (a API devolve 400)
  - `interface IgPostRow`, `interface IgSlideRow`, `interface LogoRef { r2_key: string; mime_type: string }`
  - `rowToIgPost(row): IgPost`, `rowToIgSlide(row): IgSlide`
  - `chaveR2Slide(postId, ordem, versao): string`, `novoTokenPublico(): string`
  - `criarIgPost(db, input: CreateIgPostInput): Promise<IgPost>`
  - `getIgPost(db, id)`, `getIgPostDetalhe(db, id)`, `listIgPosts(db, filtro?)`, `apagarIgPost(db, id)`
  - `listIgSlideRows(db, postId)`, `getIgSlide(db, postId, ordem)`, `getIgSlideById(db, slideId)`
  - `setIgPostStatus(db, id, status, erro = null)`, `claimIgPostStatus(db, id, de: IgPostStatus[], para): Promise<boolean>`
  - `salvarRoteiro(db, postId, roteiro: IgRoteiro)`
  - `atualizarIgPost(db, post: IgPost, patch: UpdateIgPostInput)`, `atualizarTextoSlide(db, slide: IgSlideRow, campos: Partial<IgRoteiroSlide>)`
  - `marcarSlide(db, slideId, status, erro = null)`, `gravarImagemSlide(db, slideId, { r2Key, versao, token })`, `resetarSlides(db, postId)`
  - `postOcupado(db, postId): Promise<boolean>`, `fecharArtesSeProntas(db, postId): Promise<boolean>`
  - `getClientInstagram(db, clientId)`, `salvarLogoInstagram(db, clientId, logoMaterialId: string | null)`, `getLogoDoCliente(db, clientId): Promise<LogoRef | null>`

- [ ] **Step 1: Teste que falha**

`execution/src/instagram/store.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { IgPost } from '@publisher-p12/types'
import { FakeD1 } from '../test-support/fakeD1.js'
import type { D1PreparedStatement } from '../types/d1.js'
import {
  IgEntradaInvalida,
  atualizarIgPost,
  chaveR2Slide,
  claimIgPostStatus,
  criarIgPost,
  fecharArtesSeProntas,
  novoTokenPublico,
  rowToIgPost,
  salvarLogoInstagram,
  salvarRoteiro,
  type IgPostRow,
} from './store.js'

/** D1 em que nenhum UPDATE muda linha: simula o segundo clique depois de o primeiro mudar o status. */
class D1SemMudanca extends FakeD1 {
  prepare(sql: string): D1PreparedStatement {
    const stmt = super.prepare(sql)
    const embrulho: D1PreparedStatement = {
      bind: (...valores: unknown[]) => {
        stmt.bind(...valores)
        return embrulho
      },
      first: stmt.first,
      all: stmt.all,
      run: async () => {
        await stmt.run()
        return { meta: { changes: 0 } }
      },
    }
    return embrulho
  }
}

const COM_CLIENTE = [
  { match: /SELECT id FROM clients WHERE id/, rows: [{ id: 'c1' }] },
  { match: /SELECT id FROM articles WHERE id = \? AND client_id/, rows: [{ id: 'a1' }] },
]

function post(extra: Partial<IgPost> = {}): IgPost {
  return {
    id: 'p1', client_id: 'c1', formato: 'carrossel', num_slides: 3, origem: 'tema', article_id: null,
    briefing: 'b', direcao_arte: 'd', legenda: 'l', hashtags: [], status: 'roteiro', agendado_para: null,
    publicado_em: null, ig_permalink: null, erro: null, created_at: 't', updated_at: 't', ...extra,
  }
}

describe('criarIgPost', () => {
  it('recusa combinações inválidas com mensagem clara', async () => {
    const db = new FakeD1(COM_CLIENTE)
    const base = { client_id: 'c1', formato: 'carrossel' as const, num_slides: 6, origem: 'tema' as const, briefing: 'tema' }
    await expect(criarIgPost(db, { ...base, formato: 'estatico', num_slides: 3 })).rejects.toThrow('Post estático tem 1 slide')
    await expect(criarIgPost(db, { ...base, num_slides: 11 })).rejects.toThrow('Carrossel tem de 2 a 10 slides')
    await expect(criarIgPost(db, { ...base, briefing: '  ' })).rejects.toThrow('Descreva o tema do post')
    await expect(criarIgPost(db, { ...base, origem: 'artigo', briefing: null })).rejects.toThrow('Escolha o artigo de origem')
    await expect(criarIgPost(new FakeD1(), base)).rejects.toBeInstanceOf(IgEntradaInvalida)
  })

  it('cria em gerando_roteiro; tema não guarda artigo', async () => {
    const db = new FakeD1(COM_CLIENTE)
    const criado = await criarIgPost(db, { client_id: 'c1', formato: 'carrossel', num_slides: 6, origem: 'tema', briefing: ' Wi-Fi ', article_id: 'a1' })
    expect(criado.status).toBe('gerando_roteiro')
    const insert = db.executed.find((e) => e.sql.includes('INSERT INTO ig_posts'))
    expect(insert?.binds.slice(1, 7)).toEqual(['c1', 'carrossel', 6, 'tema', null, 'Wi-Fi'])
  })
})

describe('salvarRoteiro', () => {
  it('atualiza o post e recria os slides numa transação', async () => {
    const db = new FakeD1()
    await salvarRoteiro(db, 'p1', {
      direcao_arte: 'd',
      legenda: 'l',
      hashtags: ['#a'],
      slides: [
        { titulo: 'A', texto: '', ideia_visual: 'x' },
        { titulo: 'B', texto: '', ideia_visual: 'y' },
      ],
    })
    const lote = db.batches[0]
    expect(lote[0].sql).toContain("status = 'roteiro'")
    expect(lote[1].sql).toContain('DELETE FROM ig_slides')
    expect(lote.slice(2).map((e) => e.binds[2])).toEqual([1, 2])
  })
})

describe('atualizarIgPost', () => {
  it('em revisao só legenda e hashtags mudam', async () => {
    const db = new FakeD1()
    await expect(
      atualizarIgPost(db, post({ status: 'revisao' }), { slides: [{ ordem: 1, titulo: 'Novo' }] }),
    ).rejects.toBeInstanceOf(IgEntradaInvalida)
    await expect(
      atualizarIgPost(db, post({ status: 'revisao' }), { direcao_arte: 'x' }),
    ).rejects.toBeInstanceOf(IgEntradaInvalida)

    await atualizarIgPost(db, post({ status: 'revisao' }), { legenda: ' Nova ', hashtags: ['marketing digital', '#a', 'a'] })
    const update = db.batches[0][0]
    expect(update.sql).toContain('legenda = ?')
    expect(update.binds.slice(0, 2)).toEqual(['Nova', '["#marketingdigital","#a"]'])
  })

  it('em roteiro edita slide e respeita os limites', async () => {
    const db = new FakeD1()
    await atualizarIgPost(db, post(), { slides: [{ ordem: 2, titulo: ' Novo título ' }] })
    expect(db.batches[0][0].sql).toContain('UPDATE ig_slides SET titulo = ?')
    expect(db.batches[0][0].binds[0]).toBe('Novo título')

    await expect(
      atualizarIgPost(db, post(), { slides: [{ ordem: 2, titulo: 'x'.repeat(61) }] }),
    ).rejects.toThrow('Slide 2: título com 61 caracteres (máx. 60)')
  })

  it('fora de roteiro e revisao nada é editável', async () => {
    await expect(
      atualizarIgPost(new FakeD1(), post({ status: 'gerando_artes' }), { legenda: 'x' }),
    ).rejects.toThrow('Este post não pode ser editado agora')
  })
})

describe('transições de status', () => {
  it('claimIgPostStatus devolve false quando nenhuma linha muda', async () => {
    expect(await claimIgPostStatus(new FakeD1(), 'p1', ['roteiro'], 'gerando_artes')).toBe(true)
    expect(await claimIgPostStatus(new D1SemMudanca(), 'p1', ['roteiro'], 'gerando_artes')).toBe(false)
  })

  it('a junção só fecha gerando_artes sem slide pendente ou gerando', async () => {
    const db = new FakeD1()
    await fecharArtesSeProntas(db, 'p1')
    const [e] = db.executed
    expect(e.sql).toContain("status = 'gerando_artes'")
    expect(e.sql).toContain("NOT EXISTS (SELECT 1 FROM ig_slides WHERE post_id = ? AND status IN ('pendente', 'gerando'))")
    expect(e.binds.slice(1)).toEqual(['p1', 'p1'])
  })
})

describe('logo e utilitários', () => {
  it('logo precisa ser do cliente e em formato aceito', async () => {
    const svg = new FakeD1([{ match: /FROM client_materials/, rows: [{ mime_type: 'image/svg+xml' }] }])
    await expect(salvarLogoInstagram(svg, 'c1', 'm1')).rejects.toThrow('O logo precisa ser PNG, JPEG ou WebP')
    await expect(salvarLogoInstagram(new FakeD1(), 'c1', 'm1')).rejects.toThrow('Material não encontrado neste cliente')

    const png = new FakeD1([{ match: /FROM client_materials/, rows: [{ mime_type: 'image/png' }] }])
    await salvarLogoInstagram(png, 'c1', 'm1')
    expect(png.executed.at(-1)?.sql).toContain('ON CONFLICT(client_id)')
  })

  it('hashtags inválidas no banco viram lista vazia', () => {
    const row = { ...post(), hashtags: 'não é json' } as unknown as IgPostRow
    expect(rowToIgPost(row).hashtags).toEqual([])
  })

  it('chave R2 por versão e token de 64 hex', () => {
    expect(chaveR2Slide('p1', 3, 2)).toBe('instagram/p1/slide-3-v2.jpg')
    const a = novoTokenPublico()
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(novoTokenPublico()).not.toBe(a)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/instagram/store.test.ts`
Expected: FAIL (módulo inexistente)

- [ ] **Step 3: Implementar**

`execution/src/instagram/store.ts`:

```ts
/** Persistência dos posts de Instagram no D1 (ig_posts, ig_slides, client_instagram). */
import {
  IG_LIMITES,
  IG_MAX_SLIDES,
  IG_MIN_SLIDES_CARROSSEL,
  type ClientInstagram,
  type CreateIgPostInput,
  type IgFormato,
  type IgOrigem,
  type IgPost,
  type IgPostDetalhe,
  type IgPostStatus,
  type IgRoteiro,
  type IgRoteiroSlide,
  type IgSlide,
  type IgSlideStatus,
  type UpdateIgPostInput,
} from '@publisher-p12/types'
import type { D1Database, D1PreparedStatement } from '../types/d1.js'
import { logoAceito } from './imagem.js'
import { contarCaracteres, normalizarHashtag } from './validar.js'

/** Entrada recusada pela regra de negócio: a API devolve 400 com a mensagem. */
export class IgEntradaInvalida extends Error {}

export interface IgPostRow {
  id: string
  client_id: string
  formato: IgFormato
  num_slides: number
  origem: IgOrigem
  article_id: string | null
  briefing: string | null
  direcao_arte: string | null
  legenda: string | null
  hashtags: string | null
  status: IgPostStatus
  agendado_para: string | null
  publicado_em: string | null
  ig_permalink: string | null
  erro: string | null
  created_at: string
  updated_at: string
}

export interface IgSlideRow {
  id: string
  post_id: string
  ordem: number
  titulo: string
  texto: string
  ideia_visual: string
  r2_key: string | null
  versao: number
  token_publico: string | null
  status: IgSlideStatus
  erro: string | null
  updated_at: string
}

export interface LogoRef {
  r2_key: string
  mime_type: string
}

const CAMPOS_SLIDE = ['titulo', 'texto', 'ideia_visual'] as const

function agora(): string {
  return new Date().toISOString()
}

function parseHashtags(raw: string | null): string[] {
  if (!raw) return []
  try {
    const valor = JSON.parse(raw) as unknown
    return Array.isArray(valor) ? valor.filter((h): h is string => typeof h === 'string') : []
  } catch {
    return []
  }
}

export function rowToIgPost(row: IgPostRow): IgPost {
  return {
    id: row.id,
    client_id: row.client_id,
    formato: row.formato,
    num_slides: row.num_slides,
    origem: row.origem,
    article_id: row.article_id,
    briefing: row.briefing,
    direcao_arte: row.direcao_arte,
    legenda: row.legenda,
    hashtags: parseHashtags(row.hashtags),
    status: row.status,
    agendado_para: row.agendado_para,
    publicado_em: row.publicado_em,
    ig_permalink: row.ig_permalink,
    erro: row.erro,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function rowToIgSlide(row: IgSlideRow): IgSlide {
  return {
    id: row.id,
    post_id: row.post_id,
    ordem: row.ordem,
    titulo: row.titulo,
    texto: row.texto,
    ideia_visual: row.ideia_visual,
    versao: row.versao,
    tem_imagem: Boolean(row.r2_key),
    status: row.status,
    erro: row.erro,
    updated_at: row.updated_at,
  }
}

export function chaveR2Slide(postId: string, ordem: number, versao: number): string {
  return `instagram/${postId}/slide-${ordem}-v${versao}.jpg`
}

/** 32 bytes aleatórios em hex: base da URL pública da fatia B, impossível de adivinhar. */
export function novoTokenPublico(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function executarEmLote(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  if (stmts.length === 0) return
  if (db.batch) {
    await db.batch(stmts)
    return
  }
  for (const stmt of stmts) await stmt.run()
}

function checarLimitesSlide(campos: Partial<IgRoteiroSlide>, ordem: number): void {
  if (typeof campos.titulo === 'string') {
    const titulo = campos.titulo.trim()
    if (!titulo) throw new IgEntradaInvalida(`Slide ${ordem}: título vazio`)
    const t = contarCaracteres(titulo)
    if (t > IG_LIMITES.titulo) {
      throw new IgEntradaInvalida(`Slide ${ordem}: título com ${t} caracteres (máx. ${IG_LIMITES.titulo})`)
    }
  }
  if (typeof campos.texto === 'string') {
    const c = contarCaracteres(campos.texto.trim())
    if (c > IG_LIMITES.texto) {
      throw new IgEntradaInvalida(`Slide ${ordem}: texto com ${c} caracteres (máx. ${IG_LIMITES.texto})`)
    }
  }
}

function validarFormato(input: CreateIgPostInput): void {
  if (input.formato !== 'estatico' && input.formato !== 'carrossel') {
    throw new IgEntradaInvalida('Formato inválido')
  }
  if (input.formato === 'estatico' && input.num_slides !== 1) {
    throw new IgEntradaInvalida('Post estático tem 1 slide')
  }
  if (
    input.formato === 'carrossel' &&
    (!Number.isInteger(input.num_slides) ||
      input.num_slides < IG_MIN_SLIDES_CARROSSEL ||
      input.num_slides > IG_MAX_SLIDES)
  ) {
    throw new IgEntradaInvalida(`Carrossel tem de ${IG_MIN_SLIDES_CARROSSEL} a ${IG_MAX_SLIDES} slides`)
  }
  if (input.origem !== 'tema' && input.origem !== 'artigo') throw new IgEntradaInvalida('Origem inválida')
  if (input.origem === 'tema' && !input.briefing?.trim()) throw new IgEntradaInvalida('Descreva o tema do post')
  if (input.origem === 'artigo' && !input.article_id) throw new IgEntradaInvalida('Escolha o artigo de origem')
}

export async function criarIgPost(db: D1Database, input: CreateIgPostInput): Promise<IgPost> {
  validarFormato(input)

  const cliente = await db.prepare('SELECT id FROM clients WHERE id = ?').bind(input.client_id).first()
  if (!cliente) throw new IgEntradaInvalida('Cliente não encontrado')

  const articleId = input.origem === 'artigo' ? (input.article_id ?? null) : null
  if (articleId) {
    const artigo = await db
      .prepare('SELECT id FROM articles WHERE id = ? AND client_id = ?')
      .bind(articleId, input.client_id)
      .first()
    if (!artigo) throw new IgEntradaInvalida('Artigo não encontrado neste cliente')
  }

  const id = crypto.randomUUID()
  const ts = agora()
  const briefing = input.briefing?.trim() || null
  await db
    .prepare(
      `INSERT INTO ig_posts (id, client_id, formato, num_slides, origem, article_id, briefing, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'gerando_roteiro', ?, ?)`,
    )
    .bind(id, input.client_id, input.formato, input.num_slides, input.origem, articleId, briefing, ts, ts)
    .run()

  return {
    id,
    client_id: input.client_id,
    formato: input.formato,
    num_slides: input.num_slides,
    origem: input.origem,
    article_id: articleId,
    briefing,
    direcao_arte: null,
    legenda: null,
    hashtags: [],
    status: 'gerando_roteiro',
    agendado_para: null,
    publicado_em: null,
    ig_permalink: null,
    erro: null,
    created_at: ts,
    updated_at: ts,
  }
}

export async function getIgPost(db: D1Database, id: string): Promise<IgPost | null> {
  const row = await db.prepare('SELECT * FROM ig_posts WHERE id = ?').bind(id).first<IgPostRow>()
  return row ? rowToIgPost(row) : null
}

export async function listIgSlideRows(db: D1Database, postId: string): Promise<IgSlideRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM ig_slides WHERE post_id = ? ORDER BY ordem')
    .bind(postId)
    .all<IgSlideRow>()
  return results ?? []
}

export async function getIgSlide(db: D1Database, postId: string, ordem: number): Promise<IgSlideRow | null> {
  return db
    .prepare('SELECT * FROM ig_slides WHERE post_id = ? AND ordem = ?')
    .bind(postId, ordem)
    .first<IgSlideRow>()
}

export async function getIgSlideById(db: D1Database, slideId: string): Promise<IgSlideRow | null> {
  return db.prepare('SELECT * FROM ig_slides WHERE id = ?').bind(slideId).first<IgSlideRow>()
}

export async function getIgPostDetalhe(db: D1Database, id: string): Promise<IgPostDetalhe | null> {
  const post = await getIgPost(db, id)
  if (!post) return null
  const slides = await listIgSlideRows(db, id)
  return { ...post, slides: slides.map(rowToIgSlide) }
}

export async function listIgPosts(
  db: D1Database,
  filtro: { client_id?: string; status?: IgPostStatus } = {},
): Promise<IgPost[]> {
  const where: string[] = []
  const binds: unknown[] = []
  if (filtro.client_id) {
    where.push('client_id = ?')
    binds.push(filtro.client_id)
  }
  if (filtro.status) {
    where.push('status = ?')
    binds.push(filtro.status)
  }
  const sql = `SELECT * FROM ig_posts${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY updated_at DESC LIMIT 200`
  const { results } = await db.prepare(sql).bind(...binds).all<IgPostRow>()
  return (results ?? []).map(rowToIgPost)
}

export async function apagarIgPost(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM ig_posts WHERE id = ?').bind(id).run()
}

export async function setIgPostStatus(
  db: D1Database,
  id: string,
  status: IgPostStatus,
  erro: string | null = null,
): Promise<void> {
  await db
    .prepare('UPDATE ig_posts SET status = ?, erro = ?, updated_at = ? WHERE id = ?')
    .bind(status, erro, agora(), id)
    .run()
}

/** Troca o status só se o post estiver num dos estados de origem. Trava contra duplo clique. */
export async function claimIgPostStatus(
  db: D1Database,
  id: string,
  de: IgPostStatus[],
  para: IgPostStatus,
): Promise<boolean> {
  const marcas = de.map(() => '?').join(', ')
  const r = await db
    .prepare(`UPDATE ig_posts SET status = ?, erro = NULL, updated_at = ? WHERE id = ? AND status IN (${marcas})`)
    .bind(para, agora(), id, ...de)
    .run()
  return (r.meta?.changes ?? 0) > 0
}

/** Grava o roteiro e recria os slides como `pendente`, numa transação. */
export async function salvarRoteiro(db: D1Database, postId: string, roteiro: IgRoteiro): Promise<void> {
  const ts = agora()
  await executarEmLote(db, [
    db
      .prepare(
        `UPDATE ig_posts SET direcao_arte = ?, legenda = ?, hashtags = ?, status = 'roteiro', erro = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .bind(roteiro.direcao_arte, roteiro.legenda, JSON.stringify(roteiro.hashtags), ts, postId),
    db.prepare('DELETE FROM ig_slides WHERE post_id = ?').bind(postId),
    ...roteiro.slides.map((slide, i) =>
      db
        .prepare(
          `INSERT INTO ig_slides (id, post_id, ordem, titulo, texto, ideia_visual, status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pendente', ?)`,
        )
        .bind(crypto.randomUUID(), postId, i + 1, slide.titulo, slide.texto, slide.ideia_visual, ts),
    ),
  ])
}

/**
 * Regras da spec: em `roteiro` tudo é editável; em `revisao`, só legenda e hashtags.
 * Texto de slide com arte muda por "editar texto e regerar", para a arte não divergir do banco.
 */
export async function atualizarIgPost(db: D1Database, post: IgPost, patch: UpdateIgPostInput): Promise<void> {
  const mexeNoRoteiro = patch.direcao_arte !== undefined || (patch.slides?.length ?? 0) > 0
  if (post.status === 'revisao' && mexeNoRoteiro) {
    throw new IgEntradaInvalida('Na revisão, o texto do slide muda com "Editar texto" no próprio slide')
  }
  if (post.status !== 'roteiro' && post.status !== 'revisao') {
    throw new IgEntradaInvalida('Este post não pode ser editado agora')
  }

  const ts = agora()
  const stmts: D1PreparedStatement[] = []
  const sets: string[] = []
  const binds: unknown[] = []

  if (patch.direcao_arte !== undefined) {
    sets.push('direcao_arte = ?')
    binds.push(patch.direcao_arte.trim())
  }
  if (patch.legenda !== undefined) {
    const legenda = patch.legenda.trim()
    const l = contarCaracteres(legenda)
    if (l > IG_LIMITES.legenda) {
      throw new IgEntradaInvalida(`Legenda com ${l} caracteres (máx. ${IG_LIMITES.legenda})`)
    }
    sets.push('legenda = ?')
    binds.push(legenda)
  }
  if (patch.hashtags !== undefined) {
    const hashtags = [...new Set(patch.hashtags.map(normalizarHashtag).filter(Boolean))]
    if (hashtags.length > IG_LIMITES.hashtags) {
      throw new IgEntradaInvalida(`${hashtags.length} hashtags (máx. ${IG_LIMITES.hashtags})`)
    }
    sets.push('hashtags = ?')
    binds.push(JSON.stringify(hashtags))
  }
  if (sets.length) {
    stmts.push(
      db.prepare(`UPDATE ig_posts SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).bind(...binds, ts, post.id),
    )
  }

  for (const slide of patch.slides ?? []) {
    const campos = CAMPOS_SLIDE.filter((c) => typeof slide[c] === 'string')
    if (!campos.length) continue
    checarLimitesSlide(slide, slide.ordem)
    stmts.push(
      db
        .prepare(
          `UPDATE ig_slides SET ${campos.map((c) => `${c} = ?`).join(', ')}, updated_at = ?
           WHERE post_id = ? AND ordem = ?`,
        )
        .bind(...campos.map((c) => (slide[c] as string).trim()), ts, post.id, slide.ordem),
    )
  }

  await executarEmLote(db, stmts)
}

/** "Editar texto e regerar" na revisão: grava o texto novo antes de despachar o slide. */
export async function atualizarTextoSlide(
  db: D1Database,
  slide: IgSlideRow,
  campos: Partial<IgRoteiroSlide>,
): Promise<void> {
  const presentes = CAMPOS_SLIDE.filter((c) => typeof campos[c] === 'string')
  if (!presentes.length) return
  checarLimitesSlide(campos, slide.ordem)
  await db
    .prepare(`UPDATE ig_slides SET ${presentes.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
    .bind(...presentes.map((c) => (campos[c] as string).trim()), agora(), slide.id)
    .run()
}

export async function marcarSlide(
  db: D1Database,
  slideId: string,
  status: IgSlideStatus,
  erro: string | null = null,
): Promise<void> {
  await db
    .prepare('UPDATE ig_slides SET status = ?, erro = ?, updated_at = ? WHERE id = ?')
    .bind(status, erro, agora(), slideId)
    .run()
}

export async function gravarImagemSlide(
  db: D1Database,
  slideId: string,
  img: { r2Key: string; versao: number; token: string },
): Promise<void> {
  await db
    .prepare(
      `UPDATE ig_slides SET r2_key = ?, versao = ?, token_publico = ?, status = 'ok', erro = NULL, updated_at = ?
       WHERE id = ?`,
    )
    .bind(img.r2Key, img.versao, img.token, agora(), slideId)
    .run()
}

/** Falha definitiva da capa: todos voltam a `pendente` para o próximo "Gerar artes". */
export async function resetarSlides(db: D1Database, postId: string): Promise<void> {
  await db
    .prepare(`UPDATE ig_slides SET status = 'pendente', erro = NULL, updated_at = ? WHERE post_id = ?`)
    .bind(agora(), postId)
    .run()
}

/** Há slide na fila ou gerando: regerar/corrigir esperam, para não ler capa que está sendo trocada. */
export async function postOcupado(db: D1Database, postId: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM ig_slides WHERE post_id = ? AND status IN ('pendente', 'gerando')`)
    .bind(postId)
    .first<{ n: number }>()
  return (row?.n ?? 0) > 0
}

/**
 * Junção do fan-out: o último slide a terminar fecha o post. Um statement só, atômico no D1;
 * slide em `erro` não bloqueia (o usuário regera na revisão).
 */
export async function fecharArtesSeProntas(db: D1Database, postId: string): Promise<boolean> {
  const r = await db
    .prepare(
      `UPDATE ig_posts SET status = 'revisao', erro = NULL, updated_at = ?
       WHERE id = ? AND status = 'gerando_artes'
         AND NOT EXISTS (SELECT 1 FROM ig_slides WHERE post_id = ? AND status IN ('pendente', 'gerando'))`,
    )
    .bind(agora(), postId, postId)
    .run()
  return (r.meta?.changes ?? 0) > 0
}

export async function getClientInstagram(db: D1Database, clientId: string): Promise<ClientInstagram | null> {
  return db.prepare('SELECT * FROM client_instagram WHERE client_id = ?').bind(clientId).first<ClientInstagram>()
}

export async function salvarLogoInstagram(
  db: D1Database,
  clientId: string,
  logoMaterialId: string | null,
): Promise<void> {
  if (logoMaterialId) {
    const material = await db
      .prepare('SELECT mime_type FROM client_materials WHERE id = ? AND client_id = ?')
      .bind(logoMaterialId, clientId)
      .first<{ mime_type: string }>()
    if (!material) throw new IgEntradaInvalida('Material não encontrado neste cliente')
    if (!logoAceito(material.mime_type)) throw new IgEntradaInvalida('O logo precisa ser PNG, JPEG ou WebP')
  }

  await db
    .prepare(
      `INSERT INTO client_instagram (client_id, logo_material_id, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET logo_material_id = excluded.logo_material_id,
         updated_at = excluded.updated_at`,
    )
    .bind(clientId, logoMaterialId, agora())
    .run()
}

export async function getLogoDoCliente(db: D1Database, clientId: string): Promise<LogoRef | null> {
  return db
    .prepare(
      `SELECT m.r2_key, m.mime_type FROM client_instagram ci
       JOIN client_materials m ON m.id = ci.logo_material_id
       WHERE ci.client_id = ?`,
    )
    .bind(clientId)
    .first<LogoRef>()
}
```

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run execution/src/instagram/store.test.ts && npx tsc --noEmit -p execution`
Expected: PASS; sem erro de tipo.

- [ ] **Step 5: Commit**

```bash
git add execution/src/instagram/store.ts execution/src/instagram/store.test.ts
git commit -m "feat(instagram): store D1 de posts, slides e logo"
```

---

### Task 10: Fila dos jobs IG e custo por post

**Files:**
- Create: `execution/src/instagram/fila.ts`
- Test: `execution/src/instagram/fila.test.ts`
- Modify: `execution/src/usage/llmUsage.ts`
- Modify: `execution/src/usage/llmUsage.test.ts`

**Interfaces:**
- Consumes: `marcarSlide` (Task 9); `QueueMessage`, `IgSlideJobPayload`, `JobTipo` (Task 1)
- Produces:
  - `interface QueueLike { send(body: QueueMessage): Promise<unknown> }`
  - `type IgJobTipo = 'ig_roteiro' | 'ig_artes' | 'ig_slide'`
  - `enfileirarJobIg(db, queue, job: { clientId: string; igPostId: string; tipo: IgJobTipo; payload?: IgSlideJobPayload }): Promise<string>`
  - `despacharSlide(db, queue, alvo: { clientId: string; postId: string; slideId: string; payload: IgSlideJobPayload }): Promise<string>`
  - `marcarJobIg(db, jobId, status: 'rodando' | 'ok' | 'erro', erro?: string): Promise<void>`
  - `lerPayloadJob<T>(db, jobId): Promise<T | null>`
  - `LlmUsageContexto.igPostId?: string | null`

- [ ] **Step 1: Testes que falham**

`execution/src/instagram/fila.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { QueueMessage } from '@publisher-p12/types'
import { FakeD1 } from '../test-support/fakeD1.js'
import { despacharSlide, enfileirarJobIg, lerPayloadJob, marcarJobIg } from './fila.js'

function fila() {
  const enviados: QueueMessage[] = []
  return { enviados, queue: { send: async (m: QueueMessage) => void enviados.push(m) } }
}

describe('enfileirarJobIg', () => {
  it('grava o job com ig_post_id e manda a mensagem sem artigo', async () => {
    const db = new FakeD1()
    const { enviados, queue } = fila()

    const id = await enfileirarJobIg(db, queue, { clientId: 'c1', igPostId: 'p1', tipo: 'ig_slide', payload: { ordem: 2, modo: 'gerar' } })

    const insert = db.executed[0]
    expect(insert.sql).toContain('INSERT INTO jobs (id, client_id, ig_post_id, tipo')
    expect(insert.binds.slice(0, 5)).toEqual([id, 'c1', 'p1', 'ig_slide', '{"ordem":2,"modo":"gerar"}'])
    expect(enviados).toEqual([{ job_id: id, article_id: null, client_id: 'c1', ig_post_id: 'p1', tipo: 'ig_slide' }])
  })
})

describe('despacharSlide', () => {
  it('marca o slide como gerando antes de enfileirar', async () => {
    const db = new FakeD1()
    const { enviados, queue } = fila()
    await despacharSlide(db, queue, { clientId: 'c1', postId: 'p1', slideId: 's2', payload: { ordem: 2, modo: 'regerar' } })
    expect(db.executed[0].sql).toContain('UPDATE ig_slides SET status = ?')
    expect(db.executed[0].binds[0]).toBe('gerando')
    expect(enviados).toHaveLength(1)
  })
})

describe('marcarJobIg e lerPayloadJob', () => {
  it('só fecha finished_at em ok/erro', async () => {
    const db = new FakeD1()
    await marcarJobIg(db, 'j1', 'rodando')
    await marcarJobIg(db, 'j1', 'erro', 'falhou')
    expect(db.executed[0].binds.slice(0, 3)).toEqual(['rodando', null, null])
    expect(db.executed[1].binds[0]).toBe('erro')
    expect(db.executed[1].binds[1]).toBe('falhou')
    expect(String(db.executed[1].binds[2])).toMatch(/Z$/)
  })

  it('payload inválido vira null', async () => {
    const ok = new FakeD1([{ match: /SELECT payload FROM jobs/, rows: [{ payload: '{"ordem":1}' }] }])
    expect(await lerPayloadJob(ok, 'j1')).toEqual({ ordem: 1 })
    const ruim = new FakeD1([{ match: /SELECT payload FROM jobs/, rows: [{ payload: '{' }] }])
    expect(await lerPayloadJob(ruim, 'j1')).toBeNull()
  })
})
```

Em `execution/src/usage/llmUsage.test.ts`, dentro do `describe`, acrescente:

```ts
  it('nos agentes de Instagram grava também o ig_post_id', async () => {
    const db = new FakeD1()
    const gravar = llmUsageRecorder(db, { clientId: 'cli', articleId: null, jobId: 'job', agente: 'ig_imagem', igPostId: 'p1' })
    await gravar({ modelo: 'gpt-image-2.5-flare', tokensIn: 50, tokensOut: 500, custoUsd: 0.0153 })

    const insert = db.executed[0]
    expect(insert.sql).toContain('ig_post_id')
    expect(insert.binds.at(-1)).toBe('p1')
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/instagram/fila.test.ts execution/src/usage/llmUsage.test.ts`
Expected: FAIL (módulo inexistente; INSERT sem `ig_post_id`)

- [ ] **Step 3: Implementar**

`execution/src/instagram/fila.ts`:

```ts
/** Jobs de Instagram na fila do pipeline: linha em `jobs` + mensagem na Queue. */
import type { IgSlideJobPayload, JobTipo, QueueMessage } from '@publisher-p12/types'
import type { D1Database } from '../types/d1.js'
import { marcarSlide } from './store.js'

export interface QueueLike {
  send(body: QueueMessage): Promise<unknown>
}

export type IgJobTipo = Extract<JobTipo, 'ig_roteiro' | 'ig_artes' | 'ig_slide'>

export interface NovoJobIg {
  clientId: string
  igPostId: string
  tipo: IgJobTipo
  payload?: IgSlideJobPayload
}

export async function enfileirarJobIg(db: D1Database, queue: QueueLike, job: NovoJobIg): Promise<string> {
  const id = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO jobs (id, client_id, ig_post_id, tipo, status, payload, created_at)
       VALUES (?, ?, ?, ?, 'pendente', ?, ?)`,
    )
    .bind(id, job.clientId, job.igPostId, job.tipo, job.payload ? JSON.stringify(job.payload) : null, new Date().toISOString())
    .run()

  await queue.send({ job_id: id, article_id: null, client_id: job.clientId, ig_post_id: job.igPostId, tipo: job.tipo })
  return id
}

/** Marca o slide como `gerando` antes de enfileirar: retry e duplo clique enxergam o slide ocupado. */
export async function despacharSlide(
  db: D1Database,
  queue: QueueLike,
  alvo: { clientId: string; postId: string; slideId: string; payload: IgSlideJobPayload },
): Promise<string> {
  await marcarSlide(db, alvo.slideId, 'gerando')
  return enfileirarJobIg(db, queue, { clientId: alvo.clientId, igPostId: alvo.postId, tipo: 'ig_slide', payload: alvo.payload })
}

/** Mesmo contrato do updateJobStatus do pipeline: tentativas sobe a cada passagem. */
export async function marcarJobIg(
  db: D1Database,
  jobId: string,
  status: 'rodando' | 'ok' | 'erro',
  erro?: string,
): Promise<void> {
  const finishedAt = status === 'rodando' ? null : new Date().toISOString()
  await db
    .prepare(
      `UPDATE jobs SET status = ?, erro = ?, finished_at = COALESCE(?, finished_at),
       tentativas = tentativas + 1 WHERE id = ?`,
    )
    .bind(status, erro ?? null, finishedAt, jobId)
    .run()
}

export async function lerPayloadJob<T>(db: D1Database, jobId: string): Promise<T | null> {
  const row = await db.prepare('SELECT payload FROM jobs WHERE id = ?').bind(jobId).first<{ payload: string | null }>()
  if (!row?.payload) return null
  try {
    return JSON.parse(row.payload) as T
  } catch {
    return null
  }
}
```

`execution/src/usage/llmUsage.ts` (arquivo inteiro):

```ts
/** Grava o uso de cada chamada de LLM em llm_usage (custo por cliente/artigo/agente). */
import type { LlmUsage } from '../openrouter/client.js'
import type { D1Database } from '../types/d1.js'

export interface LlmUsageContexto {
  clientId: string | null
  articleId: string | null
  jobId: string | null
  agente: string
  /** Só nos agentes de Instagram; a coluna vem da migration 010. */
  igPostId?: string | null
}

export function llmUsageRecorder(db: D1Database, ctx: LlmUsageContexto): (u: LlmUsage) => Promise<void> {
  return async (u) => {
    const valores = [
      crypto.randomUUID(), ctx.clientId, ctx.articleId, ctx.jobId, ctx.agente,
      u.modelo, u.tokensIn, u.tokensOut, u.custoUsd, new Date().toISOString(),
    ]
    if (ctx.igPostId) {
      await db
        .prepare(
          `INSERT INTO llm_usage (id, client_id, article_id, job_id, agente, modelo, tokens_in, tokens_out, custo_usd, created_at, ig_post_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(...valores, ctx.igPostId)
        .run()
      return
    }
    await db
      .prepare(
        `INSERT INTO llm_usage (id, client_id, article_id, job_id, agente, modelo, tokens_in, tokens_out, custo_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(...valores)
      .run()
  }
}
```

- [ ] **Step 4: Rodar testes**

Run: `npx vitest run execution/src/instagram/fila.test.ts execution/src/usage`
Expected: PASS (inclusive o teste antigo do `llmUsageRecorder`)

- [ ] **Step 5: Commit**

```bash
git add execution/src/instagram/fila.ts execution/src/instagram/fila.test.ts execution/src/usage
git commit -m "feat(instagram): fila dos jobs ig_* e custo por post"
```

---

### Task 11: Orquestração dos jobs

**Files:**
- Create: `execution/src/instagram/orquestrar.ts`
- Test: `execution/src/instagram/orquestrar.test.ts`
- Modify: `execution/src/index.ts`

**Interfaces:**
- Consumes: tudo das Tasks 4–10; `normalizePerfilCliente`, `validatePerfilCliente` (`skill/perfil.ts`); `llmUsageRecorder`
- Produces:
  - `MAX_TENTATIVAS_FILA = 4`
  - `interface R2ObjetoLike { arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } }`
  - `interface R2Like { get(key: string): Promise<R2ObjetoLike | null>; put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>; delete(keys: string | string[]): Promise<void> }`
  - `interface IgDeps { db; r2: R2Like; queue: QueueLike; openRouterKey: string; openAiKey: string | null; modeloRoteiro: string; modeloImagem: string; modeloEdicao: string; qualidade: OpenAiQualidade; transformer?: ImageTransformerLike }`
  - `processIgJob(deps: IgDeps, msg: QueueMessage, tentativa: number): Promise<'ack' | 'retry'>`

- [ ] **Step 1: Teste que falha**

`execution/src/instagram/orquestrar.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IgSlideJobPayload, QueueMessage } from '@publisher-p12/types'
import { FakeD1 } from '../test-support/fakeD1.js'
import { MAX_TENTATIVAS_FILA, processIgJob, type IgDeps, type R2Like } from './orquestrar.js'
import type { IgPostRow, IgSlideRow } from './store.js'

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1])
const IMAGEM_OK = {
  data: [{ b64_json: btoa(String.fromCharCode(...JPEG)) }],
  usage: { input_tokens: 50, output_tokens: 500, input_tokens_details: { text_tokens: 50, image_tokens: 0 } },
}
const PERFIL = {
  nome_empresa: 'ABX Telecom',
  site: 'https://abx.com.br',
  tom_de_voz: 'consultivo',
  servicos: [{ nome: 'Fibra', url: 'https://abx.com.br/fibra' }],
  publico_alvo: 'PMEs',
  diretriz_visual: 'azul e branco',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function postRow(extra: Partial<IgPostRow> = {}): IgPostRow {
  return {
    id: 'p1', client_id: 'c1', formato: 'carrossel', num_slides: 3, origem: 'tema', article_id: null,
    briefing: 'Wi-Fi lento', direcao_arte: 'Flat azul', legenda: 'L', hashtags: '["#a"]',
    status: 'gerando_artes', agendado_para: null, publicado_em: null, ig_permalink: null, erro: null,
    created_at: 't', updated_at: 't', ...extra,
  }
}

function slideRow(ordem: number, extra: Partial<IgSlideRow> = {}): IgSlideRow {
  return {
    id: `s${ordem}`, post_id: 'p1', ordem, titulo: `Título ${ordem}`, texto: 'texto', ideia_visual: 'cena',
    r2_key: null, versao: 0, token_publico: null, status: 'pendente', erro: null, updated_at: 't', ...extra,
  }
}

interface Cenario {
  post?: IgPostRow
  slides?: IgSlideRow[]
  payload?: IgSlideJobPayload
  logo?: { r2_key: string; mime_type: string }
  artigo?: Record<string, unknown>
}

function montarDb(c: Cenario): FakeD1 {
  return new FakeD1([
    { match: /SELECT \* FROM ig_posts WHERE id/, rows: c.post ? [c.post] : [] },
    { match: /FROM ig_slides WHERE post_id = \? ORDER BY ordem/, rows: c.slides ?? [] },
    { match: /SELECT payload FROM jobs/, rows: c.payload ? [{ payload: JSON.stringify(c.payload) }] : [] },
    { match: /SELECT perfil_marca FROM clients/, rows: [{ perfil_marca: JSON.stringify(PERFIL) }] },
    { match: /FROM client_instagram ci/, rows: c.logo ? [c.logo] : [] },
    { match: /FROM articles WHERE id/, rows: c.artigo ? [c.artigo] : [] },
  ])
}

/** R2 em memória: chave → content-type do objeto inicial. */
function fakeR2(inicial: Record<string, string> = {}) {
  const objetos = new Map(
    Object.entries(inicial).map(([k, ct]) => [k, { bytes: JPEG, contentType: ct }] as const),
  )
  const apagados: string[] = []
  const r2: R2Like = {
    async get(key) {
      const o = objetos.get(key)
      return o
        ? { arrayBuffer: async () => o.bytes.slice().buffer as ArrayBuffer, httpMetadata: { contentType: o.contentType } }
        : null
    },
    async put(key, value, options) {
      objetos.set(key, { bytes: value, contentType: options?.httpMetadata?.contentType ?? '' })
      return null
    },
    async delete(keys) {
      for (const k of [keys].flat()) {
        objetos.delete(k)
        apagados.push(k)
      }
    },
  }
  return { r2, objetos, apagados }
}

function montarDeps(db: FakeD1, r2: R2Like) {
  const enviados: QueueMessage[] = []
  const deps: IgDeps = {
    db,
    r2,
    queue: { send: async (m) => void enviados.push(m) },
    openRouterKey: 'or',
    openAiKey: 'sk',
    modeloRoteiro: 'anthropic/claude-sonnet-4-5',
    modeloImagem: 'gpt-image-2.5-flare',
    modeloEdicao: 'gpt-image-2.5-sunburst',
    qualidade: 'high',
  }
  return { deps, enviados }
}

function msg(tipo: QueueMessage['tipo']): QueueMessage {
  return { job_id: 'j1', article_id: null, client_id: 'c1', ig_post_id: 'p1', tipo }
}

function stubFetch(op: { roteiro?: unknown; imagem?: { status: number; body: unknown } } = {}) {
  const fetchMock = vi.fn(async (url: string | URL | Request) => {
    const u = String(url)
    if (u.includes('openrouter.ai')) {
      return json({ choices: [{ message: { content: JSON.stringify(op.roteiro) } }], usage: {} })
    }
    if (u.includes('api.openai.com')) return op.imagem ? json(op.imagem.body, op.imagem.status) : json(IMAGEM_OK)
    throw new Error(`fetch inesperado: ${u}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const urls = (f: ReturnType<typeof stubFetch>) => f.mock.calls.map((c) => String(c[0]))
const chamada = (f: ReturnType<typeof stubFetch>, i = 0) => f.mock.calls[i] as unknown as [string, RequestInit]
const comSql = (db: FakeD1, trecho: string) => db.executed.filter((e) => e.sql.includes(trecho))
const statusDoPost = (db: FakeD1) => comSql(db, 'UPDATE ig_posts SET status = ?, erro = ?')

afterEach(() => vi.unstubAllGlobals())

describe('ig_roteiro', () => {
  it('grava o roteiro, recria os slides e registra o custo no post', async () => {
    const roteiro = {
      direcao_arte: 'Flat azul',
      slides: [1, 2, 3].map((n) => ({ titulo: `T${n}`, texto: 'x', ideia_visual: 'cena' })),
      legenda: 'Legenda',
      hashtags: ['#wifi'],
    }
    stubFetch({ roteiro })
    const db = montarDb({ post: postRow({ status: 'gerando_roteiro' }) })
    const { deps } = montarDeps(db, fakeR2().r2)

    expect(await processIgJob(deps, msg('ig_roteiro'), 1)).toBe('ack')

    const lote = db.batches[0].map((e) => e.sql)
    expect(lote[0]).toContain("status = 'roteiro'")
    expect(lote[1]).toContain('DELETE FROM ig_slides')
    expect(lote.filter((s) => s.includes('INSERT INTO ig_slides'))).toHaveLength(3)
    expect(comSql(db, 'INSERT INTO llm_usage').some((e) => e.sql.includes('ig_post_id'))).toBe(true)
    expect(comSql(db, 'UPDATE jobs').at(-1)?.binds[0]).toBe('ok')
  })

  it('artigo sem texto falha sem chamar o modelo', async () => {
    const fetchMock = stubFetch()
    const db = montarDb({
      post: postRow({ status: 'gerando_roteiro', origem: 'artigo', article_id: 'a1' }),
      artigo: { briefing: null, seo: null, conteudo_md: '', wp_url: null },
    })
    const { deps } = montarDeps(db, fakeR2().r2)

    expect(await processIgJob(deps, msg('ig_roteiro'), 1)).toBe('ack')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(statusDoPost(db).at(-1)?.binds.slice(0, 2)).toEqual(['erro', 'O artigo de origem ainda não tem texto'])
  })
})

describe('ig_artes', () => {
  it('gera a capa e despacha os demais slides', async () => {
    const fetchMock = stubFetch()
    const db = montarDb({ post: postRow(), slides: [slideRow(1), slideRow(2), slideRow(3)] })
    const { r2, objetos } = fakeR2()
    const { deps, enviados } = montarDeps(db, r2)

    expect(await processIgJob(deps, msg('ig_artes'), 1)).toBe('ack')

    expect(urls(fetchMock)).toEqual(['https://api.openai.com/v1/images/generations'])
    expect(objetos.has('instagram/p1/slide-1-v1.jpg')).toBe(true)
    expect(enviados.map((m) => [m.tipo, m.ig_post_id])).toEqual([['ig_slide', 'p1'], ['ig_slide', 'p1']])
    const payloads = comSql(db, 'INSERT INTO jobs').map((e) => JSON.parse(String(e.binds[4])))
    expect(payloads).toEqual([{ ordem: 2, modo: 'gerar' }, { ordem: 3, modo: 'gerar' }])
    expect(comSql(db, 'NOT EXISTS')).toHaveLength(1)
  })

  it('retry do ig_artes não regera a capa', async () => {
    const fetchMock = stubFetch()
    const db = montarDb({
      post: postRow(),
      slides: [
        slideRow(1, { status: 'ok', r2_key: 'instagram/p1/slide-1-v1.jpg', versao: 1 }),
        slideRow(2, { status: 'gerando' }),
        slideRow(3),
      ],
    })
    const { deps, enviados } = montarDeps(db, fakeR2().r2)

    expect(await processIgJob(deps, msg('ig_artes'), 2)).toBe('ack')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(enviados).toHaveLength(1)
  })

  it('ignora logo em formato que a OpenAI não aceita', async () => {
    const fetchMock = stubFetch()
    const db = montarDb({
      post: postRow(),
      slides: [slideRow(1)],
      logo: { r2_key: 'materials/logo.svg', mime_type: 'image/svg+xml' },
    })
    const { deps } = montarDeps(db, fakeR2({ 'materials/logo.svg': 'image/svg+xml' }).r2)

    await processIgJob(deps, msg('ig_artes'), 1)

    expect(urls(fetchMock)).toEqual(['https://api.openai.com/v1/images/generations'])
    expect(JSON.parse(String(chamada(fetchMock)[1].body)).prompt).toContain('Do not draw any logo.')
  })

  it('logo PNG entra como referência da capa', async () => {
    const fetchMock = stubFetch()
    const db = montarDb({
      post: postRow(),
      slides: [slideRow(1)],
      logo: { r2_key: 'materials/logo.png', mime_type: 'image/png' },
    })
    const { deps } = montarDeps(db, fakeR2({ 'materials/logo.png': 'image/png' }).r2)

    await processIgJob(deps, msg('ig_artes'), 1)

    const [url, init] = chamada(fetchMock)
    expect(url).toMatch(/\/edits$/)
    expect((init.body as FormData).getAll('image[]')).toHaveLength(1)
    expect(String((init.body as FormData).get('prompt'))).toContain('logo from reference image 1')
  })

  it('falha definitiva na capa devolve o post ao roteiro', async () => {
    stubFetch({ imagem: { status: 400, body: { error: { code: 'moderation_blocked', message: 'blocked' } } } })
    const db = montarDb({ post: postRow(), slides: [slideRow(1), slideRow(2), slideRow(3)] })
    const { deps, enviados } = montarDeps(db, fakeR2().r2)

    expect(await processIgJob(deps, msg('ig_artes'), 1)).toBe('ack')

    expect(enviados).toHaveLength(0)
    expect(comSql(db, "SET status = 'pendente'")).toHaveLength(1)
    const ultimo = statusDoPost(db).at(-1)
    expect(ultimo?.binds[0]).toBe('roteiro')
    expect(String(ultimo?.binds[1])).toContain('moderação')
  })

  it('erro transitório volta para a fila até a última tentativa', async () => {
    stubFetch({ imagem: { status: 500, body: { error: { message: 'boom' } } } })
    const db = montarDb({ post: postRow(), slides: [slideRow(1)] })
    const { deps } = montarDeps(db, fakeR2().r2)

    expect(await processIgJob(deps, msg('ig_artes'), 1)).toBe('retry')
    expect(statusDoPost(db)).toHaveLength(0)

    expect(await processIgJob(deps, msg('ig_artes'), MAX_TENTATIVAS_FILA)).toBe('ack')
    expect(statusDoPost(db).at(-1)?.binds[0]).toBe('roteiro')
  })
})

describe('ig_slide', () => {
  it('slide do meio usa a capa como referência', async () => {
    const fetchMock = stubFetch()
    const db = montarDb({
      post: postRow(),
      slides: [slideRow(1, { status: 'ok', r2_key: 'k1', versao: 1 }), slideRow(2, { status: 'gerando' })],
      payload: { ordem: 2, modo: 'gerar' },
    })
    const { r2, objetos } = fakeR2({ k1: 'image/jpeg' })
    const { deps } = montarDeps(db, r2)

    expect(await processIgJob(deps, msg('ig_slide'), 1)).toBe('ack')

    const [url, init] = chamada(fetchMock)
    expect(url).toMatch(/\/edits$/)
    expect((init.body as FormData).getAll('image[]')).toHaveLength(1)
    expect(objetos.has('instagram/p1/slide-2-v1.jpg')).toBe(true)
    expect(comSql(db, 'NOT EXISTS')).toHaveLength(1)
  })

  it('corrigir usa o modelo de edição sobre a arte atual e apaga a versão anterior', async () => {
    const fetchMock = stubFetch()
    const db = montarDb({
      post: postRow({ status: 'revisao' }),
      slides: [
        slideRow(1, { status: 'ok', r2_key: 'k1', versao: 1 }),
        slideRow(2, { status: 'gerando', r2_key: 'instagram/p1/slide-2-v1.jpg', versao: 1 }),
      ],
      payload: { ordem: 2, modo: 'corrigir', instrucao: "troque 'mantenção' por 'manutenção'" },
    })
    const { r2, objetos, apagados } = fakeR2({ k1: 'image/jpeg', 'instagram/p1/slide-2-v1.jpg': 'image/jpeg' })
    const { deps } = montarDeps(db, r2)

    await processIgJob(deps, msg('ig_slide'), 1)

    const form = chamada(fetchMock)[1].body as FormData
    expect(form.get('model')).toBe('gpt-image-2.5-sunburst')
    expect(String(form.get('prompt'))).toContain('manutenção')
    expect(objetos.has('instagram/p1/slide-2-v2.jpg')).toBe(true)
    expect(apagados).toEqual(['instagram/p1/slide-2-v1.jpg'])
  })

  it('regerar a capa com cascata redespacha os demais', async () => {
    stubFetch()
    const db = montarDb({
      post: postRow({ status: 'revisao' }),
      slides: [
        slideRow(1, { status: 'gerando', r2_key: 'k1', versao: 1 }),
        slideRow(2, { status: 'ok', r2_key: 'k2', versao: 1 }),
        slideRow(3, { status: 'ok', r2_key: 'k3', versao: 1 }),
      ],
      payload: { ordem: 1, modo: 'regerar', cascata: true },
    })
    const { deps, enviados } = montarDeps(db, fakeR2({ k1: 'image/jpeg', k2: 'image/jpeg', k3: 'image/jpeg' }).r2)

    expect(await processIgJob(deps, msg('ig_slide'), 1)).toBe('ack')

    expect(statusDoPost(db).map((e) => e.binds[0])).toContain('gerando_artes')
    expect(enviados).toHaveLength(2)
    expect(comSql(db, 'INSERT INTO jobs').map((e) => JSON.parse(String(e.binds[4])))).toEqual([
      { ordem: 2, modo: 'regerar' },
      { ordem: 3, modo: 'regerar' },
    ])
  })

  it('falha definitiva marca o slide e roda a junção', async () => {
    stubFetch({ imagem: { status: 401, body: { error: { message: 'bad key' } } } })
    const db = montarDb({
      post: postRow(),
      slides: [slideRow(1, { status: 'ok', r2_key: 'k1', versao: 1 }), slideRow(2, { status: 'gerando' })],
      payload: { ordem: 2, modo: 'gerar' },
    })
    const { deps } = montarDeps(db, fakeR2({ k1: 'image/jpeg' }).r2)

    expect(await processIgJob(deps, msg('ig_slide'), 1)).toBe('ack')

    const erroDoSlide = comSql(db, 'UPDATE ig_slides SET status = ?').at(-1)
    expect(erroDoSlide?.binds[0]).toBe('erro')
    expect(String(erroDoSlide?.binds[1])).toContain('OPENAI_API_KEY')
    expect(comSql(db, 'NOT EXISTS')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run execution/src/instagram/orquestrar.test.ts`
Expected: FAIL (módulo inexistente)

- [ ] **Step 3: Implementar**

`execution/src/instagram/orquestrar.ts`:

```ts
/** Orquestra os jobs de Instagram (roteiro, artes, slide). O worker do pipeline só injeta dependências. */
import type { IgPost, IgSlideJobPayload, IgSlideModo, JobTipo, QueueMessage } from '@publisher-p12/types'
import { ErroDefinitivo } from '../erros.js'
import type { ImageTransformerLike } from '../images/generate.js'
import type { OpenAiQualidade } from '../openai/images.js'
import { normalizePerfilCliente, validatePerfilCliente } from '../skill/perfil.js'
import type { D1Database } from '../types/d1.js'
import { llmUsageRecorder } from '../usage/llmUsage.js'
import { despacharSlide, lerPayloadJob, marcarJobIg, type QueueLike } from './fila.js'
import { gerarSlide, logoAceito, type ImagemReferencia } from './imagem.js'
import { montarPromptCorrecao, montarPromptSlide, referenciasDoSlide } from './prompt.js'
import { runRoteirista, type ArtigoOrigem } from './roteiro.js'
import {
  chaveR2Slide,
  fecharArtesSeProntas,
  getIgPost,
  getLogoDoCliente,
  gravarImagemSlide,
  listIgSlideRows,
  marcarSlide,
  novoTokenPublico,
  resetarSlides,
  salvarRoteiro,
  setIgPostStatus,
  type IgSlideRow,
} from './store.js'

/** `max_retries: 3` no wrangler do pipeline = até 4 entregas da mesma mensagem. */
export const MAX_TENTATIVAS_FILA = 4

export interface R2ObjetoLike {
  arrayBuffer(): Promise<ArrayBuffer>
  httpMetadata?: { contentType?: string }
}

/** Subconjunto do binding R2 usado aqui (o `IMAGES` do pipeline). */
export interface R2Like {
  get(key: string): Promise<R2ObjetoLike | null>
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
}

export interface IgDeps {
  db: D1Database
  r2: R2Like
  queue: QueueLike
  openRouterKey: string
  openAiKey: string | null
  modeloRoteiro: string
  modeloImagem: string
  modeloEdicao: string
  qualidade: OpenAiQualidade
  transformer?: ImageTransformerLike
}

interface Ctx {
  jobId: string
  postId: string
}

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function lerPerfil(db: D1Database, clientId: string): Promise<unknown> {
  const row = await db
    .prepare('SELECT perfil_marca FROM clients WHERE id = ?')
    .bind(clientId)
    .first<{ perfil_marca: string | null }>()
  return parseJson<unknown>(row?.perfil_marca)
}

async function exigirPost(db: D1Database, postId: string): Promise<IgPost> {
  const post = await getIgPost(db, postId)
  if (!post) throw new ErroDefinitivo('Post de Instagram não encontrado')
  return post
}

async function carregarArtigo(db: D1Database, articleId: string | null): Promise<ArtigoOrigem> {
  const row = articleId
    ? await db
        .prepare('SELECT briefing, seo, conteudo_md, wp_url FROM articles WHERE id = ?')
        .bind(articleId)
        .first<{ briefing: string | null; seo: string | null; conteudo_md: string | null; wp_url: string | null }>()
    : null
  if (!row) throw new ErroDefinitivo('Artigo de origem não encontrado (foi apagado?)')
  if (!row.conteudo_md?.trim()) throw new ErroDefinitivo('O artigo de origem ainda não tem texto')

  const seo = parseJson<{ titulo_seo?: string }>(row.seo)
  const briefing = parseJson<{ tema?: string }>(row.briefing)
  return { titulo: seo?.titulo_seo || briefing?.tema || 'Artigo', conteudo_md: row.conteudo_md, url: row.wp_url }
}

async function lerImagem(r2: R2Like, chave: string): Promise<ImagemReferencia> {
  const obj = await r2.get(chave)
  if (!obj) throw new ErroDefinitivo(`Imagem não encontrada no R2 (${chave})`)
  return {
    bytes: new Uint8Array(await obj.arrayBuffer()),
    contentType: obj.httpMetadata?.contentType || 'image/jpeg',
  }
}

/** Logo vem dos Materiais. Formato que a OpenAI não aceita é ignorado: a arte sai sem logo. */
async function carregarLogo(deps: IgDeps, clientId: string): Promise<ImagemReferencia | null> {
  const ref = await getLogoDoCliente(deps.db, clientId)
  if (!ref || !logoAceito(ref.mime_type)) return null
  const obj = await deps.r2.get(ref.r2_key)
  if (!obj) return null
  return { bytes: new Uint8Array(await obj.arrayBuffer()), contentType: ref.mime_type }
}

async function executarIgRoteiro(deps: IgDeps, ctx: Ctx): Promise<void> {
  const post = await exigirPost(deps.db, ctx.postId)

  const perfil = await lerPerfil(deps.db, post.client_id)
  const validacao = validatePerfilCliente(perfil)
  if (!validacao.ok) throw new ErroDefinitivo(validacao.mensagem)

  // Antes de qualquer chamada paga: artigo sem texto é erro definitivo
  const artigo = post.origem === 'artigo' ? await carregarArtigo(deps.db, post.article_id) : null

  const roteiro = await runRoteirista({
    perfil,
    formato: post.formato,
    numSlides: post.num_slides,
    origem: post.origem,
    briefing: post.briefing,
    artigo,
    apiKey: deps.openRouterKey,
    model: deps.modeloRoteiro,
    onUsage: llmUsageRecorder(deps.db, {
      clientId: post.client_id,
      articleId: post.article_id,
      jobId: ctx.jobId,
      agente: 'ig_roteirista',
      igPostId: post.id,
    }),
  })

  await salvarRoteiro(deps.db, post.id, roteiro)
}

/** Gera uma versão nova do slide, grava no R2 e no banco, apaga a anterior e registra o custo. */
async function gerarEGravar(
  deps: IgDeps,
  ctx: Ctx,
  post: IgPost,
  slide: IgSlideRow,
  slides: IgSlideRow[],
  modo: IgSlideModo,
  instrucao?: string,
): Promise<void> {
  await marcarSlide(deps.db, slide.id, 'gerando')

  let prompt: string
  const referencias: ImagemReferencia[] = []

  if (modo === 'corrigir') {
    if (!instrucao?.trim()) throw new ErroDefinitivo('Descreva a correção')
    if (!slide.r2_key) throw new ErroDefinitivo('Slide sem arte para corrigir')
    referencias.push(await lerImagem(deps.r2, slide.r2_key))
    prompt = montarPromptCorrecao(instrucao)
  } else {
    const perfil = normalizePerfilCliente(await lerPerfil(deps.db, post.client_id))
    const logo = await carregarLogo(deps, post.client_id)
    const tipos = referenciasDoSlide(slide.ordem, post.num_slides, logo !== null)
    for (const tipo of tipos) {
      if (tipo === 'logo' && logo) referencias.push(logo)
      if (tipo === 'estilo') {
        const capa = slides.find((s) => s.ordem === 1)
        if (!capa?.r2_key) throw new ErroDefinitivo('A capa ainda não tem arte: gere o slide 1 primeiro')
        referencias.push(await lerImagem(deps.r2, capa.r2_key))
      }
    }
    prompt = montarPromptSlide({
      direcaoArte: post.direcao_arte ?? '',
      diretrizVisual: perfil.diretriz_visual ?? '',
      slide,
      total: post.num_slides,
      referencias: tipos,
    })
  }

  const r = await gerarSlide({
    apiKey: deps.openAiKey,
    modelo: deps.modeloImagem,
    modeloEdicao: deps.modeloEdicao,
    qualidade: deps.qualidade,
    modo,
    prompt,
    referencias,
    transformer: deps.transformer,
  })

  const versao = slide.versao + 1
  const chave = chaveR2Slide(post.id, slide.ordem, versao)
  await deps.r2.put(chave, r.bytes, { httpMetadata: { contentType: 'image/jpeg' } })
  await gravarImagemSlide(deps.db, slide.id, { r2Key: chave, versao, token: novoTokenPublico() })
  if (slide.r2_key && slide.r2_key !== chave) {
    await deps.r2.delete(slide.r2_key).catch(() => undefined)
  }

  // Registro de custo é best-effort: nunca derruba a geração
  await llmUsageRecorder(deps.db, {
    clientId: post.client_id,
    articleId: null,
    jobId: ctx.jobId,
    agente: 'ig_imagem',
    igPostId: post.id,
  })({
    modelo: r.modelo,
    tokensIn: r.usage.textTokensIn + r.usage.imageTokensIn,
    tokensOut: r.usage.tokensOut,
    custoUsd: r.custoUsd,
  }).catch(() => undefined)
}

async function executarIgArtes(deps: IgDeps, ctx: Ctx): Promise<void> {
  const post = await exigirPost(deps.db, ctx.postId)
  // Só a API move o post para gerando_artes; em outro status este job está obsoleto
  if (post.status !== 'gerando_artes') return

  const slides = await listIgSlideRows(deps.db, post.id)
  const capa = slides.find((s) => s.ordem === 1)
  if (!capa) throw new ErroDefinitivo('Roteiro sem slides: refaça o roteiro')

  // Retry depois de a capa sair: não paga a imagem de novo
  if (!(capa.status === 'ok' && capa.r2_key)) {
    await gerarEGravar(deps, ctx, post, capa, slides, 'gerar')
  }

  for (const slide of slides) {
    if (slide.ordem === 1 || slide.status !== 'pendente') continue
    await despacharSlide(deps.db, deps.queue, {
      clientId: post.client_id,
      postId: post.id,
      slideId: slide.id,
      payload: { ordem: slide.ordem, modo: 'gerar' },
    })
  }

  await fecharArtesSeProntas(deps.db, post.id)
}

async function executarIgSlide(deps: IgDeps, ctx: Ctx, payload: IgSlideJobPayload | null): Promise<void> {
  if (!payload?.ordem) throw new ErroDefinitivo('Job de slide sem ordem')
  const post = await exigirPost(deps.db, ctx.postId)
  const slides = await listIgSlideRows(deps.db, post.id)
  const slide = slides.find((s) => s.ordem === payload.ordem)
  if (!slide) throw new ErroDefinitivo(`Slide ${payload.ordem} não existe`)

  await gerarEGravar(deps, ctx, post, slide, slides, payload.modo, payload.instrucao)

  if (payload.cascata && slide.ordem === 1) {
    // Capa com estilo novo: os demais são refeitos a partir dela
    await setIgPostStatus(deps.db, post.id, 'gerando_artes')
    for (const outro of slides) {
      if (outro.ordem === 1) continue
      await despacharSlide(deps.db, deps.queue, {
        clientId: post.client_id,
        postId: post.id,
        slideId: outro.id,
        payload: { ordem: outro.ordem, modo: 'regerar' },
      })
    }
  }

  await fecharArtesSeProntas(deps.db, post.id)
}

async function aplicarFalhaDefinitiva(
  deps: IgDeps,
  tipo: JobTipo,
  ctx: Ctx,
  payload: IgSlideJobPayload | null,
  mensagem: string,
): Promise<void> {
  if (tipo === 'ig_roteiro') {
    await setIgPostStatus(deps.db, ctx.postId, 'erro', mensagem)
    return
  }
  if (tipo === 'ig_artes') {
    // Sem capa não há referência de estilo: tudo volta para o roteiro, com o motivo
    await resetarSlides(deps.db, ctx.postId)
    await setIgPostStatus(deps.db, ctx.postId, 'roteiro', mensagem)
    return
  }
  if (tipo === 'ig_slide' && payload?.ordem) {
    const slide = (await listIgSlideRows(deps.db, ctx.postId)).find((s) => s.ordem === payload.ordem)
    if (slide) await marcarSlide(deps.db, slide.id, 'erro', mensagem)
    // Sem isso o post ficaria preso em gerando_artes
    await fecharArtesSeProntas(deps.db, ctx.postId)
  }
}

/**
 * Executa um job `ig_*`. Devolve 'retry' para erro transitório (a fila tenta de novo) e 'ack'
 * para sucesso ou falha definitiva — nesse caso o estado do post já foi ajustado.
 */
export async function processIgJob(
  deps: IgDeps,
  msg: QueueMessage,
  tentativa: number,
): Promise<'ack' | 'retry'> {
  const postId = msg.ig_post_id
  if (!postId) {
    await marcarJobIg(deps.db, msg.job_id, 'erro', 'Job de Instagram sem ig_post_id')
    return 'ack'
  }

  const ctx: Ctx = { jobId: msg.job_id, postId }
  const payload = await lerPayloadJob<IgSlideJobPayload>(deps.db, msg.job_id)
  await marcarJobIg(deps.db, msg.job_id, 'rodando')

  try {
    switch (msg.tipo) {
      case 'ig_roteiro':
        await executarIgRoteiro(deps, ctx)
        break
      case 'ig_artes':
        await executarIgArtes(deps, ctx)
        break
      case 'ig_slide':
        await executarIgSlide(deps, ctx, payload)
        break
      default:
        throw new ErroDefinitivo(`Tipo de job fora do Instagram: ${msg.tipo}`)
    }
    await marcarJobIg(deps.db, msg.job_id, 'ok')
    return 'ack'
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err)
    await marcarJobIg(deps.db, msg.job_id, 'erro', mensagem)

    const definitivo = err instanceof ErroDefinitivo || tentativa >= MAX_TENTATIVAS_FILA
    if (!definitivo) return 'retry'

    await aplicarFalhaDefinitiva(deps, msg.tipo, ctx, payload, mensagem)
    return 'ack'
  }
}
```

Em `execution/src/index.ts`, depois de `export * from './openai/images.js'`:

```ts
export * from './instagram/validar.js'
export * from './instagram/roteiro.js'
export * from './instagram/prompt.js'
export * from './instagram/imagem.js'
export * from './instagram/store.js'
export * from './instagram/fila.js'
export * from './instagram/orquestrar.js'
```

- [ ] **Step 4: Rodar testes e typecheck**

Run: `npx vitest run execution/src/instagram && npx tsc --noEmit -p execution`
Expected: todos os testes de `execution/src/instagram` PASS; sem erro de tipo (se o barrel acusar nome duplicado, renomeie no módulo novo, nunca no existente).

- [ ] **Step 5: Commit**

```bash
git add execution/src/instagram/orquestrar.ts execution/src/instagram/orquestrar.test.ts execution/src/index.ts
git commit -m "feat(instagram): orquestração dos jobs de roteiro, artes e slide"
```

---
### Task 12: Pipeline roteia os jobs `ig_*`

**Files:**
- Modify: `workers/pipeline/src/index.ts`

**Interfaces:**
- Consumes: `processIgJob`, `IgDeps`, `OpenAiQualidade`, `getSetting`, `resolveOpenAiApiKey`, `resolveOpenRouterApiKey` (execution); `IG_JOBS` (types)
- Produces: handler `queue` que manda `ig_*` para `processIgJob` e dá `ack`/`retry` conforme o retorno.

- [ ] **Step 1: Ajustar imports**

Troque `import { CLIENT_SCOPED_JOBS, JOBS_PARALELOS } from '@publisher-p12/types'` por:

```ts
import { CLIENT_SCOPED_JOBS, IG_JOBS, JOBS_PARALELOS } from '@publisher-p12/types'
```

No import de `@publisher-p12/execution`, acrescente (ordem alfabética do bloco):

```ts
  getSetting,
  processIgJob,
  resolveOpenAiApiKey,
  type IgDeps,
  type OpenAiQualidade,
```

- [ ] **Step 2: Dependências dos jobs de Instagram**

Logo antes de `async function processJob(`:

```ts
/** Dependências dos jobs de Instagram: chaves, modelos (settings com padrão) e bindings. */
async function igDeps(env: PipelineBindings): Promise<IgDeps> {
  const k = env.ENCRYPTION_KEY
  const [openRouterKey, openAiKey, modeloRoteiro, modeloImagem, modeloEdicao, qualidade] = await Promise.all([
    resolveOpenRouterApiKey(env.DB, k, env.OPENROUTER_API_KEY),
    resolveOpenAiApiKey(env.DB, k, env.OPENAI_API_KEY),
    getSetting(env.DB, 'openrouter_model_instagram', k),
    getSetting(env.DB, 'openai_model_imagem', k),
    getSetting(env.DB, 'openai_model_imagem_edicao', k),
    getSetting(env.DB, 'openai_qualidade_imagem', k),
  ])
  return {
    db: env.DB,
    r2: env.IMAGES,
    queue: env.ARTICLE_QUEUE,
    openRouterKey: openRouterKey ?? '',
    openAiKey,
    modeloRoteiro: modeloRoteiro ?? 'anthropic/claude-sonnet-4-5',
    modeloImagem: modeloImagem ?? 'gpt-image-2.5-flare',
    modeloEdicao: modeloEdicao ?? 'gpt-image-2.5-sunburst',
    qualidade: (qualidade ?? 'high') as OpenAiQualidade,
    transformer: env.IMAGE_TRANSFORM,
  }
}
```

- [ ] **Step 3: Roteamento no handler da fila**

Troque o `export default { ... }` do fim do arquivo por:

```ts
export default {
  async queue(batch: MessageBatch<QueueMessage>, env: PipelineBindings): Promise<void> {
    for (const message of batch.messages) {
      // Instagram decide sozinho entre retry e ack: erro definitivo não volta para a fila
      if (IG_JOBS.includes(message.body.tipo)) {
        try {
          const destino = await processIgJob(await igDeps(env), message.body, message.attempts)
          if (destino === 'retry') message.retry()
          else message.ack()
        } catch {
          message.retry()
        }
        continue
      }

      try {
        await processJob(env, message.body)
        message.ack()
      } catch {
        message.retry()
      }
    }
  },
}
```

- [ ] **Step 4: Typecheck e suíte completa**

Run: `npx tsc --noEmit -p workers/pipeline && npx vitest run`
Expected: sem erro de tipo; todos os testes PASS. Se o `R2Bucket` não for aceito como `R2Like`, ajuste a assinatura de `R2Like` em `orquestrar.ts` (o binding é a fonte da verdade). Não use cast.

- [ ] **Step 5: Commit**

```bash
git add workers/pipeline/src/index.ts
git commit -m "feat(pipeline): roteia jobs de Instagram para processIgJob"
```

---

### Task 13: Rotas da API

**Files:**
- Create: `workers/api/src/routes/instagram.ts`
- Modify: `workers/api/src/index.ts`

**Interfaces:**
- Consumes: funções do store e da fila (Tasks 9–10)
- Produces (todas autenticadas pelo guard existente):
  - `GET /instagram/posts?client_id&status` → `IgPost[]`
  - `POST /instagram/posts` (`CreateIgPostInput`) → `201 IgPost`; `400 { error }`
  - `GET /instagram/posts/:id` → `IgPostDetalhe`
  - `PATCH /instagram/posts/:id` (`UpdateIgPostInput`) → `IgPostDetalhe`; `400`
  - `DELETE /instagram/posts/:id` → `{ ok: true }`; `409` em `publicando`
  - `POST /instagram/posts/:id/roteiro` → `{ job_id }`; `409`
  - `POST /instagram/posts/:id/artes` → `{ job_id }`; `409`
  - `POST /instagram/posts/:id/slides/:ordem/regerar` (`{ titulo?, texto?, ideia_visual?, cascata? }`) → `{ job_id }`; `400/404/409`
  - `POST /instagram/posts/:id/slides/:ordem/corrigir` (`{ instrucao }`) → `{ job_id }`; `400/404/409`
  - `GET /instagram/slides/:id/imagem` → JPEG
  - `GET /clients/:clientId/instagram` → `ClientInstagram | null`
  - `PUT /clients/:clientId/instagram` (`{ logo_material_id: string | null }`) → `ClientInstagram`; `400`

- [ ] **Step 1: Criar as rotas**

`workers/api/src/routes/instagram.ts`:

```ts
/** Posts de Instagram: rotas finas sobre execution/src/instagram, onde ficam as regras. */
import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
import {
  IgEntradaInvalida,
  apagarIgPost,
  atualizarIgPost,
  atualizarTextoSlide,
  claimIgPostStatus,
  criarIgPost,
  despacharSlide,
  enfileirarJobIg,
  getClientInstagram,
  getIgPost,
  getIgPostDetalhe,
  getIgSlide,
  getIgSlideById,
  listIgPosts,
  postOcupado,
  salvarLogoInstagram,
} from '@publisher-p12/execution'
import type { CreateIgPostInput, IgPostStatus, IgRoteiroSlide, UpdateIgPostInput } from '@publisher-p12/types'

const instagram = new Hono<{ Bindings: ApiBindings }>()

/** Regra de negócio violada vira 400 com a mensagem; o resto sobe como 500. */
function entradaInvalida(err: unknown): string | null {
  return err instanceof IgEntradaInvalida ? err.message : null
}

instagram.get('/posts', async (c) => {
  const status = (c.req.query('status') || undefined) as IgPostStatus | undefined
  return c.json(await listIgPosts(c.env.DB, { client_id: c.req.query('client_id') || undefined, status }))
})

instagram.post('/posts', async (c) => {
  const body = (await c.req.json()) as CreateIgPostInput
  try {
    const post = await criarIgPost(c.env.DB, body)
    await enfileirarJobIg(c.env.DB, c.env.ARTICLE_QUEUE, {
      clientId: post.client_id,
      igPostId: post.id,
      tipo: 'ig_roteiro',
    })
    return c.json(post, 201)
  } catch (err) {
    const msg = entradaInvalida(err)
    if (msg) return c.json({ error: msg }, 400)
    throw err
  }
})

instagram.get('/posts/:id', async (c) => {
  const post = await getIgPostDetalhe(c.env.DB, c.req.param('id'))
  if (!post) return c.json({ error: 'Post não encontrado' }, 404)
  return c.json(post)
})

instagram.patch('/posts/:id', async (c) => {
  const post = await getIgPost(c.env.DB, c.req.param('id'))
  if (!post) return c.json({ error: 'Post não encontrado' }, 404)
  try {
    await atualizarIgPost(c.env.DB, post, (await c.req.json()) as UpdateIgPostInput)
  } catch (err) {
    const msg = entradaInvalida(err)
    if (msg) return c.json({ error: msg }, 400)
    throw err
  }
  return c.json(await getIgPostDetalhe(c.env.DB, post.id))
})

instagram.delete('/posts/:id', async (c) => {
  const post = await getIgPost(c.env.DB, c.req.param('id'))
  if (!post) return c.json({ error: 'Post não encontrado' }, 404)
  if (post.status === 'publicando') {
    return c.json({ error: 'O post está sendo publicado. Aguarde terminar.' }, 409)
  }

  const listagem = await c.env.IMAGES.list({ prefix: `instagram/${post.id}/` })
  const chaves = listagem.objects.map((o) => o.key)
  if (chaves.length) await c.env.IMAGES.delete(chaves)
  await apagarIgPost(c.env.DB, post.id)
  return c.json({ ok: true })
})

instagram.post('/posts/:id/roteiro', async (c) => {
  const post = await getIgPost(c.env.DB, c.req.param('id'))
  if (!post) return c.json({ error: 'Post não encontrado' }, 404)
  if (!(await claimIgPostStatus(c.env.DB, post.id, ['roteiro', 'erro'], 'gerando_roteiro'))) {
    return c.json({ error: 'O roteiro só pode ser refeito antes das artes' }, 409)
  }
  const jobId = await enfileirarJobIg(c.env.DB, c.env.ARTICLE_QUEUE, {
    clientId: post.client_id,
    igPostId: post.id,
    tipo: 'ig_roteiro',
  })
  return c.json({ job_id: jobId })
})

instagram.post('/posts/:id/artes', async (c) => {
  const post = await getIgPost(c.env.DB, c.req.param('id'))
  if (!post) return c.json({ error: 'Post não encontrado' }, 404)
  // Claim atômico: o segundo clique não enfileira outro job pago
  if (!(await claimIgPostStatus(c.env.DB, post.id, ['roteiro'], 'gerando_artes'))) {
    return c.json({ error: 'As artes já estão sendo geradas' }, 409)
  }
  const jobId = await enfileirarJobIg(c.env.DB, c.env.ARTICLE_QUEUE, {
    clientId: post.client_id,
    igPostId: post.id,
    tipo: 'ig_artes',
  })
  return c.json({ job_id: jobId })
})

instagram.post('/posts/:id/slides/:ordem/regerar', async (c) => {
  const db = c.env.DB
  const post = await getIgPost(db, c.req.param('id'))
  if (!post) return c.json({ error: 'Post não encontrado' }, 404)
  if (post.status !== 'revisao') return c.json({ error: 'Regerar só na revisão das artes' }, 409)
  if (await postOcupado(db, post.id)) {
    return c.json({ error: 'Espere os slides em andamento terminarem' }, 409)
  }
  const ordem = Number(c.req.param('ordem'))
  const slide = await getIgSlide(db, post.id, ordem)
  if (!slide) return c.json({ error: 'Slide não encontrado' }, 404)

  const body = (await c.req.json().catch(() => ({}))) as Partial<IgRoteiroSlide> & { cascata?: boolean }
  try {
    await atualizarTextoSlide(db, slide, { titulo: body.titulo, texto: body.texto, ideia_visual: body.ideia_visual })
  } catch (err) {
    const msg = entradaInvalida(err)
    if (msg) return c.json({ error: msg }, 400)
    throw err
  }

  const jobId = await despacharSlide(db, c.env.ARTICLE_QUEUE, {
    clientId: post.client_id,
    postId: post.id,
    slideId: slide.id,
    payload: { ordem, modo: 'regerar', cascata: ordem === 1 && body.cascata === true },
  })
  return c.json({ job_id: jobId })
})

instagram.post('/posts/:id/slides/:ordem/corrigir', async (c) => {
  const db = c.env.DB
  const post = await getIgPost(db, c.req.param('id'))
  if (!post) return c.json({ error: 'Post não encontrado' }, 404)
  if (post.status !== 'revisao') return c.json({ error: 'Corrigir só na revisão das artes' }, 409)
  if (await postOcupado(db, post.id)) {
    return c.json({ error: 'Espere os slides em andamento terminarem' }, 409)
  }
  const ordem = Number(c.req.param('ordem'))
  const slide = await getIgSlide(db, post.id, ordem)
  if (!slide) return c.json({ error: 'Slide não encontrado' }, 404)

  const { instrucao } = (await c.req.json().catch(() => ({}))) as { instrucao?: string }
  if (!instrucao?.trim()) return c.json({ error: 'Descreva a correção' }, 400)
  if (!slide.r2_key) return c.json({ error: 'Este slide ainda não tem arte' }, 409)

  const jobId = await despacharSlide(db, c.env.ARTICLE_QUEUE, {
    clientId: post.client_id,
    postId: post.id,
    slideId: slide.id,
    payload: { ordem, modo: 'corrigir', instrucao: instrucao.trim() },
  })
  return c.json({ job_id: jobId })
})

instagram.get('/slides/:id/imagem', async (c) => {
  const slide = await getIgSlideById(c.env.DB, c.req.param('id'))
  if (!slide?.r2_key) return c.json({ error: 'Arte não encontrada' }, 404)
  const obj = await c.env.IMAGES.get(slide.r2_key)
  if (!obj) return c.json({ error: 'Arte não encontrada no storage' }, 404)

  const headers = new Headers()
  headers.set('Content-Type', obj.httpMetadata?.contentType ?? 'image/jpeg')
  headers.set('Cache-Control', 'private, max-age=300')
  return new Response(obj.body, { headers })
})

/** Montado em /clients: vínculo do cliente com o Instagram (na fatia A, só o logo). */
export const instagramClientes = new Hono<{ Bindings: ApiBindings }>()

instagramClientes.get('/:clientId/instagram', async (c) =>
  c.json(await getClientInstagram(c.env.DB, c.req.param('clientId'))),
)

instagramClientes.put('/:clientId/instagram', async (c) => {
  const clientId = c.req.param('clientId')
  const body = (await c.req.json()) as { logo_material_id?: string | null }
  try {
    await salvarLogoInstagram(c.env.DB, clientId, body.logo_material_id || null)
  } catch (err) {
    const msg = entradaInvalida(err)
    if (msg) return c.json({ error: msg }, 400)
    throw err
  }
  return c.json(await getClientInstagram(c.env.DB, clientId))
})

export default instagram
```

- [ ] **Step 2: Montar no app**

`workers/api/src/index.ts`: depois de `import dashboardRouter from './routes/dashboard.js'`:

```ts
import instagramRouter, { instagramClientes } from './routes/instagram.js'
```

Depois de `app.route('/clients', googleRouter)`:

```ts
app.route('/clients', instagramClientes)
```

Depois de `app.route('/jobs', jobsRouter)`:

```ts
app.route('/instagram', instagramRouter)
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p workers/api`
Expected: sem erros.

- [ ] **Step 4: Smoke local das regras (sem custo)**

Com a migration aplicada no D1 local (`npm run cf:d1:migrate:010:local`) e a API rodando (`npm run dev:api`), em outro terminal (usuário e senha do `.env`):

```bash
curl -s -u "$DASHBOARD_USER:$DASHBOARD_PASS" -X POST http://127.0.0.1:8787/instagram/posts \
  -H 'Content-Type: application/json' \
  -d '{"client_id":"<id de um cliente local>","formato":"estatico","num_slides":3,"origem":"tema","briefing":"x"}'
```

Expected: `400 {"error":"Post estático tem 1 slide"}`. Não crie post válido aqui: ele enfileiraria o roteirista (chamada paga).

- [ ] **Step 5: Commit**

```bash
git add workers/api/src/routes/instagram.ts workers/api/src/index.ts
git commit -m "feat(api): rotas de posts de Instagram e logo do cliente"
```

---

### Task 14: Frontend: cliente HTTP, status, menu e lista

**Files:**
- Modify: `frontend/lib/api.ts`
- Create: `frontend/lib/instagram.ts`
- Modify: `frontend/components/app-shell.tsx`
- Create: `frontend/app/instagram/page.tsx`

**Interfaces:**
- Consumes: rotas da Task 13
- Produces:
  - `api.instagram.{ list, get, create, update, remove, refazerRoteiro, gerarArtes, regerarSlide, corrigirSlide, slideImagem, getCliente, salvarLogo }`
  - `IG_STATUS: Record<IgPostStatus, { label: string; tone: Tone }>`, `igOcupado(post: IgPostDetalhe): boolean`, `contarCaracteres(texto: string): number`, `legendaCompleta(legenda: string | null, hashtags: string[]): string`, `tituloDoPost(post: IgPost): string`

- [ ] **Step 1: Cliente HTTP**

`frontend/lib/api.ts`: acrescente ao import de tipos `ClientInstagram`, `CreateIgPostInput`, `IgPost`, `IgPostDetalhe`, `IgRoteiroSlide`, `UpdateIgPostInput`. Dentro de `export const api = {`, depois do bloco `jobs`:

```ts
  instagram: {
    list: (params?: { client_id?: string; status?: string }) => {
      const q = new URLSearchParams()
      if (params?.client_id) q.set('client_id', params.client_id)
      if (params?.status) q.set('status', params.status)
      const qs = q.toString()
      return apiFetch<IgPost[]>(`/instagram/posts${qs ? `?${qs}` : ''}`)
    },
    get: (id: string) => apiFetch<IgPostDetalhe>(`/instagram/posts/${id}`),
    create: (input: CreateIgPostInput) =>
      apiFetch<IgPost>('/instagram/posts', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, patch: UpdateIgPostInput) =>
      apiFetch<IgPostDetalhe>(`/instagram/posts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    remove: (id: string) => apiFetch<{ ok: boolean }>(`/instagram/posts/${id}`, { method: 'DELETE' }),
    refazerRoteiro: (id: string) =>
      apiFetch<{ job_id: string }>(`/instagram/posts/${id}/roteiro`, { method: 'POST' }),
    gerarArtes: (id: string) => apiFetch<{ job_id: string }>(`/instagram/posts/${id}/artes`, { method: 'POST' }),
    regerarSlide: (id: string, ordem: number, body: Partial<IgRoteiroSlide> & { cascata?: boolean } = {}) =>
      apiFetch<{ job_id: string }>(`/instagram/posts/${id}/slides/${ordem}/regerar`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    corrigirSlide: (id: string, ordem: number, instrucao: string) =>
      apiFetch<{ job_id: string }>(`/instagram/posts/${id}/slides/${ordem}/corrigir`, {
        method: 'POST',
        body: JSON.stringify({ instrucao }),
      }),
    /** A prévia exige login: baixa com o header e devolve uma object URL (revogue ao desmontar). */
    slideImagem: async (slideId: string): Promise<string> => {
      const res = await fetch(`${API_URL}/instagram/slides/${slideId}/imagem`, {
        headers: { Authorization: getAuthHeader() },
      })
      if (!res.ok) throw new Error('Falha ao carregar a arte')
      return URL.createObjectURL(await res.blob())
    },
    getCliente: (clientId: string) => apiFetch<ClientInstagram | null>(`/clients/${clientId}/instagram`),
    salvarLogo: (clientId: string, logoMaterialId: string | null) =>
      apiFetch<ClientInstagram>(`/clients/${clientId}/instagram`, {
        method: 'PUT',
        body: JSON.stringify({ logo_material_id: logoMaterialId }),
      }),
  },
```

- [ ] **Step 2: Status e utilitários**

`frontend/lib/instagram.ts`:

```ts
import type { IgPost, IgPostDetalhe, IgPostStatus } from '@publisher-p12/types'
import type { Tone } from '@/lib/status'

export const IG_STATUS: Record<IgPostStatus, { label: string; tone: Tone }> = {
  gerando_roteiro: { label: 'Escrevendo roteiro', tone: 'cyan' },
  roteiro: { label: 'Roteiro para revisar', tone: 'yellow' },
  gerando_artes: { label: 'Gerando artes', tone: 'cyan' },
  revisao: { label: 'Artes para revisar', tone: 'magenta' },
  agendado: { label: 'Agendado', tone: 'brand' },
  publicando: { label: 'Publicando', tone: 'cyan' },
  publicado: { label: 'Publicado', tone: 'success' },
  erro: { label: 'Erro', tone: 'danger' },
}

/** Há trabalho em andamento: a tela consulta de novo a cada poucos segundos. */
export function igOcupado(post: IgPostDetalhe): boolean {
  if (post.status === 'gerando_roteiro' || post.status === 'gerando_artes' || post.status === 'publicando') {
    return true
  }
  return post.status === 'revisao' && post.slides.some((s) => s.status === 'gerando' || s.status === 'pendente')
}

/** Mesma contagem do backend: acento e emoji valem 1. */
export function contarCaracteres(texto: string): number {
  return [...texto].length
}

export function legendaCompleta(legenda: string | null, hashtags: string[]): string {
  return [legenda?.trim() ?? '', hashtags.join(' ')].filter(Boolean).join('\n\n')
}

export function tituloDoPost(post: IgPost): string {
  return post.briefing?.trim() || (post.formato === 'carrossel' ? 'Carrossel' : 'Post estático')
}
```

- [ ] **Step 3: Item no menu**

`frontend/components/app-shell.tsx`: acrescente `Images` ao import de `lucide-react` e, em `LINKS`, depois de Artigos:

```ts
  { href: '/instagram', label: 'Instagram', icon: Images },
```

- [ ] **Step 4: Tela de lista**

`frontend/app/instagram/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Images, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { buttonClass } from '@/components/ui/button'
import { Panel } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { ListSkeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatRelative } from '@/lib/format'
import { IG_STATUS, tituloDoPost } from '@/lib/instagram'
import type { Client, IgPost, IgPostStatus } from '@publisher-p12/types'

function InstagramList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const clientFilter = searchParams.get('client_id') ?? ''
  const statusFilter = searchParams.get('status') ?? ''

  const [posts, setPosts] = useState<IgPost[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.instagram.list({ client_id: clientFilter || undefined, status: statusFilter || undefined }),
      api.clients.list(),
    ])
      .then(([lista, cls]) => {
        setPosts(lista)
        setClients(cls)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar posts'))
      .finally(() => setLoading(false))
  }, [clientFilter, statusFilter])

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.nome])), [clients])
  const novoHref = clientFilter ? `/instagram/new?client_id=${clientFilter}` : '/instagram/new'
  const novoBotao = (
    <Link href={novoHref} className={buttonClass()}>
      <Plus aria-hidden />
      Novo post
    </Link>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instagram"
        description="Posts estáticos e carrosséis: o roteiro vem primeiro, as artes do GPT Image depois."
        actions={novoBotao}
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sm:w-64">
          <span className="sr-only">Filtrar por cliente</span>
          <select className="field-input" value={clientFilter} onChange={(e) => setParam('client_id', e.target.value)}>
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:w-64">
          <span className="sr-only">Filtrar por status</span>
          <select className="field-input" value={statusFilter} onChange={(e) => setParam('status', e.target.value)}>
            <option value="">Todos os status</option>
            {(Object.keys(IG_STATUS) as IgPostStatus[]).map((s) => (
              <option key={s} value={s}>
                {IG_STATUS[s].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <Notice tone="danger">{error}</Notice>}

      {loading ? (
        <ListSkeleton label="Carregando posts" />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Images aria-hidden />}
          title="Nenhum post ainda"
          description="Crie um post a partir de um tema ou de um artigo do blog."
          action={novoBotao}
        />
      ) : (
        <Panel title={posts.length === 1 ? '1 post' : `${posts.length} posts`}>
          <ul className="divide-y divide-line">
            {posts.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/instagram/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-ink/[0.03]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{tituloDoPost(p)}</span>
                    <span className="text-sm text-muted">
                      {clientNames.get(p.client_id) ?? 'Cliente'} ·{' '}
                      {p.formato === 'carrossel' ? `Carrossel, ${p.num_slides} slides` : 'Post estático'} ·{' '}
                      {formatRelative(p.updated_at)}
                    </span>
                  </span>
                  <Badge tone={IG_STATUS[p.status].tone} dot pulse={p.status.startsWith('gerando')}>
                    {IG_STATUS[p.status].label}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}

export default function InstagramPage() {
  return (
    <Suspense fallback={<ListSkeleton label="Carregando posts" />}>
      <InstagramList />
    </Suspense>
  )
}
```

- [ ] **Step 5: Typecheck e commit**

Run: `npx tsc --noEmit -p frontend`
Expected: sem erros.

```bash
git add frontend/lib/api.ts frontend/lib/instagram.ts frontend/components/app-shell.tsx frontend/app/instagram/page.tsx
git commit -m "feat(frontend): menu e lista de posts de Instagram"
```

---

### Task 15: Frontend: novo post

**Files:**
- Create: `frontend/app/instagram/new/page.tsx`

**Interfaces:**
- Consumes: `api.instagram.create`, `api.clients.list`, `api.articles.list`; `ChoiceGroup`

- [ ] **Step 1: Tela**

`frontend/app/instagram/new/page.tsx`:

```tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { FileText, GalleryHorizontal, Lightbulb, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { api } from '@/lib/api'
import type { Article, Client, IgFormato, IgOrigem } from '@publisher-p12/types'

function tituloArtigo(a: Article): string {
  return a.seo?.titulo_seo || a.briefing?.tema || 'Artigo sem título'
}

function NovoPost() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [clients, setClients] = useState<Client[]>([])
  const [artigos, setArtigos] = useState<Article[]>([])
  const [clientId, setClientId] = useState(searchParams.get('client_id') ?? '')
  const [formato, setFormato] = useState<IgFormato>('carrossel')
  const [numSlides, setNumSlides] = useState(6)
  const [origem, setOrigem] = useState<IgOrigem>('tema')
  const [briefing, setBriefing] = useState('')
  const [articleId, setArticleId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.clients
      .list()
      .then(setClients)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar clientes'))
  }, [])

  useEffect(() => {
    setArticleId('')
    if (!clientId) {
      setArtigos([])
      return
    }
    // Só artigos com texto: o roteirista resume o conteúdo
    api.articles
      .list({ client_id: clientId })
      .then((lista) => setArtigos(lista.filter((a) => a.conteudo_md?.trim())))
      .catch(() => setArtigos([]))
  }, [clientId])

  async function criar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSalvando(true)
    try {
      const post = await api.instagram.create({
        client_id: clientId,
        formato,
        num_slides: formato === 'estatico' ? 1 : numSlides,
        origem,
        briefing: briefing.trim() || null,
        article_id: origem === 'artigo' ? articleId : null,
      })
      router.push(`/instagram/${post.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar o post')
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={criar} className="space-y-6">
      <PageHeader
        back={{ href: '/instagram', label: 'Instagram' }}
        title="Novo post"
        description="O roteirista escreve o texto primeiro. As artes só são geradas depois que você aprovar o roteiro."
      />

      {error && <Notice tone="danger">{error}</Notice>}

      <Card className="space-y-6">
        <label className="block space-y-1.5">
          <span className="field-label">Cliente</span>
          <select required className="field-input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Escolha o cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <ChoiceGroup
          name="formato"
          legend="Formato"
          value={formato}
          onChange={setFormato}
          options={[
            {
              value: 'carrossel',
              label: 'Carrossel',
              description: 'De 2 a 10 slides, todos no estilo da capa.',
              icon: <GalleryHorizontal aria-hidden />,
            },
            { value: 'estatico', label: 'Post estático', description: 'Uma imagem só.', icon: <Square aria-hidden /> },
          ]}
        />

        {formato === 'carrossel' && (
          <label className="block space-y-1.5">
            <span className="field-label">Quantidade de slides</span>
            <input
              type="number"
              min={2}
              max={10}
              required
              className="field-input w-32"
              value={numSlides}
              onChange={(e) => setNumSlides(Number(e.target.value))}
            />
          </label>
        )}

        <ChoiceGroup
          name="origem"
          legend="De onde vem o conteúdo"
          value={origem}
          onChange={setOrigem}
          options={[
            { value: 'tema', label: 'Tema livre', description: 'Você descreve o assunto.', icon: <Lightbulb aria-hidden /> },
            {
              value: 'artigo',
              label: 'Artigo do blog',
              description: 'O post resume um artigo já escrito.',
              icon: <FileText aria-hidden />,
            },
          ]}
        />

        {origem === 'artigo' && (
          <label className="block space-y-1.5">
            <span className="field-label">Artigo</span>
            <select
              required
              className="field-input"
              value={articleId}
              disabled={!clientId}
              onChange={(e) => setArticleId(e.target.value)}
            >
              <option value="">
                {!clientId ? 'Escolha o cliente primeiro' : artigos.length ? 'Escolha o artigo' : 'Nenhum artigo com texto'}
              </option>
              {artigos.map((a) => (
                <option key={a.id} value={a.id}>
                  {tituloArtigo(a)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="field-label">{origem === 'tema' ? 'Tema e briefing' : 'Instruções extras (opcional)'}</span>
          <textarea
            className="field-input min-h-28"
            required={origem === 'tema'}
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
            placeholder={
              origem === 'tema'
                ? 'Ex.: 5 sinais de que o Wi-Fi da empresa precisa de upgrade'
                : 'Ex.: foque nas dicas práticas'
            }
          />
        </label>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={salvando} loadingText="Criando…">
          Escrever roteiro
        </Button>
      </div>
    </form>
  )
}

export default function NovoPostPage() {
  return (
    <Suspense fallback={null}>
      <NovoPost />
    </Suspense>
  )
}
```

- [ ] **Step 2: Typecheck e commit**

Run: `npx tsc --noEmit -p frontend`
Expected: sem erros.

```bash
git add frontend/app/instagram/new/page.tsx
git commit -m "feat(frontend): tela de novo post de Instagram"
```

---

### Task 16: Frontend: editor do post

**Files:**
- Create: `frontend/components/instagram/roteiro-editor.tsx`
- Create: `frontend/components/instagram/slide-card.tsx`
- Create: `frontend/components/instagram/legenda-editor.tsx`
- Create: `frontend/app/instagram/[id]/page.tsx`

**Interfaces:**
- Consumes: `api.instagram.*` (Task 14), `IG_STATUS`, `igOcupado`, `contarCaracteres`, `legendaCompleta`, `IG_LIMITES`
- Produces: `RoteiroEditor`, `SlideCard`, `LegendaEditor`; tipo `Executar = (acao: () => Promise<unknown>) => Promise<void>`

- [ ] **Step 1: Editor de roteiro**

`frontend/components/instagram/roteiro-editor.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { IG_LIMITES, type IgPostDetalhe, type IgRoteiroSlide, type UpdateIgPostInput } from '@publisher-p12/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { contarCaracteres } from '@/lib/instagram'
import { cn } from '@/lib/utils'

export function Contador({ valor, max }: { valor: string; max: number }) {
  const n = contarCaracteres(valor)
  return (
    <span className={cn('text-xs tabular-nums', n > max ? 'font-semibold text-[#B42318]' : 'text-subtle')}>
      {n}/{max}
    </span>
  )
}

type SlideEditavel = { ordem: number } & IgRoteiroSlide

export function RoteiroEditor({
  post,
  onSalvar,
  onGerarArtes,
  onRefazer,
}: {
  post: IgPostDetalhe
  onSalvar: (patch: UpdateIgPostInput) => Promise<void>
  onGerarArtes: (patch: UpdateIgPostInput) => Promise<void>
  onRefazer: () => Promise<void>
}) {
  const [direcao, setDirecao] = useState(post.direcao_arte ?? '')
  const [slides, setSlides] = useState<SlideEditavel[]>(
    post.slides.map((s) => ({ ordem: s.ordem, titulo: s.titulo, texto: s.texto, ideia_visual: s.ideia_visual })),
  )
  const [legenda, setLegenda] = useState(post.legenda ?? '')
  const [hashtags, setHashtags] = useState(post.hashtags.join(' '))
  const [rodando, setRodando] = useState<'salvar' | 'artes' | 'refazer' | null>(null)

  const patch = (): UpdateIgPostInput => ({
    direcao_arte: direcao,
    slides,
    legenda,
    hashtags: hashtags.split(/\s+/).filter(Boolean),
  })

  const estourou =
    slides.some(
      (s) => contarCaracteres(s.titulo) > IG_LIMITES.titulo || contarCaracteres(s.texto) > IG_LIMITES.texto,
    ) || contarCaracteres(legenda) > IG_LIMITES.legenda

  function editarSlide(ordem: number, campo: keyof IgRoteiroSlide, valor: string) {
    setSlides((atual) => atual.map((s) => (s.ordem === ordem ? { ...s, [campo]: valor } : s)))
  }

  async function rodar(qual: 'salvar' | 'artes' | 'refazer', fn: () => Promise<void>) {
    setRodando(qual)
    try {
      await fn()
    } finally {
      setRodando(null)
    }
  }

  const total = slides.length

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <label className="block space-y-1.5">
          <span className="field-label">Direção de arte (vale para todos os slides)</span>
          <textarea className="field-input min-h-24" value={direcao} onChange={(e) => setDirecao(e.target.value)} />
        </label>
      </Card>

      {slides.map((s) => (
        <Card key={s.ordem} className="space-y-3">
          <p className="text-sm font-semibold text-muted">
            Slide {s.ordem}
            {total > 1 && s.ordem === 1 ? ' · capa' : ''}
            {total > 1 && s.ordem === total ? ' · CTA' : ''}
          </p>
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between">
              <span className="field-label">Título</span>
              <Contador valor={s.titulo} max={IG_LIMITES.titulo} />
            </span>
            <input className="field-input" value={s.titulo} onChange={(e) => editarSlide(s.ordem, 'titulo', e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between">
              <span className="field-label">Texto de apoio</span>
              <Contador valor={s.texto} max={IG_LIMITES.texto} />
            </span>
            <textarea className="field-input min-h-20" value={s.texto} onChange={(e) => editarSlide(s.ordem, 'texto', e.target.value)} />
          </label>
          <label className="block space-y-1.5">
            <span className="field-label">Ideia visual</span>
            <textarea
              className="field-input min-h-16"
              value={s.ideia_visual}
              onChange={(e) => editarSlide(s.ordem, 'ideia_visual', e.target.value)}
            />
          </label>
        </Card>
      ))}

      <Card className="space-y-3">
        <label className="block space-y-1.5">
          <span className="flex items-center justify-between">
            <span className="field-label">Legenda</span>
            <Contador valor={legenda} max={IG_LIMITES.legenda} />
          </span>
          <textarea className="field-input min-h-32" value={legenda} onChange={(e) => setLegenda(e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="field-label">Hashtags (separadas por espaço)</span>
          <input className="field-input" value={hashtags} onChange={(e) => setHashtags(e.target.value)} />
        </label>
      </Card>

      {estourou && (
        <Notice tone="warning">
          Algum campo passou do limite. Encurte antes de gerar as artes: texto longo sai ilegível na imagem.
        </Notice>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-sm text-muted">
          {total === 1 ? 'Gera 1 imagem com GPT Image.' : `Gera ${total} imagens com GPT Image.`}
        </span>
        <Button variant="ghost" loading={rodando === 'refazer'} onClick={() => rodar('refazer', onRefazer)}>
          <RefreshCw aria-hidden />
          Refazer roteiro
        </Button>
        <Button
          variant="outline"
          disabled={estourou}
          loading={rodando === 'salvar'}
          onClick={() => rodar('salvar', () => onSalvar(patch()))}
        >
          Salvar
        </Button>
        <Button disabled={estourou} loading={rodando === 'artes'} onClick={() => rodar('artes', () => onGerarArtes(patch()))}>
          <Sparkles aria-hidden />
          Gerar artes
        </Button>
      </div>
    </div>
  )
}
```


- [ ] **Step 2: Card do slide**

`frontend/components/instagram/slide-card.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Download, ImageOff, Pencil, RefreshCw, WandSparkles } from 'lucide-react'
import { IG_LIMITES, type IgPostDetalhe, type IgSlide } from '@publisher-p12/types'
import { Button, buttonClass } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Contador } from '@/components/instagram/roteiro-editor'
import { api } from '@/lib/api'

export type Executar = (acao: () => Promise<unknown>) => Promise<void>

/** Baixa a arte com o header de login e devolve uma object URL; revoga ao trocar de versão. */
function useImagemSlide(slide: IgSlide): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!slide.tem_imagem) {
      setUrl(null)
      return
    }
    let ativo = true
    let criada: string | null = null
    api.instagram
      .slideImagem(slide.id)
      .then((u) => {
        criada = u
        if (ativo) setUrl(u)
        else URL.revokeObjectURL(u)
      })
      .catch(() => ativo && setUrl(null))
    return () => {
      ativo = false
      if (criada) URL.revokeObjectURL(criada)
    }
  }, [slide.id, slide.versao, slide.tem_imagem])
  return url
}

export function SlideCard({
  post,
  slide,
  podeAgir,
  executar,
}: {
  post: IgPostDetalhe
  slide: IgSlide
  podeAgir: boolean
  executar: Executar
}) {
  const url = useImagemSlide(slide)
  const [modo, setModo] = useState<'nada' | 'capa' | 'corrigir' | 'texto'>('nada')
  const [instrucao, setInstrucao] = useState('')
  const [texto, setTexto] = useState({ titulo: slide.titulo, texto: slide.texto, ideia_visual: slide.ideia_visual })

  const gerando = slide.status === 'gerando' || (post.status === 'gerando_artes' && slide.status === 'pendente')
  const capaDeCarrossel = slide.ordem === 1 && post.num_slides > 1

  function alternar(proximo: typeof modo) {
    setModo((atual) => (atual === proximo ? 'nada' : proximo))
  }

  function regerar(cascata: boolean) {
    setModo('nada')
    return executar(() => api.instagram.regerarSlide(post.id, slide.ordem, { cascata }))
  }

  return (
    <Card className="space-y-3 p-3 sm:p-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-ink/[0.04]">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- object URL de blob autenticado
          <img src={url} alt={`Slide ${slide.ordem}: ${slide.titulo}`} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted">
            {gerando ? (
              <>
                <Spinner />
                <span>Gerando arte…</span>
              </>
            ) : slide.status === 'erro' ? (
              <>
                <ImageOff aria-hidden className="size-6" />
                <span>{slide.erro ?? 'A geração falhou'}</span>
              </>
            ) : (
              <span>Aguardando</span>
            )}
          </div>
        )}
        {url && gerando && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
            <Spinner />
          </div>
        )}
      </div>

      <p className="text-sm font-semibold text-ink">
        {slide.ordem}. {slide.titulo}
      </p>
      {slide.status === 'erro' && url && <p className="text-sm text-[#B42318]">{slide.erro}</p>}

      {podeAgir && (
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="outline" onClick={() => (capaDeCarrossel ? alternar('capa') : regerar(false))}>
            <RefreshCw aria-hidden />
            Regerar
          </Button>
          {slide.tem_imagem && (
            <Button size="sm" variant="outline" onClick={() => alternar('corrigir')}>
              <WandSparkles aria-hidden />
              Corrigir
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => alternar('texto')}>
            <Pencil aria-hidden />
            Editar texto
          </Button>
          {url && (
            <a href={url} download={`slide-${slide.ordem}.jpg`} className={buttonClass('ghost', undefined, 'sm')}>
              <Download aria-hidden />
              Baixar
            </a>
          )}
        </div>
      )}

      {modo === 'capa' && (
        <div className="space-y-2 rounded-lg border border-line p-3 text-sm">
          <p>A capa define o estilo do carrossel. Regerar os outros slides também?</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" onClick={() => regerar(true)}>
              Capa e os demais
            </Button>
            <Button size="sm" variant="outline" onClick={() => regerar(false)}>
              Só a capa
            </Button>
          </div>
        </div>
      )}

      {modo === 'corrigir' && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!instrucao.trim()) return
            setModo('nada')
            void executar(() => api.instagram.corrigirSlide(post.id, slide.ordem, instrucao.trim()))
          }}
        >
          <input
            className="field-input"
            placeholder="Ex.: troque 'mantenção' por 'manutenção'"
            value={instrucao}
            onChange={(e) => setInstrucao(e.target.value)}
          />
          <Button size="sm" type="submit">
            Aplicar correção
          </Button>
        </form>
      )}

      {modo === 'texto' && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            setModo('nada')
            void executar(() => api.instagram.regerarSlide(post.id, slide.ordem, texto))
          }}
        >
          <span className="flex items-center justify-between">
            <span className="field-label">Título</span>
            <Contador valor={texto.titulo} max={IG_LIMITES.titulo} />
          </span>
          <input
            className="field-input"
            value={texto.titulo}
            onChange={(e) => setTexto({ ...texto, titulo: e.target.value })}
          />
          <span className="flex items-center justify-between">
            <span className="field-label">Texto de apoio</span>
            <Contador valor={texto.texto} max={IG_LIMITES.texto} />
          </span>
          <textarea
            className="field-input min-h-16"
            value={texto.texto}
            onChange={(e) => setTexto({ ...texto, texto: e.target.value })}
          />
          <span className="field-label">Ideia visual</span>
          <textarea
            className="field-input min-h-16"
            value={texto.ideia_visual}
            onChange={(e) => setTexto({ ...texto, ideia_visual: e.target.value })}
          />
          <Button size="sm" type="submit">
            Salvar e regerar
          </Button>
        </form>
      )}
    </Card>
  )
}
```

- [ ] **Step 3: Legenda**

`frontend/components/instagram/legenda-editor.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { IG_LIMITES, type IgPostDetalhe, type UpdateIgPostInput } from '@publisher-p12/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Contador } from '@/components/instagram/roteiro-editor'
import { legendaCompleta } from '@/lib/instagram'

export function LegendaEditor({
  post,
  editavel,
  onSalvar,
}: {
  post: IgPostDetalhe
  editavel: boolean
  onSalvar: (patch: UpdateIgPostInput) => Promise<void>
}) {
  const [legenda, setLegenda] = useState(post.legenda ?? '')
  const [hashtags, setHashtags] = useState(post.hashtags.join(' '))
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const lista = () => hashtags.split(/\s+/).filter(Boolean)

  async function copiar() {
    await navigator.clipboard.writeText(legendaCompleta(legenda, lista()))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function salvar() {
    setSalvando(true)
    try {
      await onSalvar({ legenda, hashtags: lista() })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Card className="space-y-3">
      <label className="block space-y-1.5">
        <span className="flex items-center justify-between">
          <span className="field-label">Legenda</span>
          <Contador valor={legenda} max={IG_LIMITES.legenda} />
        </span>
        <textarea
          className="field-input min-h-32"
          value={legenda}
          disabled={!editavel}
          onChange={(e) => setLegenda(e.target.value)}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="field-label">Hashtags</span>
        <input className="field-input" value={hashtags} disabled={!editavel} onChange={(e) => setHashtags(e.target.value)} />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        {editavel && (
          <Button variant="outline" loading={salvando} onClick={salvar}>
            Salvar legenda
          </Button>
        )}
        <Button variant="outline" onClick={copiar}>
          {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copiado ? 'Copiado' : 'Copiar legenda'}
        </Button>
      </div>
    </Card>
  )
}
```

- [ ] **Step 4: Página do editor**

`frontend/app/instagram/[id]/page.tsx`:

```tsx
'use client'

import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Trash2 } from 'lucide-react'
import type { IgPostDetalhe } from '@publisher-p12/types'
import { LegendaEditor } from '@/components/instagram/legenda-editor'
import { RoteiroEditor } from '@/components/instagram/roteiro-editor'
import { SlideCard } from '@/components/instagram/slide-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { ListSkeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { IG_STATUS, igOcupado, tituloDoPost } from '@/lib/instagram'

const INTERVALO_MS = 4000

export default function IgPostPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<IgPostDetalhe | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)

  const carregar = useCallback(async () => {
    try {
      setPost(await api.instagram.get(id))
      setErroCarga(null)
    } catch (e) {
      setErroCarga(e instanceof Error ? e.message : 'Erro ao carregar o post')
    }
  }, [id])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const ocupado = post ? igOcupado(post) : false
  useEffect(() => {
    if (!ocupado) return
    const timer = setInterval(() => void carregar(), INTERVALO_MS)
    return () => clearInterval(timer)
  }, [ocupado, carregar])

  async function executar(acao: () => Promise<unknown>) {
    setErroAcao(null)
    try {
      await acao()
      await carregar()
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Algo deu errado')
    }
  }

  async function excluir() {
    setErroAcao(null)
    try {
      await api.instagram.remove(id)
      router.push('/instagram')
    } catch (e) {
      setErroAcao(e instanceof Error ? e.message : 'Não foi possível excluir')
    }
  }

  if (erroCarga && !post) return <Notice tone="danger">{erroCarga}</Notice>
  if (!post) return <ListSkeleton label="Carregando post" />

  const meta = IG_STATUS[post.status]
  const titulo = post.slides[0]?.titulo || tituloDoPost(post)

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/instagram', label: 'Instagram' }}
        title={titulo}
        meta={
          <>
            <Badge tone={meta.tone} dot pulse={ocupado}>
              {meta.label}
            </Badge>
            <Badge>{post.formato === 'carrossel' ? `Carrossel, ${post.num_slides} slides` : 'Post estático'}</Badge>
          </>
        }
        actions={
          confirmandoExclusao ? (
            <div className="flex gap-2">
              <Button variant="danger" size="sm" onClick={excluir}>
                Confirmar exclusão
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmandoExclusao(false)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="danger"
              size="sm"
              disabled={post.status === 'publicando'}
              onClick={() => setConfirmandoExclusao(true)}
            >
              <Trash2 aria-hidden />
              Excluir
            </Button>
          )
        }
      />

      {post.erro && (
        <Notice tone="danger" title="A última etapa falhou">
          {post.erro}
        </Notice>
      )}
      {erroAcao && <Notice tone="danger">{erroAcao}</Notice>}

      {post.status === 'gerando_roteiro' && (
        <Notice tone="info" title="Escrevendo o roteiro">
          O roteirista está lendo o perfil do cliente. Leva menos de um minuto.
        </Notice>
      )}

      {post.status === 'erro' && (
        <Button onClick={() => executar(() => api.instagram.refazerRoteiro(id))}>
          <RefreshCw aria-hidden />
          Tentar de novo
        </Button>
      )}

      {post.status === 'roteiro' && (
        <RoteiroEditor
          post={post}
          onSalvar={(patch) => executar(() => api.instagram.update(id, patch))}
          onGerarArtes={(patch) =>
            executar(async () => {
              await api.instagram.update(id, patch)
              await api.instagram.gerarArtes(id)
            })
          }
          onRefazer={() => executar(() => api.instagram.refazerRoteiro(id))}
        />
      )}

      {(post.status === 'gerando_artes' || post.status === 'revisao') && (
        <>
          {post.status === 'gerando_artes' && (
            <Notice tone="info" title="Gerando as artes">
              A capa sai primeiro e define o estilo. Os outros slides vêm em seguida, em paralelo.
            </Notice>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {post.slides.map((s) => (
              <SlideCard
                key={s.id}
                post={post}
                slide={s}
                podeAgir={post.status === 'revisao' && !ocupado}
                executar={executar}
              />
            ))}
          </div>
          <LegendaEditor
            post={post}
            editavel={post.status === 'revisao'}
            onSalvar={(patch) => executar(() => api.instagram.update(id, patch))}
          />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Typecheck e commit**

Run: `npx tsc --noEmit -p frontend`
Expected: sem erros.

```bash
git add frontend/components/instagram frontend/app/instagram/[id]/page.tsx
git commit -m "feat(frontend): editor do post com roteiro, slides e legenda"
```

---

### Task 17: Frontend: aba Instagram do cliente

**Files:**
- Create: `frontend/components/client-instagram-panel.tsx`
- Modify: `frontend/app/clients/[id]/page.tsx`

**Interfaces:**
- Consumes: `api.materials.list`, `api.instagram.getCliente`, `api.instagram.salvarLogo`

- [ ] **Step 1: Painel**

`frontend/components/client-instagram-panel.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import type { ClientInstagram, ClientMaterial } from '@publisher-p12/types'
import { Button, buttonClass } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'

/** Mesmo filtro do backend (LOGO_MIME_ACEITOS): a OpenAI não aceita SVG nem PDF como referência. */
const LOGO_MIME = ['image/png', 'image/jpeg', 'image/webp']

export function ClientInstagramPanel({ clientId }: { clientId: string }) {
  const [materiais, setMateriais] = useState<ClientMaterial[]>([])
  const [config, setConfig] = useState<ClientInstagram | null>(null)
  const [logoId, setLogoId] = useState('')
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [aviso, setAviso] = useState<{ tone: 'success' | 'danger'; texto: string } | null>(null)

  useEffect(() => {
    Promise.all([api.materials.list(clientId), api.instagram.getCliente(clientId)])
      .then(([lista, cfg]) => {
        setMateriais(lista.filter((m) => LOGO_MIME.includes(m.mime_type)))
        setConfig(cfg)
        setLogoId(cfg?.logo_material_id ?? '')
      })
      .catch((e) => setAviso({ tone: 'danger', texto: e instanceof Error ? e.message : 'Erro ao carregar' }))
      .finally(() => setLoading(false))
  }, [clientId])

  async function salvar() {
    setSalvando(true)
    setAviso(null)
    try {
      const atualizado = await api.instagram.salvarLogo(clientId, logoId || null)
      setConfig(atualizado)
      setAviso({ tone: 'success', texto: 'Logo de referência salvo.' })
    } catch (e) {
      setAviso({ tone: 'danger', texto: e instanceof Error ? e.message : 'Não foi possível salvar' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <h3 className="font-semibold text-ink">Logo de referência</h3>
          <p className="text-sm text-muted">
            Entra na capa e no último slide dos carrosséis. Precisa ser PNG, JPEG ou WebP, enviado na aba Materiais.
          </p>
        </div>

        {aviso && <Notice tone={aviso.tone}>{aviso.texto}</Notice>}

        {loading ? (
          <Spinner />
        ) : materiais.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma imagem PNG, JPEG ou WebP nos Materiais ainda.</p>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1 space-y-1.5">
              <span className="field-label">Logo</span>
              <select className="field-input" value={logoId} onChange={(e) => setLogoId(e.target.value)}>
                <option value="">Sem logo</option>
                {materiais.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </select>
            </label>
            <Button loading={salvando} disabled={logoId === (config?.logo_material_id ?? '')} onClick={salvar}>
              Salvar
            </Button>
          </div>
        )}
      </Card>

      <Notice tone="info" title="Publicação">
        A conexão com a conta do Instagram do cliente vem na próxima etapa. Por enquanto, baixe as artes e copie a
        legenda no editor do post.
      </Notice>

      <Link href={`/instagram/new?client_id=${clientId}`} className={buttonClass()}>
        <Plus aria-hidden />
        Novo post de Instagram
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Aba na página do cliente**

Em `frontend/app/clients/[id]/page.tsx`:
- acrescente `Images` ao import de `lucide-react` (ordem alfabética, depois de `IdCard`);
- acrescente `import { ClientInstagramPanel } from '@/components/client-instagram-panel'` junto dos imports de componentes;
- `ABAS`: `['dados', 'perfil', 'base', 'google', 'instagram', 'categorias', 'materiais'] as const`;
- `ABA_ROTULO`: `instagram: 'Instagram',` depois de `google`;
- `tabItems`: depois do item `google`, `{ value: 'instagram', label: ABA_ROTULO.instagram, icon: <Images aria-hidden /> },`;
- no painel, depois de `{tab === 'google' && <GooglePanel clientId={id} />}`: `{tab === 'instagram' && <ClientInstagramPanel clientId={id} />}`.

- [ ] **Step 3: Typecheck e commit**

Run: `npx tsc --noEmit -p frontend`
Expected: sem erros.

```bash
git add frontend/components/client-instagram-panel.tsx "frontend/app/clients/[id]/page.tsx"
git commit -m "feat(frontend): aba Instagram do cliente com logo de referência"
```

---

### Task 18: Diretiva e spec

**Files:**
- Create: `directives/instagram.md`
- Modify: `directives/README.md`
- Modify: `docs/superpowers/specs/2026-10-06-instagram-posts-design.md`

- [ ] **Step 1: Diretiva**

`directives/instagram.md`:

````markdown
# SOP: Posts de Instagram (estático e carrossel)

Spec: `docs/superpowers/specs/2026-10-06-instagram-posts-design.md`

## Objetivo
Gerar posts de feed do Instagram para o cliente: roteiro (texto) revisado por humano, artes
geradas pelo GPT Image, legenda e hashtags. Fatia A: baixar artes e copiar legenda. Fatia B
(pendente): publicar e agendar via Graph API.

## Entradas
- Cliente com perfil válido (`directives/perfil_cliente.md`); `diretriz_visual` orienta a arte
- Tema e briefing, **ou** artigo do blog com `conteudo_md`
- Logo de referência (opcional): PNG, JPEG ou WebP nos Materiais, escolhido na aba Instagram

## Fluxo
```
POST /instagram/posts → ig_roteiro → roteiro (humano edita) → "Gerar artes"
  → ig_artes: capa (slide 1) → um ig_slide por slide restante, em paralelo → junção → revisao
```
- Capa: geração do zero (ou edição só com o logo). Slides 2..N: edição com a capa (+ logo no último)
- "Corrigir": edição com `gpt-image-2.5-sunburst` sobre a arte atual
- "Regerar" a capa pode ser em cascata: depois dela, os demais são refeitos

## Execução (`execution/src/`)
| Módulo | Papel |
|---|---|
| `openai/images.ts` | Images API, erros tipados, custo por token |
| `instagram/roteiro.ts` | Roteirista (OpenRouter), 1 correção guiada |
| `instagram/validar.ts` | Limites: título 60, texto 180, legenda 2.200, 30 hashtags |
| `instagram/prompt.ts` | Prompt por slide (texto PT-BR exato entre aspas) e de correção |
| `instagram/imagem.ts` | Gera 1280×1600 e recorta para 1080×1350 JPEG q85 |
| `instagram/store.ts` | D1; regras de edição por status; junção atômica |
| `instagram/fila.ts` | Jobs `ig_*`; slide marcado `gerando` antes de enfileirar |
| `instagram/orquestrar.ts` | `processIgJob`: retry x ack, falha definitiva por tipo |

## Configuração
- Secret `OPENAI_API_KEY` no worker do pipeline (`npm run cf:secrets:push:pipeline`)
- A organização da OpenAI precisa estar verificada para usar GPT Image
- Modelos e qualidade: `openai_model_imagem`, `openai_model_imagem_edicao`, `openai_qualidade_imagem`,
  `openrouter_model_instagram` (app_settings, com padrão)

## Edge cases
| Caso | Comportamento |
|---|---|
| Moderação da OpenAI | Slide em `erro` com a mensagem; sem retry |
| Chave ausente/inválida, org não verificada | Erro definitivo com instrução |
| Falha definitiva da capa | Slides voltam a `pendente`, post volta para `roteiro` com o motivo |
| Retry do `ig_artes` com capa pronta | Capa não é gerada de novo |
| Logo SVG/PDF | Ignorado; arte sai sem logo |
| Artigo sem texto | Erro definitivo antes de chamar o modelo |
| Duplo clique em "Gerar artes" | Claim atômico; o segundo recebe 409 |
| Regerar/corrigir com slide em andamento | 409 |
| Texto de slide na revisão | Só via "Editar texto" + regerar |

## Custos
Imagem: US$30 por 1M de tokens de saída, US$8 por 1M de entrada de imagem, US$5 por 1M de
entrada de texto (gpt-image-2.5, 2026-10-06). Cada imagem e o roteiro vão para `llm_usage` com
`ig_post_id`.

## Aprendizados
- (preencher depois do primeiro carrossel real: custo médio por slide, erros de texto comuns)
````

- [ ] **Step 2: Índice das diretivas**

Em `directives/README.md`, no fim do arquivo:

```markdown
## Instagram

`instagram.md`: posts estáticos e carrosséis com GPT Image (roteiro → artes → revisão).
Fluxo separado do time de agentes do blog, na mesma fila (`ig_roteiro`, `ig_artes`, `ig_slide`).
```

- [ ] **Step 3: Spec**

Em `docs/superpowers/specs/2026-10-06-instagram-posts-design.md`:
- `Status: em revisão` → `Status: aprovado`
- Tabela de `client_instagram`: `ig_user_id`, `ig_username` e `page_id` passam a `TEXT` (sem `NOT NULL`), com a nota "a fatia A grava só o logo".
- Seção Settings: acrescente a frase "Não há tela de Settings: `openai_api_key` entra como secret `OPENAI_API_KEY` do worker do pipeline, com fallback em `encrypted_settings`; os modelos ficam em `app_settings`."
- Tabela de rotas: `regerar` aceita `cascata` (só na capa); `regerar` e `corrigir` devolvem 409 com slide em andamento.

- [ ] **Step 4: Commit**

```bash
git add directives/instagram.md directives/README.md docs/superpowers/specs/2026-10-06-instagram-posts-design.md
git commit -m "docs(instagram): diretiva e ajustes da spec da fatia A"
```

---

### Task 19: Validação no app (gasta crédito: pedir autorização antes)

**Files:** nenhum código novo. Resultado vai para "Aprendizados" em `directives/instagram.md`.

- [ ] **Step 1: Suíte e typecheck completos**

Run: `npx vitest run && npx tsc --noEmit -p types && npx tsc --noEmit -p execution && npx tsc --noEmit -p workers/api && npx tsc --noEmit -p workers/pipeline && npx tsc --noEmit -p frontend`
Expected: 213 testes antigos + os novos PASS; typecheck limpo.

- [ ] **Step 2: Telas sem custo**

Siga a memória "Preview local com mock" (stub do OpenNext + mock da API + screenshots CDP). Confira: lista vazia, novo post (os dois formatos e as duas origens), editor em `roteiro` com os contadores, e o editor em `revisao` com slides em `ok`, `gerando` e `erro`. Tudo em largura de celular e de desktop.

- [ ] **Step 3: Pedir autorização ao usuário**

Pergunte antes de seguir. Os próximos passos chamam OpenRouter (roteiro) e OpenAI (6 imagens em qualidade `high`). Também é preciso confirmar que a organização da OpenAI está verificada.

- [ ] **Step 4: Carrossel real de 6 slides (com autorização)**

`OPENAI_API_KEY` no `.env` → `npm run cf:d1:migrate:010:local` → `npm run dev:pipeline` + `npm run dev:api` + `npm run dev:frontend`. Crie um carrossel de 6 slides para um cliente com perfil completo e logo PNG.

Confira:
- o roteiro respeita os limites;
- o texto PT-BR sai sem erro nas artes;
- os 6 slides têm o mesmo estilo;
- o logo aparece na capa e no último slide;
- "Corrigir" funciona num slide;
- a regeração em cascata da capa funciona;
- o download e a cópia da legenda funcionam;
- o custo aparece em `llm_usage`:

```sql
SELECT agente, COUNT(*), SUM(custo_usd) FROM llm_usage WHERE ig_post_id = '<id>' GROUP BY agente
```

- [ ] **Step 5: Registrar aprendizados e commit**

Preencha "Aprendizados" em `directives/instagram.md` com o custo médio por slide, o tempo até a revisão e os erros de texto observados.

```bash
git add directives/instagram.md
git commit -m "docs(instagram): aprendizados do primeiro carrossel real"
```

Produção (`cf:d1:migrate:010:remote`, deploy dos workers e do frontend) só com pedido explícito do usuário.
