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
  - `execution/src/wordpress/corpus.ts` → `fetchPublishedPosts` (pagina `/wp/v2/posts?status=publish&_embed=wp:term`)
  - `execution/src/corpus/store.ts` → `upsertCorpusPosts`, `getUltimoModified`
- Sync incremental: usa `MAX(wp_modified)` do corpus como `modified_after`
- Conteúdo salvo como texto limpo (sem tags, sem comentários Gutenberg), truncado em 60k chars

## Saídas
- Linhas em `client_posts` (chave: `client_id + wp_post_type + wp_post_id`)
- `jobs.payload.resultado`: `{ total_lidos, inseridos, atualizados, paginas_lidas, tipos }`

## Edge cases
- Application Password ausente: API rejeita com 400 antes de enfileirar
- WP recusa página além do total (`rest_post_invalid_page_number`): encerra a paginação sem erro
- Trava de segurança: no máximo 60 páginas por tipo (6.000 posts)
- Job já em andamento para o mesmo cliente: API responde 409 com o `job_id` existente
- Post editado no WP: o upsert sobrescreve a linha, nunca duplica

## Critérios de validação
- `client_posts.total` bate com a contagem de posts publicados no WP
- Rodar duas vezes seguidas em modo incremental não insere nada novo
- `conteudo_txt` sem `<` e sem `<!-- wp:`

## Aprendizados
- `date_gmt`/`modified_gmt` vêm sem sufixo de fuso; o módulo acrescenta `Z` (PRD exige UTC explícito)
- Ordenar por `modified asc` é o que torna o `modified_after` confiável
- Cada post sincronizado é espelhado em `client_urls` (`origem = 'wordpress'`) por
  `mirrorCorpusToClientUrls`: o PRD exige links internos somente de `client_urls`.
  Migration 007 libera a origem e faz backfill do corpus já existente.
