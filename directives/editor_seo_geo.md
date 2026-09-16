# SOP: Agente Editor SEO/GEO (PRD §7.2 / Skill §12-§14, §28-§42, §48, §49)

## Objetivo
Revisar artigo (padrão gerador-crítico) e produzir camada estruturada: `seo.json`, `geo.json`, `schema_jsonld`, prompt de imagem.

## Entradas
- `conteudo_md` do Redator
- `briefing`
- Perfil do cliente (`directives/perfil_cliente.md`), renderizado no system prompt
- `dossie.pesquisa`: cluster, entidades e freshness diagnosticados pelo Pesquisador
- `client_urls` (inventário completo do cliente)
- `seo_plugin` do cliente (yoast | rankmath | nenhum)

## Execução
- Job de fila: `tipo = 'editar'`
- Módulo: `execution/src/openrouter/editor.ts` → `runEditor`
- System prompt: `NUCLEO` + bloco `EDITOR` + perfil renderizado
- Modelo: `OPENROUTER_MODEL_EDITOR`

## Saídas
- `conteudo_md` revisado
- `seo` (SeoJson — PRD §7.2)
- `geo` (GeoJson)
- `schema_jsonld` (apenas complementar: FAQPage se Yoast/Rank Math ativos)

## Regras críticas
- Links internos **somente** de `client_urls`
- URLs não publicadas → `links_internos_futuros`, nunca no corpo
- Title SEO 50–60 chars; meta 140–160 chars (referência editorial, não regra absoluta — §28/§29)
- Sem linguagem promocional excessiva (Skill §43)
- Schema: nunca duplicar Article/BreadcrumbList se plugin SEO ativo
- Link externo só quando sustenta uma afirmação; nunca aponta para concorrente (§13, §59)
- Campos complementares do §31: `canonical`, `categoria_sugerida`, `tags_sugeridas`,
  `breadcrumb`. Tag só quando existe taxonomia real no site.
- `freshness` classifica a cadência de revisão do artigo (§49)

## Edge cases
- Link proposto fora do inventário: mover para `links_internos_futuros`
- Cliente sem plugin SEO: emitir grafo JSON-LD completo

## Critérios de validação
- Checklist PRD §7.2 (itens 14–48)
- Após edição: rodar `execution/links/validate.ts`

## Próxima etapa
`validar_links` roda a checagem HTTP e então dispara **em paralelo** `imagem` e `revisar`.
O Revisor audita o resultado desta etapa contra o checklist §63. Ver `directives/revisar.md`.

## Links internos semânticos (base de conhecimento)
Antes do Editor, o pipeline monta `links_candidatos` de forma determinística:
1. `execution/src/links/related.ts` → `rankRelatedPosts` lê **todos** os títulos, categorias,
   tags e resumos de `client_posts` e pontua contra o briefing (KW principal ×3, secundárias ×2,
   tema ×1,5; bônus de frase exata; +6 para URLs de `briefing.artigos_irmaos` vindas da pauta)
2. `getCorpusConteudos` lê o conteúdo completo **só** dos 8 mais próximos
3. `extractTrecho` extrai até 600 chars dos parágrafos que citam os mesmos termos

O Editor recebe `links_candidatos` (url, título, trecho) e insere 3–6 links contextuais.

### Trava pós-Editor (obrigatória)
`execution/src/links/enforce.ts` → `enforceInternalLinks` roda antes de salvar e remove:
link fora de `client_urls`, autolink, URL repetida, link dentro de título, excesso (máx. 8).
A âncora vira texto. `seo.links_internos` é reconciliado com o que ficou no corpo.
Resultado em `jobs.payload.resultado.links_removidos` para diagnóstico.

### Aprendizados
- `markdownToGutenberg` não convertia `[âncora](url)` — links saíam como texto cru no WordPress.
  Corrigido; só `http(s)` e caminhos relativos viram `<a>`.
- Inventário acima de 150 URLs: o Editor recebe serviços/institucionais + 40 mais relevantes,
  mas a trava valida contra o inventário completo.
