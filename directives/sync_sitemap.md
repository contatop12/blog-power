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
- Sitemap index com múltiplos sub-sitemaps: seguir recursivamente
- URL duplicada: upsert por UNIQUE(client_id, url)
- Timeout em URL lenta: registrar http_status null, retry manual

## Critérios de validação
- Pelo menos 1 URL inserida (sites com sitemap válido)
- Nenhuma URL inventada
