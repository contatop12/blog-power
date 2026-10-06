# Design: posts de Instagram com GPT Image (estático e carrossel)

Data: 2026-10-06
Status: em revisão

## Problema

O Publisher só produz artigos de blog. A P12 também cuida do Instagram dos clientes, e hoje
esse trabalho é todo manual: escrever o roteiro do carrossel, desenhar cada slide, montar a
legenda e publicar no horário certo. A ferramenta nova cobre o ciclo inteiro: roteiro → arte →
revisão → agendamento → publicação no Instagram do cliente.

## Objetivo e critério de sucesso

- Criar um post estático ou carrossel (2–10 slides) a partir de um tema livre ou de um artigo
  do blog, com o perfil do cliente como fonte primária.
- O carrossel de 6–8 slides fica pronto para revisão em poucos minutos, com texto em PT-BR
  legível e visual coerente entre os slides.
- O post aprovado é publicado sozinho no horário agendado, sem duplicar.
- Nada é publicado sem revisão humana.

## Decisões

| Decisão | Escolha | Alternativa descartada |
|---|---|---|
| Entregável | Gerar + publicar/agendar no IG | Só gerar e baixar |
| Origem do conteúdo | Tema livre **ou** artigo do blog | Só um dos dois; pautas automáticas |
| Texto na arte | GPT Image renderiza a arte completa, com texto | Fundo IA + texto por template; modo misto |
| Provider de imagem | OpenAI Images API direta | OpenRouter; provider configurável |
| Acesso às contas IG | System User do Business Manager da P12 | OAuth por cliente com App Review |
| Orquestração | Jobs na fila atual + Cron Trigger | Cloudflare Workflows; síncrono na API |
| Revisão | Duas etapas: roteiro (texto) antes, arte depois | Revisão única só da arte |
| Consistência do carrossel | Slide 1 gerado do zero; demais por edição com slide 1 + logo como referência | Cada slide gerado independente |
| Geração dos slides 2..N | Um job `ig_slide` por slide, em paralelo | Sequencial num job só (estoura 15 min) |
| URL pública para a Meta | Rota sem login na API com token por versão, ativa só em `agendado`/`publicando` | Bucket R2 público; domínio novo |
| Implementação | Fatia A (geração) antes da fatia B (publicação) | Tudo de uma vez |

## Restrições externas (verificadas em 2026-10-06)

**OpenAI Images API**
- Modelos: `gpt-image-2.5-flare` (rápido, geração) e `gpt-image-2.5-sunburst` (precisão em
  edição).
- Tamanho custom `WIDTHxHEIGHT`, múltiplos de 16, proporção entre 1:3 e 3:1. `1280x1600` é 4:5
  exato.
- `quality`: `low | medium | high | xhigh | max | auto`. `output_format`: `png | jpeg | webp`.
  `output_compression` 0–100 para jpeg/webp.
- `/v1/images/edits` aceita várias imagens de referência.
- Prompt complexo leva até ~2 min.
- Cobrança por token: imagem gerada US$30/1M, imagem de entrada US$8/1M, texto de entrada
  US$5/1M. A resposta traz `usage`.
- Exige organização verificada na OpenAI.

**Instagram Content Publishing**
- **Só JPEG.**
- Carrossel com no máximo **10** itens; todos são cortados na proporção do primeiro.
- **100** posts publicados via API por conta em 24h móveis; consulta em
  `GET /{ig_id}/content_publishing_limit`.
- **Sem agendamento nativo**: o app agenda.
- A Meta baixa a mídia por cURL, então a imagem precisa estar em **URL pública** no momento da
  publicação.
- Container expira em 24h sem publicar. Status: `EXPIRED | ERROR | FINISHED | IN_PROGRESS |
  PUBLISHED`.
- Permissões (Facebook Login): `instagram_basic`, `instagram_content_publish`,
  `pages_read_engagement`.

## Fluxo do usuário

1. **Novo post** (`/instagram/new`): cliente, formato (`estatico` ou `carrossel` com 2–10
   slides), origem (`tema` com briefing, ou `artigo`). Cria o post e enfileira `ig_roteiro`.
2. **Roteiro** (barato, editável): direção de arte, e por slide título, texto e ideia visual;
   mais legenda e hashtags. Botão **"Gerar artes"**.
3. **Artes** (custo real): slide 1 primeiro, depois os demais em paralelo. Por slide:
   **"Regerar"** e **"Corrigir"** (instrução curta, ex.: "troque 'mantenção' por
   'manutenção'"). **"Baixar JPEG"** por slide e **"Copiar legenda"**.
4. **Agendar** (data/hora no fuso do cliente) ou **"Publicar agora"**.
5. **Cron** a cada 5 min publica o que venceu; a tela mostra o permalink.

Regerar o slide 1 muda o estilo base: a tela avisa e oferece regerar os demais.

### Status de `ig_posts`

```
gerando_roteiro → roteiro → gerando_artes → revisao → agendado → publicando → publicado
                                               ↑          │
                                               └─desagendar┘
qualquer etapa → erro (mensagem legível)
```

### O que pode ser editado em cada status

| Status | Editável |
|---|---|
| `roteiro` | Tudo: direção de arte, slides, legenda, hashtags |
| `revisao` | Legenda e hashtags. Texto de slide só via "editar texto e regerar" (arte nunca diverge do banco) |
| `agendado` | Nada. Desagendar primeiro |
| `publicando`, `publicado` | Nada. `DELETE` bloqueado em `publicando` |

## Modelo de dados — migration `010_instagram.sql`

### `client_instagram`

| Coluna | Tipo |
|---|---|
| `client_id` | TEXT PK → `clients(id)` ON DELETE CASCADE |
| `ig_user_id` | TEXT NOT NULL |
| `ig_username` | TEXT NOT NULL |
| `page_id` | TEXT NOT NULL |
| `logo_material_id` | TEXT → `client_materials(id)` ON DELETE SET NULL |
| `updated_at` | TEXT |

### `ig_posts`

| Coluna | Tipo |
|---|---|
| `id` | TEXT PK |
| `client_id` | TEXT NOT NULL → `clients(id)` ON DELETE CASCADE |
| `formato` | TEXT CHECK (`estatico`, `carrossel`) |
| `num_slides` | INTEGER CHECK 1–10 (estático = 1) |
| `origem` | TEXT CHECK (`tema`, `artigo`) |
| `article_id` | TEXT → `articles(id)` ON DELETE SET NULL |
| `briefing` | TEXT |
| `direcao_arte` | TEXT |
| `legenda` | TEXT |
| `hashtags` | TEXT (JSON array) |
| `status` | TEXT CHECK (estados acima) |
| `agendado_para` | TEXT (UTC ISO) |
| `ig_creation_id` | TEXT (container a publicar; base da idempotência) |
| `ig_media_id` | TEXT |
| `ig_permalink` | TEXT |
| `publicado_em` | TEXT |
| `erro` | TEXT |
| `created_at`, `updated_at` | TEXT |

Índices: `(client_id, status)`, `(status, agendado_para)`.

### `ig_slides`

| Coluna | Tipo |
|---|---|
| `id` | TEXT PK |
| `post_id` | TEXT NOT NULL → `ig_posts(id)` ON DELETE CASCADE |
| `ordem` | INTEGER 1–10, UNIQUE com `post_id` |
| `titulo`, `texto`, `ideia_visual` | TEXT |
| `r2_key` | TEXT (`instagram/{post_id}/slide-{ordem}-v{versao}.jpg`) |
| `versao` | INTEGER, sobe a cada regerar/corrigir |
| `token_publico` | TEXT UNIQUE, 32 bytes aleatórios, novo a cada versão |
| `status` | TEXT CHECK (`pendente`, `gerando`, `ok`, `erro`) |
| `erro` | TEXT |
| `updated_at` | TEXT |

### Tabelas existentes

- `jobs`: coluna nova `ig_post_id` → `ig_posts(id)` ON DELETE CASCADE. CHECK de `tipo` ganha
  `ig_roteiro`, `ig_artes`, `ig_slide`, `ig_publicar`. SQLite não altera CHECK: tabela é
  reconstruída com `PRAGMA defer_foreign_keys`, como nas migrations 006/007. `schema.sql`
  atualizado junto.
- `llm_usage`: `ALTER TABLE ADD COLUMN ig_post_id`. Agentes `ig_roteirista` e `ig_imagem`.

### Settings (`execution/src/settings/keys.ts`)

| Chave | Tipo | Padrão |
|---|---|---|
| `openai_api_key` | secreta | — |
| `meta_system_user_token` | secreta | — |
| `openai_model_imagem` | comum | `gpt-image-2.5-flare` |
| `openai_model_imagem_edicao` | comum | `gpt-image-2.5-sunburst` |
| `openai_qualidade_imagem` | comum | `high` |
| `openrouter_model_instagram` | comum | `anthropic/claude-sonnet-4-5` |
| `meta_graph_version` | comum | versão estável atual da Graph API, conferida na implementação |

Secretas ficam em `encrypted_settings` e nunca voltam em claro pela API (mesmo `maskSecret`).

## Camada 3 — `execution/`

### `execution/src/openai/images.ts`

- `gerarImagem({ apiKey, model, prompt, size, quality, outputFormat: 'jpeg', compression })`
  → `POST /v1/images/generations`.
- `editarImagem({ apiKey, model, prompt, imagens: Uint8Array[], size, quality, ... })`
  → `POST /v1/images/edits` multipart, várias referências.
- Retorno: `{ bytes, usage }`.
- Erros tipados e legíveis:
  - moderação → `OpenAiModeracaoError` (sem retry)
  - 401/403, organização não verificada → `OpenAiConfigError` (sem retry)
  - 429/5xx → erro comum (fila tenta de novo)

### `execution/src/instagram/roteiro.ts`

Agente **roteirista** via `chatJson` (OpenRouter).

Entrada: perfil (`renderPerfilParaPrompt`), formato, `num_slides`, e o tema/briefing ou o
artigo (título, `conteudo_md`, URL).

Saída:

```json
{
  "direcao_arte": "paleta, tipografia, composição",
  "slides": [{ "titulo": "", "texto": "", "ideia_visual": "" }],
  "legenda": "",
  "hashtags": ["#..."]
}
```

Regras no system prompt:
- Slide 1 = gancho (capa); meio = conteúdo; último = CTA de `ctas_permitidos`.
- Origem `artigo`: CTA "link na bio" (link na legenda não é clicável).
- `restricoes_*` e `informacoes_proibidas` têm prioridade absoluta.
- Texto curto: arte com texto longo sai ilegível.

### `execution/src/instagram/validar.ts`

Validação determinística do roteiro, com mensagem que nomeia o problema:
- quantidade de slides = `num_slides`
- `titulo` ≤ 60 caracteres, `texto` ≤ 180 por slide
- `legenda` ≤ 2.200 caracteres; hashtags ≤ 30, cada uma começando com `#`, sem espaço

Falha de validação dispara uma nova chamada com o erro no prompt (uma vez); persistindo, job
em `erro`.

### `execution/src/instagram/prompt.ts`

Monta o prompt de cada slide:
- `direcao_arte` + `diretriz_visual` do perfil
- texto **exato entre aspas**: "renderize exatamente este texto em português, com acentos,
  sem nenhum outro texto"
- posição: "slide 3 de 8"
- margem de segurança de 8% nas bordas (o grid do perfil corta as laterais)
- slides 2..N: "mesmo sistema visual da imagem de referência 1"
- logo (quando houver): só capa e último slide, "use o logo da imagem de referência 2 sem
  alterá-lo"

### `execution/src/instagram/imagem.ts`

- Gera em `1280x1600`, `output_format: jpeg`.
- `IMAGE_TRANSFORM` redimensiona para **1080×1350 JPEG q85**. Sem o binding ou com falha,
  grava o 1280×1600 original (4:5, aceito pelo IG).
- Slide 1: `gerarImagem` com `openai_model_imagem`.
- Slides 2..N: `editarImagem` com `[slide1, logo?]` e `openai_model_imagem`.
- Corrigir: `editarImagem` com `[slide atual]`, instrução do usuário e
  `openai_model_imagem_edicao`.
- `custoImagemUsd(usage)`: constantes de preço do modelo em um só lugar.

### `execution/src/meta/graph.ts`

Cliente da Graph API, versão de `meta_graph_version`. Traduz erros: 190 (token inválido),
10/200 (permissão), 4/9 (limite), códigos de mídia do IG.

### `execution/src/instagram/publicar.ts`

- **Estático:** `POST /{ig}/media { image_url, caption }` → polling de `status_code` até
  `FINISHED` → grava `ig_creation_id` → `POST /{ig}/media_publish` → `permalink`.
- **Carrossel:** um container por slide (`is_carousel_item=true`) → polling de cada →
  `POST /{ig}/media { media_type: CAROUSEL, children, caption }` → polling → grava
  `ig_creation_id` → `media_publish` → `permalink`.
- `caption` = legenda + linha em branco + hashtags separadas por espaço.
- Polling: intervalo crescente, teto de ~60 s por container; `ERROR`/`EXPIRED` vira erro
  legível.
- **Idempotência**, quando o post já tem `ig_creation_id`:
  - container `PUBLISHED` → não publica de novo; recupera `ig_media_id`/`permalink` entre as
    mídias recentes da conta (`GET /{ig}/media?fields=id,permalink,caption,timestamp`)
    comparando a legenda;
  - container `FINISHED` → só chama `media_publish` com ele;
  - `EXPIRED`/`ERROR` → descarta e cria containers novos.

## Camada 2 — workers

### Pipeline (`workers/pipeline/src/index.ts`)

| Job | Faz | Ao terminar |
|---|---|---|
| `ig_roteiro` | Roteirista + validação; cria `ig_slides` | post → `roteiro` |
| `ig_artes` | Gera slide 1; enfileira um `ig_slide` por slide 2..N | junção |
| `ig_slide` | Gera, regera ou corrige 1 slide (`modo` no payload) | junção |
| `ig_publicar` | `publicar.ts`; notificação | post → `publicado` ou `erro` |

**Junção** (um statement, atômico no D1):

```sql
UPDATE ig_posts SET status = 'revisao', updated_at = ?
WHERE id = ? AND status = 'gerando_artes'
  AND NOT EXISTS (SELECT 1 FROM ig_slides
                  WHERE post_id = ? AND status IN ('pendente', 'gerando'))
```

O último slide a terminar fecha o post. Os slides nascem `pendente` no `ig_roteiro`, então a
junção nunca fecha antes da hora. Slide 2..N em `erro` não bloqueia: o post vai para
`revisao` com o slide marcado, e o usuário regera. A junção roda também no caminho de falha
definitiva (moderação ou retries esgotados), senão o post ficaria preso em `gerando_artes`.

**Falha definitiva do slide 1:** sem ele não há referência de estilo. Os slides 2..N não são
enfileirados, todos voltam a `pendente` e o post volta para `roteiro` com `erro` preenchido.
O usuário ajusta o roteiro e clica "Gerar artes" de novo.

**Falha definitiva do `ig_roteiro`:** post → `erro`; a tela oferece "Tentar de novo".

Regerar/corrigir um slide em `revisao` não muda o status do post.

**Cron** — `triggers.crons: ["*/5 * * * *"]` no `wrangler.jsonc` do pipeline, handler
`scheduled`:

```sql
UPDATE ig_posts SET status = 'publicando', updated_at = ?
WHERE status = 'agendado' AND agendado_para <= ?
RETURNING id
```

Enfileira um `ig_publicar` por id. Dois ticks nunca pegam o mesmo post.

Mesmo tick: post em `publicando` há mais de 30 min → `erro` "confira no Instagram antes de
tentar de novo". Nunca republica sozinho.

**Notificação:** `notifyPublishScheduled`/Evolution existentes, em publicação concluída e em
erro de publicação. Falha de notificação não falha o job.

### API (`workers/api/src/routes/instagram.ts`)

| Rota | Faz |
|---|---|
| `GET /instagram/posts?client_id&status` | Lista |
| `POST /instagram/posts` | Cria post (`gerando_roteiro`) e enfileira `ig_roteiro` |
| `GET /instagram/posts/:id` | Post + slides + URLs de prévia |
| `PATCH /instagram/posts/:id` | Edição conforme a tabela de status |
| `POST /instagram/posts/:id/roteiro` | Refaz o roteiro (de `roteiro` ou `erro`); recria os slides `pendente` |
| `DELETE /instagram/posts/:id` | Remove post e objetos R2; 409 em `publicando` |
| `POST /instagram/posts/:id/artes` | `roteiro` → `gerando_artes`, enfileira `ig_artes` |
| `POST /instagram/posts/:id/slides/:ordem/regerar` | Enfileira `ig_slide` modo `regerar`; aceita texto novo |
| `POST /instagram/posts/:id/slides/:ordem/corrigir` | `{ instrucao }` → `ig_slide` modo `corrigir` |
| `POST /instagram/posts/:id/agendar` | `{ agendado_para }` (futuro, UTC) → `agendado` |
| `POST /instagram/posts/:id/publicar-agora` | Reserva atômica → `publicando`, enfileira |
| `POST /instagram/posts/:id/desagendar` | `agendado` → `revisao` (só se ainda `agendado`) |
| `GET /instagram/slides/:id/imagem` | Prévia autenticada (R2) |
| `GET /public/ig/:token.jpg` | **Sem login.** JPEG do R2 só se o post estiver `agendado` ou `publicando`; senão 404 |
| `GET /clients/:id/instagram` / `PUT` | Vínculo e logo de referência |
| `GET /clients/:id/instagram/contas` | `GET /me/accounts?fields=name,instagram_business_account{id,username}` |
| `POST /clients/:id/instagram/testar` | Username + `content_publishing_limit` |

Agendar/publicar exige cliente com `client_instagram` e todos os slides `ok`. Aceita post em
`revisao` ou em `erro` (retentativa depois de falha de publicação).

A URL pública usa a origem do próprio worker da API (`new URL(request.url).origin` gravado no
payload do job), sem variável nova.

## Frontend

- Menu: item **Instagram**.
- `frontend/app/instagram/page.tsx`: lista com filtro por cliente e status.
- `frontend/app/instagram/new/page.tsx`: formulário de criação; artigos do cliente no select
  quando a origem é `artigo`.
- `frontend/app/instagram/[id]/page.tsx`: editor por status (roteiro → artes → agendamento),
  com polling enquanto houver job rodando.
- `frontend/components/client-instagram-panel.tsx`: aba **Instagram** na página do cliente
  (buscar contas, vincular, escolher logo entre os Materiais, testar).
- Settings: campos de OpenAI e Meta.
- Datas exibidas no `clients.timezone`; enviadas em UTC.

Chamadas à Meta e à OpenAI só no backend, como as do WordPress.

## Camada 1 — diretiva

`directives/instagram.md` (nova, autorizada): objetivo, entradas, módulos, fluxo, limites da
OpenAI e da Meta, edge cases e aprendizados, no padrão de `directives/imagem.md`.

## Edge cases

| Caso | Comportamento |
|---|---|
| OpenAI recusa por moderação | Slide em `erro` com a mensagem; sem retry |
| `openai_api_key` ausente ou org não verificada | Job em `erro` com instrução de configuração |
| Sem logo de referência | Gera sem logo |
| Cliente sem `client_instagram` | Agendar/publicar bloqueados na API e na tela |
| Limite de 100/24h atingido | `ig_publicar` em `erro` com a cota lida em `content_publishing_limit` |
| Token Meta inválido (190) | `erro` "reconfigure o token do System User em Settings" |
| Retry da fila após `media_publish` | Idempotência por `ig_creation_id` |
| Post preso em `publicando` > 30 min | `erro`, sem republicar |
| Artigo de origem apagado | `article_id` vira NULL; post segue |
| Regerar slide 1 | Aviso; opção de regerar os demais |

## Fatias

**A — geração (primeiro)**
Migration 010, settings, `openai/images.ts`, roteirista, validação, prompt, `imagem.ts`, jobs
`ig_roteiro`/`ig_artes`/`ig_slide`, rotas de API exceto publicação, telas até `revisao`,
download e copiar legenda, diretiva.

**B — publicação**
1. **Spike primeiro:** publicar 1 post de teste numa conta de cliente compartilhada via BM,
   com o app em acesso Standard. Se a Meta exigir Advanced Access (App Review de
   `instagram_content_publish`), parar e decidir antes de seguir.
2. `meta/graph.ts`, aba Instagram do cliente, rota pública, `publicar.ts`, cron,
   agendar/desagendar/publicar-agora, notificação.

## Testes

Vitest com `fetch` mockado:
- `openai/images.ts`: corpo JSON da geração, multipart da edição com várias referências,
  mapeamento de moderação/401/429.
- `validar.ts`: cada limite, mensagens.
- `prompt.ts`: texto entre aspas, posição, logo só na capa e no último.
- `custoImagemUsd`: cálculo a partir do `usage`.
- `publicar.ts`: estático, carrossel, polling até `FINISHED`, `ERROR`, idempotência com
  container `PUBLISHED`.
- SQL de junção e de reserva do cron.

Manual, **com aviso antes por gastar crédito**: um carrossel real de 6 slides (fatia A) e uma
publicação real numa conta de teste (fatia B).

## Fora de escopo

Reels e vídeo, Stories, calendário visual, métricas e insights, pautas automáticas de
Instagram, marcação de pessoas, primeiro comentário, OAuth por cliente.
