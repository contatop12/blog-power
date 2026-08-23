# SOP: Testar Conexão WordPress (PRD §9.1)

## Objetivo
Checklist de onboarding: validar que o cliente está pronto para publicação automatizada.

## Entradas
- Credenciais WP do cliente (`wp_api_url`, `wp_user`, `wp_app_password`)

## Execução
- Módulo: `execution/wordpress/testConnection.ts`

## Itens do checklist
| Item | Verificação |
|---|---|
| HTTPS | `wp_api_url` começa com https:// |
| Autenticação | `GET /wp/v2/users/me` retorna 200 |
| Capability | usuário tem `edit_posts` |
| Plugin SEO | detectar Yoast ou Rank Math |
| mu-plugin | campo `p12_schema_jsonld` registrado na REST |
| Fuso horário | `GET /wp/v2/settings` ou equivalente |
| WP-Cron | aviso se site de baixo tráfego (heurística) |

## Saídas
- `ConnectionCheckResult` com ✅/❌ por item e instrução de correção

## Edge cases
- Application Passwords desabilitado: instruir instalação/ativação
- mu-plugin ausente: link para `mu-plugin/p12-publisher-bridge.php`

## Critérios de validação
- Todos os itens críticos (HTTPS, auth, capability, mu-plugin) em ✅ para onboarding completo
