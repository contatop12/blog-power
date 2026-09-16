# SOP: Agente Redator (PRD §7.1 / Skill §9-§27, §43-§45, §51-§54)

## Objetivo
Escrever o artigo em Markdown a partir do briefing, do diagnóstico do Pesquisador e do perfil
do cliente.

## Entradas
- `briefing` (JSON — PRD §5.2)
- Perfil do cliente (`directives/perfil_cliente.md`), renderizado como texto no system prompt
- `dossie.pesquisa`: intenção, estágio de consciência, entidades, cluster, canibalização,
  blocos citáveis sugeridos
- `urls_relevantes`: lista de `{ url, titulo, resumo }` de `client_urls` (contexto, não link)
- `artigos_irmaos`: títulos do corpus próximos do tema
- Na rodada 2: `qaAnterior` (relatório do Revisor) e `conteudoAnterior` (versão reprovada)

## Execução
- Job de fila: `tipo = 'redigir'`
- Módulo: `execution/src/openrouter/redator.ts` → `runRedator`
- System prompt: `NUCLEO` + bloco `REDATOR` + perfil renderizado
- Modelo: `OPENROUTER_MODEL_REDATOR`

## Saída
- Markdown puro (`conteudo_md`), status do artigo vai para `rascunho`
- `jobs.payload.resultado`: `{ rodada, corrigindo, correcoes_aplicadas }`

## Regras obrigatórias (bloco REDATOR)
- Um H1 único; H2/H3 sem pular níveis
- H2 que é pergunta responde na primeira frase (§9); pirâmide invertida (§52)
- FAQ com mínimo 5 perguntas plausíveis ao final (§34)
- Introdução sem as aberturas genéricas proibidas em §16
- **Sem travessão como recurso recorrente** e sem os clichês listados em §17
- Termo técnico explicado na primeira ocorrência (§19)
- CTA só de `ctas_permitidos` do perfil, posicionado após trecho que mostre a necessidade
- Originalidade só com o que existe no perfil: dados proprietários, cases, metodologia (§21)
- **Proibido inventar números, percentuais, datas ou estatísticas**
- **Proibido inserir links** — responsabilidade do Editor

## Rodada de correção
Quando o Revisor reprova na rodada 1, o job roda de novo com as correções. O prompt muda de
"escreva o artigo" para "reescreva aplicando as correções", e o Redator recebe a versão
reprovada para corrigir em vez de recomeçar do zero. Ver `directives/revisar.md`.

## Edge cases
- Artigo irmão vazio: prossegue sem contexto de cluster
- `dossie.pesquisa` nulo (pesquisa falhou ou artigo veio de texto colado): o bloco de
  diagnóstico some do prompt e o Redator trabalha só com briefing e perfil
- Perfil incompleto: o job falha antes da chamada, nomeando os campos faltantes
- Extensão alvo não atingida: não forçar padding genérico (§20)

## Critérios de validação
- Presença de H1, ≥3 H2, FAQ ≥5 itens
- Nenhuma URL no markdown
