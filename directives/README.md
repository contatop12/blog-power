# Diretivas (Camada 1)

Esta pasta guarda SOPs em Markdown com:

- objetivo da tarefa;
- entradas esperadas;
- módulos `execution/` a utilizar;
- formato de saída;
- edge cases e critérios de validação.

Crie novas diretivas somente quando necessário e com aprovação do usuário.

## A Skill

`skill_redator_p12.md` é o padrão editorial completo (74 seções): SEO, GEO, AEO, UX e CRO.
Ela não entra inteira em nenhum prompt. `execution/src/skill/skill.ts` recorta a Skill em
blocos por papel, e cada agente recebe `NUCLEO` + o bloco do seu papel + o perfil do cliente.

Mudou uma regra na Skill? Mude o bloco correspondente em `skill.ts` e suba `SKILL_VERSION`.
A versão fica gravada em `articles.dossie.skill_version`.

## O time de agentes

```
pesquisar → redigir → editar → validar_links → ┬→ imagem ──┐
                                               └→ revisar ─┴→ junção
                                                              ├ aprovado            → em_revisao
                                                              ├ reprovado, rodada 1 → redigir
                                                              └ reprovado, rodada 2 → em_revisao + alerta
```

`publicar` continua sendo disparado pelo usuário.

Os agentes se comunicam pelo **dossiê** (`articles.dossie`): cada um lê o dossiê inteiro e
escreve só a sua fatia. O Revisor é read-only sobre `conteudo_md` — ele grava em
`articles.qa`, e é isso que torna o paralelismo com `imagem` seguro.

## Índice

| Arquivo | Agente / assunto |
|---|---|
| `skill_redator_p12.md` | A Skill completa (referência) |
| `perfil_cliente.md` | Perfil de 33 campos — fonte primária sobre o negócio (Skill §2) |
| `pesquisar.md` | Agente Pesquisador (Skill §3-§8, §46) |
| `redator.md` | Agente Redator (PRD §7.1) |
| `editor_seo_geo.md` | Agente Editor SEO/GEO (PRD §7.2) |
| `revisar.md` | Agente Revisor GEO/QA (Skill §63, §64) |
| `imagem.md` | Agente de Imagem (PRD §7.3) |
| `sugerir_pautas.md` | Agente Pauteiro |
| `sincronizar_corpus.md` | Base de conhecimento do cliente (leitura em blocos de 5) |
| `sync_sitemap.md` | Sincronização de inventário de URLs |
| `validar_links.md` | Validação HTTP de links internos |
| `publicar_wordpress.md` | Publicador WordPress (PRD §8) |
| `testar_conexao.md` | Checklist de onboarding do cliente |
