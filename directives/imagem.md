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
