# SOP: Perfil do Cliente (Skill §2)

## Objetivo
Capturar o que os agentes precisam saber sobre o negócio do cliente. A Skill trata o perfil
como **fonte primária**: o que não estiver aqui não pode ser inventado.

## Onde vive
- Coluna `clients.perfil_marca` (JSON). O nome é legado; o conteúdo é um `PerfilCliente`.
- Tela: aba **Perfil** na página do cliente (`frontend/components/client-profile-form.tsx`)
- API: `GET /clients/:id/perfil` e `PUT /clients/:id/perfil`
- Metadados dos campos: `types/src/perfil-campos.ts` — fonte única para UI, validação,
  completude e renderização de prompt. Mexeu no campo, mexeu ali.

## Os 33 campos

32 vêm da lista de briefing. `diretriz_visual` é o 33º, exigido por `directives/imagem.md`.

| Bloco | Campos |
|---|---|
| Identidade e marca | `nome_empresa`*, `site`*, `posicionamento`, `tom_de_voz`*, `diretriz_visual` |
| Oferta | `servicos`*, `produtos`, `servicos_prioritarios`, `especialidades`, `diferenciais`, `ticket_medio` |
| Mercado | `publico_alvo`*, `icp`, `area_geografica`, `cidades_prioritarias`, `concorrentes` |
| Autoridade (E-E-A-T) | `profissionais_responsaveis`, `certificacoes`, `diferenciais_reais`, `dados_proprietarios`, `cases` |
| Site e conteúdo | `paginas_importantes`, `paginas_servicos`, `artigos_publicados` |
| Comercial | `objetivos_comerciais`, `ctas_permitidos`, `formas_contato`, `crm_qualificacao` |
| Insights do comercial | `perguntas_frequentes`, `objecoes_comerciais` |
| Compliance | `restricoes_legais`, `restricoes_compliance`, `informacoes_proibidas` |

`*` = obrigatório. Sem os cinco, o pipeline recusa antes de gastar chamada de modelo.

## Distinções que importam

**`diferenciais` × `diferenciais_reais`.** O primeiro é o que a empresa alega; o segundo é o
que ela consegue demonstrar. Skill §21/§22: só o comprovável vira prova de E-E-A-T, e só
`diferenciais_reais` alimenta `provas_eeat`.

**`artigos_publicados` é complementar.** A fonte primária de conteúdo já publicado é o corpus
`client_posts`, sincronizado do WordPress. Este campo serve para URLs que o cliente quer
destacar e que talvez não estejam no blog.

**`ticket_medio` nunca é publicado.** Serve para calibrar profundidade e carga comercial.

**`concorrentes` nunca vira link externo.** Skill §59: servem para achar lacuna, não para
receber tráfego.

## O que cada campo alimenta

| Campo | Consumidor |
|---|---|
| `servicos`, `paginas_servicos`, `paginas_importantes` | Editor: destinos prioritários de link interno (§14) |
| `diferenciais_reais`, `certificacoes`, `cases`, `dados_proprietarios` | Redator: originalidade (§21) e E-E-A-T (§22); Revisor: `diferenciacao_ia` (§50) |
| `perguntas_frequentes`, `objecoes_comerciais` | Redator: FAQ (§34) e blocos citáveis (§51); Pauteiro: pautas de fundo de funil |
| `ctas_permitidos`, `formas_contato`, `crm_qualificacao` | Redator: CTA por etapa de funil (§26, §27) |
| `restricoes_*`, `informacoes_proibidas` | Todos: prioridade absoluta sobre conversão (§61) |
| `cidades_prioritarias`, `area_geografica` | Pesquisador: decide se cabe SEO local (§42) |
| `profissionais_responsaveis` | Editor: autoria e revisão técnica (§36) |
| `diretriz_visual` | Agente de imagem (§37-§41) |
| `tom_de_voz`, `posicionamento` | Redator (§44) |

## Compatibilidade com o perfil legado
`PerfilCliente` é superset de `PerfilMarca`. `normalizePerfilCliente` deriva os 8 campos
antigos a partir dos novos, e também aceita um perfil antigo como entrada:

| Legado | Derivado de |
|---|---|
| `descricao_institucional` | `posicionamento` |
| `segmentos_atendidos` | `publico_alvo` + `icp` |
| `provas_eeat` | `diferenciais_reais` + `certificacoes` + `cases` |
| `proibicoes` | `informacoes_proibidas` + `restricoes_legais` + `restricoes_compliance` |
| `cta_padrao` | primeiro item de `ctas_permitidos` |

## Execução
- `execution/src/skill/perfil.ts`
  - `normalizePerfilCliente` — coerção, derivação, aceita perfil legado e JSON parcial
  - `validatePerfilCliente` — mínimo obrigatório; a mensagem de erro **nomeia os campos**
  - `calcularCompletude` — percentual global e por bloco
  - `renderPerfilParaPrompt` — texto compacto, só campos preenchidos

## Regras
- Salvamento parcial é permitido. A completude mostra o que falta.
- Campo vazio é omitido do prompt de propósito: o agente precisa enxergar a ausência como
  ausência. Quando falta obrigatório, o prompt diz explicitamente para não preencher sozinho.
- Lista vazia não conta como preenchida na completude.

## Edge cases
- Perfil nulo: `normalizePerfilCliente` devolve perfil zerado, nunca lança
- Perfil legado puro: convertido sem perda; os campos novos ficam vazios
- Campo novo e legado preenchidos ao mesmo tempo: o novo vence
- Item de lista estruturada sem a chave obrigatória (`servicos` sem `nome`, `paginas_*` sem
  `url`, `profissionais_*` sem `nome`) é descartado na normalização

## Critérios de validação
- `validatePerfilCliente` reprova perfil sem um dos 5 obrigatórios e nomeia quais
- `renderPerfilParaPrompt(null)` devolve `'PERFIL DO CLIENTE: não preenchido.'`
- Perfil legado convertido mantém `cta_padrao` e `proibicoes` coerentes

## Aprendizados
- O formulário de cliente gravava `perfil_marca: null` em toda criação e edição. O pipeline
  abortava em `redigir` com "Briefing ou perfil de marca ausente" e nenhum artigo passava do
  primeiro job. A aba Perfil e a validação nomeada resolvem os dois lados do problema.
