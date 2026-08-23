# SOP: Agente Redator (PRD §7.1)

## Objetivo
Gerar artigo completo em Markdown a partir do briefing, perfil de marca e contexto de URLs relevantes.

## Entradas
- `briefing` (JSON — PRD §5.2)
- `perfil_marca` (JSON — PRD §5.1)
- `urls_relevantes`: lista de `{ url, titulo, resumo }` de `client_urls`
- `artigos_irmaos`: resumos de artigos relacionados já produzidos

## Execução
- Módulo: `execution/openrouter/redator.ts`
- Modelo: `OPENROUTER_MODEL_REDATOR` (configurável)

## Saída
- Markdown puro (`conteudo_md`)

## Regras obrigatórias (system prompt)
- Um H1 único com KW principal
- Hierarquia H2/H3 sem pular níveis
- Answer capsule (50–100 palavras) nos primeiros 2 parágrafos após introdução
- FAQ com mínimo 5 perguntas ao final
- Blocos de decisão quando tema comparativo
- CTA final ancorado em provas E-E-A-T
- **Proibido inventar números, percentuais, datas ou estatísticas**
- **Proibido inserir links** — responsabilidade do Editor

## Edge cases
- Artigo irmão vazio: prosseguir sem contexto de cluster
- Extensão alvo não atingida: não forçar padding genérico

## Critérios de validação
- Presença de H1, ≥3 H2, FAQ ≥5 itens
- Nenhuma URL no markdown
