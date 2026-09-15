# SOP: Sincronização de Sitemap (PRD §9.1)

## Objetivo
Crawl do `sitemap.xml` do cliente e popular `client_urls` com URLs reais.

## Entradas
- `client_id`
- `dominio` do cliente (ex: `https://abxtelecom.com.br`)

## Execução
- Módulo: `execution/sitemap/sync.ts`
- Resumo por URL via LLM: stub no scaffold (titulo extraído do sitemap)

## Saídas
- Registros upsert em `client_urls` com `origem: sitemap`
- Contagem de URLs sincronizadas

## Edge cases
- Sitemap index com múltiplos sub-sitemaps: baixar em paralelo (até 6)
- Pular sitemaps de imagem/vídeo/news/attachment/author/tag (não servem a links internos)
- URL duplicada: upsert por UNIQUE(client_id, url) em batch D1 (chunks de 80)
- Timeout em URL lenta: registrar http_status null, retry manual
- Tentar `sitemap.xml`, `sitemap_index.xml` e `wp-sitemap.xml`

## Critérios de validação
- Pelo menos 1 URL inserida (sites com sitemap válido)
- Nenhuma URL inventada
