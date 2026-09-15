# Onboarding WordPress — Publisher P12

Checklist para conectar um cliente WordPress ao Publisher P12.

## Pré-requisitos

1. **HTTPS ativo** no site do cliente
2. **WordPress 5.6+** com Application Passwords habilitado
3. Usuário WP com capability `edit_posts` (mínimo Author; recomendado Editor)
4. Para instalar o Bridge pelo painel: usuário com `install_plugins` (Administrador)

## Instalação do P12 Publisher Bridge

### Recomendado — dentro do WordPress

1. No Publisher, abra o cliente → **Instalar no WordPress**
2. O ZIP `p12-publisher-bridge.zip` é baixado e a tela **Plugins → Enviar plugin** abre
3. Envie o ZIP → **Instalar agora** → **Ativar**
4. **Testar conexão** no Publisher

Arquivo fonte: `wordpress-plugin/p12-publisher-bridge/`

### Alternativa — mu-plugin (FTP)

1. Copie `mu-plugin/p12-publisher-bridge.php` para `wp-content/mu-plugins/`
2. Não precisa ativar no painel (mu-plugins carregam automaticamente)

### O que o Bridge faz

- Expõe via REST: campos Yoast, Rank Math e `p12_schema_jsonld`
- Injeta JSON-LD validado no `<head>` de posts publicados
- **Não** envia dados a servidores externos

### Segurança (v1.1.0)

| Controle | Status |
|---|---|
| Bloqueio de acesso direto (`ABSPATH`) | Sim |
| Escrita REST só com `edit_posts` | Sim |
| Sanitização de meta SEO | Sim |
| JSON-LD validado + anti-XSS em `<script>` | Sim |
| Sem telemetria / HTTP externo | Sim |
| Não armazena Application Password | Sim |

A Application Password fica criptografada no backend do Publisher (D1), não no plugin.

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
| P12 Bridge | Instalar ZIP no WP ou mu-plugin via FTP |
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
