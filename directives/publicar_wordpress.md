# SOP: Publicador WordPress (PRD §8)

## Objetivo
Publicar post agendado no WordPress com metadados SEO, schema, imagem destacada, categoria e tags.

## Entradas
- Artigo aprovado (`status: aprovado`)
- `conteudo_html` (blocos Gutenberg)
- `seo`, `schema_jsonld`, `imagem_url`, `imagem_alt`
- `PublishArticleInput`: categorias, tags, autor, `agendado_para`

## Execução
- `execution/markdown/gutenberg.ts` — se ainda em MD
- `execution/wordpress/publish.ts` — upload mídia + POST /wp/v2/posts
- `execution/wordpress/client.ts` — Basic Auth

## Saídas
- `wp_post_id`, `wp_url`
- `status: agendado`
- URL inserida em `client_urls` com `origem: publicado_aqui`

## Regras críticas
- **Sempre `date_gmt` em UTC**, nunca só `date`
- Metadados SEO via mu-plugin `p12-publisher-bridge.php`
- Upload mídia em 2 passos: POST binário → PATCH alt_text
- Basic Auth **somente no Worker**

## Edge cases
- Yoast vs Rank Math: campos meta diferentes conforme `seo_plugin`
- WP-Cron em site de baixo tráfego: documentar no onboarding
- Falha parcial (post criado, meta falhou): registrar erro, não duplicar post

## Critérios de validação
- Post com `status: future` no horário correto (fuso cliente)
- Título SEO e meta gravados no plugin
