# SOP: Agente Revisor GEO/QA (Skill §63, §64)

## Objetivo
Auditar o artigo pronto, pontuar as 11 categorias do §64 e decidir se ele pode seguir.
**O Revisor nunca reescreve o texto.** Quem corrige é o Redator, na rodada 2.

## Por que read-only
`imagem` e `revisar` rodam em paralelo depois de `validar_links`. O job de imagem reescreve
`conteudo_md` ao posicionar as imagens de apoio. Se o Revisor também escrevesse o markdown,
os dois gravariam a mesma coluna sem transação: lost update garantido no D1.

O Revisor grava só `articles.qa`.

## Entradas
- `conteudo_md` editado
- `briefing`, perfil do cliente, `seo` do Editor
- `dossie.pesquisa` (intenção e cluster diagnosticados)
- `rodada` (1 ou 2)

## Execução
- Job de fila: `tipo = 'revisar'`
- Módulos:
  - `execution/src/openrouter/revisor.ts` → `runRevisor` (temperature 0.1: auditoria pede
    consistência, não criatividade)
  - `execution/src/skill/skill.ts` → bloco `REVISOR` + `NUCLEO`
  - `execution/src/skill/qa.ts` → `normalizeQa`, `decidirAcaoPosRevisao`
- Modelo: `OPENROUTER_MODEL_REVISOR` (cai em `OPENROUTER_MODEL_EDITOR` se vazio)

## Saída (`articles.qa`)
- `score` — 11 categorias de 0 a 10: intencao_busca, profundidade, originalidade, seo,
  geo_aeo, eeat, ux, conversao, atualidade, qualidade_fontes, naturalidade
- `veredito`, `reprovadas`
- `correcoes[]` — `{ categoria, problema, correcao, trecho }`
- `fatos_sem_fonte[]` (§12, §57)
- `diferenciacao_ia` (§50)

## O gate
Skill §64: nenhuma categoria pode ficar abaixo de 8.

**O veredito é sempre recalculado a partir do score.** O modelo pode declarar "aprovado" com
nota 6; `normalizeQa` ignora a declaração e decide pelo número. Categoria ausente vira 0, não
10: omitir não pode ser caminho para aprovação.

## Junção e decisão
O Queue não tem barreira de sincronização. O último dos dois jobs (`imagem`, `revisar`) a
terminar consulta o irmão em `jobs` pelo par `(article_id, tipo)` e só então decide:

| Situação | Ação |
|---|---|
| Aprovado | `em_revisao` — pronto para agendamento |
| Reprovado, rodada 1 | volta a `redigir` com as correções; `imagem` reaproveita o R2 |
| Reprovado, rodada 2 | `em_revisao` com o relatório visível; decide um humano |
| Sem `qa` (Revisor falhou) | `em_revisao` — a falha do Revisor não trava o artigo |

Chegar à junção define status e `erro_msg` de uma vez. Sem limpar `erro_msg`, a ordem em que
os dois jobs paralelos terminam decidiria o status final, e um retry bem-sucedido da fila
deixaria o artigo preso em `erro`. O erro do job continua em `jobs` e no painel de erros.

Os dois jobs podem terminar quase juntos e ambos enxergarem o irmão pronto. A trava é um
`UPDATE ... WHERE status <> 'gerando'`: só quem muda a linha enfileira a correção.

## Rodada 2
- O Redator recebe `renderCorrecoesParaPrompt(qa)` e a **versão reprovada**, com instrução de
  corrigir em vez de recomeçar
- `imagem` roda com `reaproveitar: true`: reposiciona os objetos já gravados no R2 a partir de
  `dossie.imagens_refs`. Sem isso, cada reprovação custaria 3 imagens
- Não existe rodada 3 (`RODADA_MAXIMA = 2`)

## Edge cases
- Categoria omitida pelo modelo → 0 → reprova
- Nota fora de 0-10 → truncada ao intervalo
- Correção sem `problema` ou sem `correcao` → descartada: não é acionável
- Categoria inválida na correção → cai em `naturalidade` em vez de quebrar
- Resposta nula → reprovado, nunca aprovado por omissão

## Critérios de validação
- `scoreAprovado` só devolve true com as 11 categorias em 8 ou mais
- `decidirAcaoPosRevisao` devolve `escalar_humano` na rodada 2, nunca `corrigir`
- O relatório aparece na UI quando o artigo para em `em_revisao` reprovado

## Custo
1 chamada por rodada. Caminho feliz do artigo: 4 chamadas (pesquisar, redigir, editar,
revisar). Pior caso com correção: 6.
