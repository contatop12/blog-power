# Onboarding WordPress — Publisher P12

Checklist para conectar um cliente WordPress ao Publisher P12.

## Pré-requisitos

1. **HTTPS ativo** no site do cliente
2. **WordPress 5.6+** com Application Passwords habilitado
3. Usuário WP com capability `edit_posts` (mínimo Author; recomendado Editor)

## Instalação do mu-plugin

1. Copie `mu-plugin/p12-publisher-bridge.php` para `wp-content/mu-plugins/` no servidor do cliente
2. Confirme que o arquivo é carregado (não precisa ativar no painel — mu-plugins carregam automaticamente)

O plugin expõe via REST API:
- Campos Yoast (`_yoast_wpseo_*`)
- Campos Rank Math (`rank_math_*`)
- `p12_schema_jsonld` para FAQPage complementar

## Application Password

1. No WP Admin: Usuários → Perfil → Application Passwords
2. Crie uma senha com nome `Publisher P12`
3. Cadastre no Publisher: usuário + senha (armazenada criptografada no D1)

## Teste de conexão

Use o botão **Testar conexão** na tela de Clientes. Todos os itens críticos devem estar ✅:

| Item | Ação se falhar |
|---|---|
| HTTPS | Ativar certificado SSL |
| Autenticação | Verificar user/password; habilitar Application Passwords |
| edit_posts | Usar usuário Author ou Editor |
| Plugin SEO | Instalar Yoast ou Rank Math (ou `seo_plugin: nenhum`) |
| mu-plugin | Instalar `p12-publisher-bridge.php` |
| Fuso horário | Configurar `America/Sao_Paulo` em Ajustes → Geral |
| WP-Cron | Sites de baixo tráfego: `DISABLE_WP_CRON` + crontab real |

## Agendamento

- O Publisher envia sempre `date_gmt` em UTC
- A UI mostra horário no fuso do cliente (`timezone` no cadastro)
- Posts agendados dependem do WP-Cron (visitas ao site disparam publicação)

## Schema.org

- Com Yoast/Rank Math: emitimos apenas `FAQPage` via `p12_schema_jsonld`
- Sem plugin SEO: grafo JSON-LD completo no campo `p12_schema_jsonld`

## Sitemap

Após onboarding, use **Sincronizar sitemap** para popular o inventário de URLs internas (`client_urls`).
