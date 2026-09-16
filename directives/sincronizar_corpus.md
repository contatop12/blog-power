# SOP: Sincronizar Base de Conhecimento do Cliente

## Objetivo
Ler todos os artigos já publicados no WordPress do cliente e guardá-los em `client_posts`,
formando a base que a IA usa para sugerir pautas e (no sub-projeto B) escolher links internos.

## Entradas
- `client_id`
- Credenciais WP do cliente (`wp_api_url`, `wp_user`, `wp_app_password_enc`)
- `completo` (bool): ignora o corte incremental e reingere tudo
- `tipos`: `['post']` (padrão) ou `['post','page']`

## Execução
- Job de fila: `tipo = 'sincronizar_corpus'`, escopo cliente (`jobs.client_id`, `article_id` nulo)
- Módulos:
  - `execution/src/wordpress/corpus.ts` → `fetchPublishedPosts` (`/wp/v2/posts?status=publish&_embed=wp:term`)
  - `execution/src/corpus/store.ts` → `upsertCorpusPosts`, `getUltimoModified`
- Sync incremental: usa `MAX(wp_modified)` do corpus como `modified_after`
- Conteúdo salvo como texto limpo (sem tags, sem comentários Gutenberg), truncado em 60k chars

### Leitura em blocos de 5
`per_page = 5` (`CORPUS_BLOCO_PADRAO`), `orderby=modified&order=asc`. Cada bloco é limpo,
mapeado e **gravado antes de o próximo ser buscado** — não existe acumulação em memória.

Consequências tratadas:

- **Trava por posts, não por páginas.** `CORPUS_MAX_POSTS = 6000`. Com blocos de 5, um limite
  de 60 páginas cobriria só 300 posts.
- **Continuação automática.** 232 posts são ~47 requisições; 3.000 posts seriam 600, o que não
  cabe numa invocação do consumer. Ao passar de `SYNC_ORCAMENTO_MS` (8 min), o job grava o que
  leu, enfileira um `sincronizar_corpus` com `continuacao: true` e sai. A retomada usa
  `MAX(wp_modified)` e é exata: nada é relido, nada se perde.
- **Falha parcial não descarta nada.** Erro no post 200 preserva os 199 anteriores.

## Saídas
- Linhas em `client_posts` (chave: `client_id + wp_post_type + wp_post_id`)
- `jobs.payload.resultado`: `{ total_lidos, inseridos, atualizados, blocos_lidos, continua, tipos }`
  e `continuacao_job_id` quando a sync foi dividida

## Edge cases
- Application Password ausente: API rejeita com 400 antes de enfileirar
- WP recusa página além do total (`rest_post_invalid_page_number`): encerra a paginação sem erro
- Trava de segurança: no máximo 6.000 posts por tipo
- `completo: true` vale só na primeira chamada; a continuação sempre parte do `wp_modified`
  já gravado, senão a sync recomeçaria do zero a cada divisão
- Job já em andamento para o mesmo cliente: API responde 409 com o `job_id` existente
- Post editado no WP: o upsert sobrescreve a linha, nunca duplica

## Critérios de validação
- `client_posts.total` bate com a contagem de posts publicados no WP
- Rodar duas vezes seguidas em modo incremental não insere nada novo
- Interromper no meio e rodar de novo retoma sem reler o que já entrou
- `conteudo_txt` sem `<` e sem `<!-- wp:`

## Aprendizados
- `date_gmt`/`modified_gmt` vêm sem sufixo de fuso; o módulo acrescenta `Z` (PRD exige UTC explícito)
- Ordenar por `modified asc` é o que torna o `modified_after` confiável
- Cada post sincronizado é espelhado em `client_urls` (`origem = 'wordpress'`) por
  `mirrorCorpusToClientUrls`: o PRD exige links internos somente de `client_urls`.
  Migration 007 libera a origem e faz backfill do corpus já existente.
- `atob() called with invalid base64-encoded data` no job = worker do pipeline **sem o secret
  `ENCRYPTION_KEY`** (chega `undefined` em `decryptSecret`). A senha cifrada no D1 estava válida.
  Correção: `npm run cf:secrets:push:pipeline` (envia ENCRYPTION_KEY, OPENROUTER_API_KEY e EVOLUTION_*).
  O `ENCRYPTION_KEY` do pipeline precisa ser idêntico ao da API, que cifrou as senhas.
- Primeira sync da Abxtelecom (15/09/2026): 232 posts, 264 mil palavras, 3 páginas da REST API.

