# SOP: Agente Pauteiro (sugestão de pautas a partir do blog publicado)

## Objetivo
Ler o inventário completo de artigos já publicados pelo cliente e propor pautas NOVAS,
sem repetir tema coberto, já ligadas aos artigos que devem virar links internos.

## Entradas
- Corpus do cliente (`client_posts`) compactado: título, url, categorias, data, palavras, resumo (200 chars)
- Perfil do cliente (`directives/perfil_cliente.md`), renderizado no system prompt
- `pautas_ja_sugeridas`: temas em `article_ideas` com status `nova` ou `usada`
- `quantidade` (1–15, padrão 5) e `foco` opcional (tema, categoria ou etapa de funil)

## Execução
- Job de fila: `tipo = 'sugerir_pautas'`, escopo cliente
- Módulos:
  - `execution/src/corpus/store.ts` → `listCorpusForPrompt`
  - `execution/src/openrouter/pauteiro.ts` → `buildCorpusDigest`, `runPauteiro`, `normalizePautas`
  - `execution/src/skill/skill.ts` → bloco `PAUTEIRO` + `NUCLEO` (Skill §5, §6, §66, §67)
  - `execution/src/corpus/ideas.ts` → `listTemasJaSugeridos`, `saveIdeas`
- Modelo: `OPENROUTER_MODEL_PAUTEIRO` (cai em `OPENROUTER_MODEL_EDITOR` se vazio)
- Custo: 1 chamada OpenRouter por execução, sempre disparada pelo usuário. Nunca em cron.

## Regras obrigatórias (system prompt)
- Proibido propor tema já coberto pelo inventário ou repetido em `pautas_ja_sugeridas`
- Toda pauta cita ao menos 1 URL do inventário em `artigos_relacionados`
- `cluster` sai do próprio inventário; `justificativa` explica a lacuna coberta
- `risco_canibalizacao` aponta o artigo existente que compete, ou `null`
- Respeitar as restrições do perfil do cliente (Skill §61)
- Priorizar por relevância comercial + demanda + aderência à autoridade, nunca por volume isolado (§66)
- **Proibido inventar números, datas ou estatísticas**
- Textos em português do Brasil

## Saídas
- Linhas em `article_ideas` (status `nova`, payload com a `PautaSugerida` completa)
- `jobs.payload.resultado`: `{ pautas_geradas, posts_considerados, corpus_truncado }`
- Botão "Criar artigo" converte a pauta em `articles` com o briefing preenchido e marca a pauta como `usada`

## Edge cases
- Corpus vazio: API rejeita com 400 ("sincronize os artigos publicados antes")
- Corpus acima de 120k chars: `buildCorpusDigest` corta pelos mais recentes e sinaliza `corpus_truncado`
- Modelo devolve pauta sem `tema` ou `kw_principal`: `normalizePautas` descarta a linha
- Nenhuma pauta válida: job termina em erro com mensagem clara, nada é gravado
- URLs fora de `http(s)` em `artigos_relacionados` são removidas

## Critérios de validação
- Nenhuma pauta repete título já publicado
- 100% das pautas com ao menos 1 `artigo_relacionado` do próprio domínio
- `artigos_relacionados` alimenta `briefing.artigos_irmaos` ao virar artigo
