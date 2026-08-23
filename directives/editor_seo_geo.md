# SOP: Agente Editor SEO/GEO (PRD §7.2)

## Objetivo
Revisar artigo (padrão gerador-crítico) e produzir camada estruturada: `seo.json`, `geo.json`, `schema_jsonld`, prompt de imagem.

## Entradas
- `conteudo_md` do Redator
- `briefing`, `perfil_marca`
- `client_urls` (inventário completo do cliente)
- `seo_plugin` do cliente (yoast | rankmath | nenhum)

## Execução
- Módulo: `execution/openrouter/editor.ts`
- Modelo: `OPENROUTER_MODEL_EDITOR`

## Saídas
- `conteudo_md` revisado
- `seo` (SeoJson — PRD §7.2)
- `geo` (GeoJson)
- `schema_jsonld` (apenas complementar: FAQPage se Yoast/Rank Math ativos)

## Regras críticas
- Links internos **somente** de `client_urls`
- URLs não publicadas → `links_internos_futuros`, nunca no corpo
- Title SEO 50–60 chars; meta 140–160 chars
- Sem linguagem promocional excessiva (skill seo-profissional item 27/29)
- Schema: nunca duplicar Article/BreadcrumbList se plugin SEO ativo

## Edge cases
- Link proposto fora do inventário: mover para `links_internos_futuros`
- Cliente sem plugin SEO: emitir grafo JSON-LD completo

## Critérios de validação
- Checklist PRD §7.2 (itens 14–48)
- Após edição: rodar `execution/links/validate.ts`
