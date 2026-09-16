# Design: time de agentes da Skill P12 + perfil de cliente

Data: 2026-09-16
Status: aprovado

## Problema

Três lacunas se somam hoje:

1. **Perfil do cliente nunca é preenchido.** `frontend/components/client-form.tsx` grava
   `perfil_marca: null` em toda criação e edição. O pipeline aborta em
   `workers/pipeline/src/index.ts` com `Briefing ou perfil de marca ausente`. Nenhum artigo
   passa do primeiro job.
2. **A Skill editorial não existe no código.** O documento "Redator Sênior SEO + GEO + AEO +
   UX + CRO" (74 seções) define o padrão de qualidade, mas os `SYSTEM_PROMPT` atuais são
   parágrafos curtos que cobrem uma fração dele.
3. **Um único agente por etapa.** `redigir` e `editar` concentram pesquisa, redação, SEO,
   verificação de fatos e controle de qualidade em duas chamadas. Não há etapa de pesquisa
   nem gate de qualidade.

## Decisões

| Decisão | Escolha | Alternativa descartada |
|---|---|---|
| Armazenamento do perfil | Expandir o JSON de `clients.perfil_marca` | Coluna nova; tabela chave/valor |
| Aplicação da Skill | Markdown versionado + blocos de prompt por papel | Skill inteira em todo prompt; texto editável no D1 |
| Preenchimento | Aba "Perfil" com seções agrupadas | Wizard; extração por IA |
| Time de agentes | 5 agentes LLM | 7 agentes; 3 agentes |
| Coordenação | Fila + dossiê compartilhado | Orquestrador com tool calling; Durable Object |
| Gate de qualidade | 1 rodada de correção, depois humano | Sempre humano; só registrar score |
| Paralelismo | `imagem` ‖ `revisar` | Tudo sequencial; pesquisa em leque |
| Leitura do WordPress | `per_page=5`, gravação por bloco | `per_page=100`; gravação única no fim |

## Arquitetura

### Cadeia de jobs

```
pesquisar → redigir → editar → validar_links → ┬→ imagem ──┐
                                               └→ revisar ─┴→ junção
                                                              ├ aprovado            → em_revisao
                                                              ├ reprovado, rodada 1 → redigir (rodada 2)
                                                              └ reprovado, rodada 2 → em_revisao + alerta
```

`publicar` permanece disparado pelo usuário, como hoje.

### Race condition evitada

`imagem` reescreve `conteudo_md` ao posicionar as imagens de apoio. Se o Revisor também
reescrevesse o texto, os dois jobs paralelos gravariam a mesma coluna sem transação — lost
update no D1.

**Regra:** o Revisor é read-only sobre `conteudo_md`. Ele audita, pontua e emite relatório em
`articles.qa`. Quem corrige é o Redator na rodada 2.

### Junção

Não existe barreira de sincronização no Queue. O último dos dois jobs (`imagem`, `revisar`) a
terminar consulta o irmão em `jobs` pelo par `(article_id, tipo)` e só então aplica o veredito.
Se o irmão ainda está `pendente` ou `rodando`, o job atual não decide nada.

### Rodada 2

Reprovação na rodada 1 reenfileira `redigir` com `{ rodada: 2, correcoes }`. O ciclo repete,
mas `imagem` roda com `reaproveitar: true`: reposiciona os objetos já gravados no R2 a partir
de `dossie.imagens_refs`, sem gerar imagem nova. Sem isso, cada reprovação custaria 3 imagens.

## Os 5 agentes

| Agente | Job | Seções da Skill | Escreve |
|---|---|---|---|
| Pesquisador | `pesquisar` | §3–§8, §46, §66 | `dossie.pesquisa` |
| Redator | `redigir` | §9–§27, §43–§45, §52–§54 | `conteudo_md` |
| Editor SEO | `editar` | §28–§42, §45, §48 | `seo`, `geo`, `schema_jsonld`, `conteudo_md` |
| Revisor GEO/QA | `revisar` | §10–§12, §56–§58, §63, §64 | `qa` |
| Pauteiro | `sugerir_pautas` | §5, §6, §66, §67 | `article_ideas` |

Todos recebem `NUCLEO` (ordem de prioridade §65, proibições absolutas §73, princípio final §74)
+ o bloco do próprio papel + o perfil do cliente renderizado como texto.

Custo: 4 chamadas no caminho feliz (hoje 2), 6 no pior caso.

## Dossiê

`articles.dossie` é o contrato de handoff. Cada agente lê o dossiê inteiro e escreve só a sua
fatia.

```jsonc
{
  "skill_version": "1.0.0",
  "rodada": 1,
  "pesquisa": {
    "intencao": "informacional",
    "estagio_consciencia": "procura solucoes",
    "entidades": [],
    "cluster": "",
    "pagina_pilar": "",
    "perguntas": [],
    "canibalizacao": [{ "url": "", "titulo": "", "risco": "alto", "recomendacao": "atualizar" }],
    "blocos_citaveis": []
  },
  "imagens_refs": [{ "secao": "", "r2_key": "", "alt": "" }],
  "pendencias": []
}
```

`pendencias[]` carrega o que a Skill §2 manda sinalizar em vez de inventar.

## Perfil do cliente

32 campos da lista do usuário + `diretriz_visual` (33º, exigido por `directives/imagem.md`),
organizados em 8 blocos. Armazenados em `clients.perfil_marca`, sem migration.

| Bloco | Campos |
|---|---|
| Identidade e marca | `nome_empresa`, `site`, `posicionamento`, `tom_de_voz`, `diretriz_visual` |
| Oferta | `servicos[]`, `produtos[]`, `servicos_prioritarios[]`, `especialidades[]`, `diferenciais[]`, `ticket_medio` |
| Mercado | `publico_alvo`, `icp`, `area_geografica`, `cidades_prioritarias[]`, `concorrentes[]` |
| Autoridade (E-E-A-T) | `profissionais_responsaveis[]`, `certificacoes[]`, `diferenciais_reais[]`, `dados_proprietarios[]`, `cases[]` |
| Site e conteúdo | `paginas_importantes[]`, `paginas_servicos[]`, `artigos_publicados[]` |
| Comercial | `objetivos_comerciais[]`, `ctas_permitidos[]`, `formas_contato[]`, `crm_qualificacao` |
| Insights do comercial | `perguntas_frequentes[]`, `objecoes_comerciais[]` |
| Compliance | `restricoes_legais[]`, `restricoes_compliance[]`, `informacoes_proibidas[]` |

Distinções deliberadas:

- `diferenciais` (alegados) e `diferenciais_reais` (comprováveis) são campos separados, como a
  Skill §21/§22 exige. Só `diferenciais_reais` alimenta `provas_eeat`.
- `artigos_publicados` é complementar. A fonte primária continua sendo o corpus `client_posts`.

### Compatibilidade

`PerfilCliente` é superset de `PerfilMarca`. Os 8 campos legados continuam declarados e são
derivados por `normalizePerfilCliente()`:

| Campo legado | Derivado de |
|---|---|
| `descricao_institucional` | `posicionamento` |
| `segmentos_atendidos` | `publico_alvo` + `icp` |
| `servicos` | `servicos` (mesmo formato `{ nome, url }`) |
| `provas_eeat` | `diferenciais_reais` + `certificacoes` + `cases` |
| `tom_de_voz` | `tom_de_voz` |
| `proibicoes` | `informacoes_proibidas` + `restricoes_legais` + `restricoes_compliance` |
| `cta_padrao` | primeiro item de `ctas_permitidos` |
| `diretriz_visual` | `diretriz_visual` |

### Mínimo obrigatório

`validatePerfilCliente()` exige `nome_empresa`, `site`, `servicos`, `publico_alvo` e
`tom_de_voz`. O pipeline nomeia os campos faltantes em vez do genérico
`Briefing ou perfil de marca ausente`.

## Sincronização do corpus

`fetchPublishedPosts` passa de "acumula tudo e devolve" para streaming com callback por bloco:

- `per_page: 5`, `orderby=modified&order=asc` mantido (é o que torna a retomada confiável)
- cada bloco é limpo, mapeado e gravado em `client_posts` + espelhado em `client_urls`
- relatório consolidado no fim, em `jobs.payload.resultado`

Consequências tratadas:

- **Trava de segurança** passa a contar posts (6.000), não páginas. Com `per_page=5`, 60
  páginas cobririam apenas 300 posts.
- **Continuação automática:** ao se aproximar do teto de tempo do consumer, o job grava o que
  coletou, enfileira um `sincronizar_corpus` de continuação e sai. A retomada usa
  `MAX(wp_modified)` e é exata.
- **Falha parcial não descarta nada.** Erro no post 200 preserva os 199 anteriores.

## Migration 008

- `articles.dossie TEXT` e `articles.qa TEXT`
- rebuild da tabela `jobs` para o `CHECK` aceitar `pesquisar` e `revisar` (padrão
  `defer_foreign_keys` das migrations 006/007)
- `app_settings`: `openrouter_model_pesquisador`, `openrouter_model_revisor`

## Camada 1 — diretivas

Novas: `skill_redator_p12.md` (a Skill completa), `perfil_cliente.md` (as 32 perguntas e o que
cada uma alimenta), `pesquisar.md`, `revisar.md`.

Atualizadas: `README.md`, `redator.md`, `editor_seo_geo.md`, `sugerir_pautas.md`, `imagem.md`,
`sincronizar_corpus.md`.

## Camada 3 — `execution/src/skill/`

| Arquivo | Responsabilidade |
|---|---|
| `skill.ts` | Blocos de prompt versionados (`SKILL_VERSION`, `NUCLEO`, `REDATOR`, `EDITOR`, `PESQUISADOR`, `REVISOR`, `PAUTEIRO`) |
| `perfil.ts` | `normalizePerfilCliente`, `validatePerfilCliente`, `renderPerfilParaPrompt`, `calcularCompletude` |
| `campos.ts` | Metadados dos 33 campos (chave, label, bloco, tipo, obrigatório, dica) — fonte única para UI e validação |
| `dossie.ts` | `emptyDossie`, `mergeDossie`, leitura/escrita segura |
| `qa.ts` | `normalizeQa`, `scoreAprovado` (nenhuma categoria < 8), `resumoReprovacao` |

## Testes

Vitest, sem chamada paga a modelo:

- normalizador e validador do perfil, incluindo derivação dos campos legados
- completude por bloco
- montagem dos blocos da Skill por papel
- parser e gate do score §64
- lógica de junção: aprovado, rodada 1, rodada 2
- reaproveitamento de imagem na rodada 2
- streaming do corpus em blocos de 5 e retomada por `wp_modified`

## Fora de escopo

- Durable Object / Agents SDK
- Extração do perfil por IA a partir de texto colado
- Agentes separados de fact-checking e CRO (absorvidos por Revisor e Editor)
- Integração com Search Console, Trends ou CRM (§67, §71)
