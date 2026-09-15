# SOP: Agente de Imagem (PRD §7.3)

## Objetivo
Gerar imagem destacada 1200×630 WebP (<300 KB) com ALT descritivo.

## Entradas
- `prompt` de `seo.imagem.prompt`
- `diretriz_visual` do `perfil_marca`
- `alt` sugerido pelo Editor

## Execução
- Módulo: `execution/images/generate.ts`
- Provider configurável: `IMAGE_PROVIDER` (openrouter | workers_ai)

## Saídas
- Binário WebP em R2 (`imagem_url`)
- `imagem_alt` atualizado

## Edge cases
- Provider indisponível: job falha com mensagem clara; usuário pode regerar na UI
- Imagem >300 KB: recompressão automática (quando implementado)

## Critérios de validação
- Dimensões 1200×630
- ALT não vazio
- Formato WebP

## Imagens no corpo do artigo (destacada + 2 de apoio)
- Provider: Workers AI `@cf/black-forest-labs/flux-1-schnell` (`IMAGE_PROVIDER=workers_ai`, binding `AI`)
- Conversão: binding Cloudflare Images `IMAGE_TRANSFORM` → recorte `cover` + WebP q80; se passar
  de 300 KB, recomprime em q60. Sem o binding (ou falha), publica o JPEG original do modelo.
- Tamanhos: destacada 1200×630; corpo 1200×675
- Módulos:
  - `execution/src/images/generate.ts` → `generateImage` (prompt recebe trava "sem texto/logo")
  - `execution/src/markdown/images.ts` → `resolveImageSlots`, `insertImagesIntoMarkdown`,
    `stripGeneratedImages`, `extractR2ImageRefs`
  - `execution/src/wordpress/publish.ts` → `uploadWpMedia`

### Fluxo
1. Editor devolve `seo.imagens_corpo = [{ secao, prompt, alt }]` (H2 exato, prompt em inglês)
2. Job `imagem`: seção inexistente no texto é ignorada; faltando, `pickImageSections` distribui
   as imagens pelas H2 (nunca FAQ/conclusão)
3. Imagem vai para o R2 (`articles/{id}/corpo-N`) e entra no markdown como `![alt](r2://...)`
   logo após o primeiro parágrafo da seção
4. Job `publicar`: cada `r2://` sobe para a mídia do WP e o HTML é regerado com bloco
   `wp:image` usando o id da mídia. Imagem `r2://` sem upload nunca vira `<img>` quebrado.

### Edge cases
- Falha na destacada: job falha (post sem Open Graph)
- Falha numa imagem do corpo: registrada em `jobs.payload.resultado.falhas`, artigo segue
- "Regerar imagem" remove as imagens geradas antes e gera todas de novo (custo: 3 imagens)
- Retry do job `publicar` pela fila pode duplicar mídia no WordPress (mesmo comportamento da destacada)

### Aprendizados
- O stub antigo devolvia WebP 1×1 e `OPENROUTER_MODEL_IMAGEM` apontava para um modelo de texto:
  nenhum artigo publicava com imagem real.
- FLUX deforma texto: o prompt sempre pede "no text, no letters, no logos".

