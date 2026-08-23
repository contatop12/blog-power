# SOP: Validação de Links Internos (PRD §6 passo 5)

## Objetivo
Validar cada link interno proposto com requisição HTTP. Status ≠ 200 → remover e reportar.

## Entradas
- `links_internos` de `seo.json`
- `conteudo_md` (opcional, para remoção de links inválidos)

## Execução
- Módulo: `execution/links/validate.ts`

## Saídas
- Lista atualizada com `status_validacao` por link
- Links inválidos removidos do SEO e do markdown
- `bloqueio_publicacao: true` se algum link obrigatório falhar

## Edge cases
- Redirect 301/302 para URL final 200: aceitar como válido
- Timeout: tratar como falha, não publicar
- Link relativo: resolver contra `dominio` do cliente

## Critérios de validação
- 100% dos links publicados com HTTP 200 (critério MVP §13)
