# SOP: Agente Pesquisador (Skill §3-§8, §46)

## Objetivo
Definir o terreno antes de o Redator gastar uma chamada. Classifica a intenção de busca,
identifica cluster e entidades, e confronta a pauta com o que o cliente **já publicou** para
detectar canibalização.

É o primeiro job da cadeia: `pesquisar → redigir → editar → validar_links → imagem ‖ revisar`.

## Entradas
- `briefing` do artigo
- Perfil do cliente (`directives/perfil_cliente.md`) — mínimo obrigatório validado antes
- Inventário publicado: até 60 posts de `client_posts`, ranqueados por `rankRelatedPosts`
  contra o briefing

## Execução
- Job de fila: `tipo = 'pesquisar'`
- Módulos:
  - `execution/src/openrouter/pesquisador.ts` → `runPesquisador`
  - `execution/src/skill/skill.ts` → bloco `PESQUISADOR` + `NUCLEO`
  - `execution/src/skill/dossie.ts` → `normalizePesquisa`, `normalizeCanibalizacao`
- Modelo: `OPENROUTER_MODEL_PESQUISADOR` (cai em `OPENROUTER_MODEL_EDITOR` se vazio)
- Custo: 1 chamada por artigo. O resultado fica no dossiê, então retry do job seguinte
  não repaga a pesquisa.

## Saídas
Grava `articles.dossie.pesquisa`:

- `intencao` — informacional, comercial, transacional, navegacional, local, comparativa,
  investigativa ou problema_solucao
- `estagio_consciencia` — de `desconhece_problema` a `pronto_para_contratar`
- `entidades`, `kws_relacionadas`, `perguntas`
- `cluster`, `pagina_pilar`
- `canibalizacao[]` — `{ url, titulo, risco, recomendacao, motivo }`
- `blocos_citaveis` — trechos que devem fazer sentido extraídos isoladamente (§10)
- `freshness` — evergreen, semi_evergreen ou alta_volatilidade
- `justificativa`

Também acrescenta `dossie.pendencias` com o que faltou no perfil e não pode ser inventado (§2).

`jobs.payload.resultado`: `{ intencao, cluster, canibalizacao, posts_analisados, pendencias }`.

## Regras obrigatórias (bloco PESQUISADOR)
- URLs em `canibalizacao` só podem vir do inventário recebido. URL inventada é descartada
  na normalização.
- Se um artigo existente já responde à mesma intenção, o risco é `alto` e a recomendação é
  `atualizar`, não criar.
- Entidades servem para explicar o assunto, não para manipular ranking (§7).
- Proibido inventar volume de busca. Sem base, registra em `pendencias`.

## Edge cases
- Corpus vazio: o job roda com inventário vazio; `canibalizacao` sai vazia e o artigo segue
- Perfil incompleto: o job falha antes da chamada, com os campos faltantes nomeados
- Modelo devolve enum em português com acento ("Problema/Solução", "Procura Soluções"):
  `asEnum` remove acento, caixa e separador antes de comparar
- Enum fora do vocabulário: cai no padrão (`informacional`, `procura_solucoes`,
  `semi_evergreen`) em vez de vazar para o dossiê
- Resposta não-objeto: job falha com "Pesquisador devolveu resposta vazia ou inválida"

## Critérios de validação
- Nenhuma URL de `canibalizacao` fora do inventário
- `dossie.skill_version` gravado, para rastrear com que padrão o artigo foi produzido
- Redator e Editor recebem o diagnóstico via `renderPesquisaParaPrompt`

## Aprendizados
- A checagem de canibalização existia só no Pauteiro, no nível da pauta. Um artigo criado
  manualmente podia duplicar a intenção de um post já publicado sem nenhum aviso. Agora o
  conflito aparece antes da redação, e o Redator recebe a instrução de mudar o ângulo.
