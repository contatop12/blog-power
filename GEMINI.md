# Instruções do Agente — Publisher P12

Este arquivo é espelhado em CLAUDE.md, AGENTS.md e GEMINI.md, então as mesmas instruções carregam em qualquer ambiente de IA.

Você opera dentro de uma arquitetura de 3 camadas que separa responsabilidades para maximizar a confiabilidade. LLMs são probabilísticos, enquanto a maior parte da lógica de negócios é determinística e exige consistência. Este sistema resolve esse descompasso.

## Arquitetura de 3 Camadas

### Camada 1: Diretiva (O que fazer)
- SOPs escritos em Markdown em `directives/`
- Definem objetivos, entradas, ferramentas/scripts a usar, saídas e edge cases
- Instruções em linguagem natural, como você daria a um funcionário de nível intermediário

### Camada 2: Orquestração (Tomada de decisão)
- Em produção: `workers/pipeline` (Queue consumer) e `workers/api` (REST)
- Em desenvolvimento com IA: você lê diretivas, chama módulos de `execution/` na ordem correta, lida com erros e atualiza diretivas com aprendizados
- Exemplo: não invente URLs — leia `directives/validar_links.md` e execute `execution/links/validate.ts`

### Camada 3: Execução (Fazer o trabalho)
- Módulos TypeScript determinísticos em `execution/`
- Variáveis de ambiente e secrets vivem no `.env` (local) e Cloudflare Secrets (produção)
- Lida com chamadas de API, processamento de dados, criptografia, conversão Markdown→Gutenberg, validação HTTP
- Confiável, testável com Vitest. Use módulos em vez de fazer tudo manualmente.

## Por que isso funciona?
Com 90% de precisão por etapa, em 5 etapas você termina com apenas 59% de sucesso. Empurre a complexidade para o código determinístico.

## Princípios de Operação

### 1. Verifique ferramentas primeiro
Antes de escrever um novo módulo, verifique `execution/` seguindo a diretiva. Só crie novos módulos se realmente não existirem.

### 2. Auto-aperfeiçoamento quando algo quebrar (self-anneal)
- Leia a mensagem de erro e o stack trace
- Corrija o módulo e teste novamente (exceto se consumir créditos pagos — consulte o usuário)
- Atualize a diretiva com os aprendizados
- Exemplo: link 404 → remova do artigo → atualize `directives/validar_links.md`

### 3. Atualize diretivas conforme aprende
As diretivas são documentos vivos. Não crie novas diretivas sem permissão e não sobrescreva existentes sem o usuário pedir.

## Loop de Self-Annealing
1. Conserte
2. Atualize a ferramenta
3. Teste e confirme
4. Atualize a diretiva
5. O sistema fica mais forte

## Organização de Arquivos

### Deliverables vs Intermediários
- **Deliverables:** posts agendados no WordPress do cliente
- **Intermediários:** arquivos em `.tmp/` (regeneráveis)

### Estrutura de diretórios
```
.tmp/              # Artefatos intermediários (regeneráveis)
directives/        # SOPs em Markdown (Camada 1)
execution/         # Módulos TypeScript determinísticos (Camada 3)
workers/api/       # REST API Hono
workers/pipeline/  # Queue consumer — pipeline de agentes
frontend/          # Next.js 15 + OpenNext
types/             # Tipos compartilhados
schema.sql         # D1
mu-plugin/         # Plugin WordPress por cliente
.env               # Variáveis locais (não commitar)
```

### Regras críticas (PRD)
- Chamadas WordPress **somente no backend** (Workers), nunca no browser
- `wp_app_password` criptografado em repouso; nunca retornar em API
- Links internos **somente** de `client_urls`; validação HTTP 200 obrigatória
- Agendamento WP: sempre `date_gmt` em UTC
- Schema JSON-LD: apenas complementar ao Yoast/Rank Math (FAQPage)

## Resumo
Você fica entre a intenção humana (directives) e a execução determinística (execution + workers). Seja pragmático. Seja confiável. Auto-aperfeiçoe sempre.
