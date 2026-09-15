# P12 Publisher Bridge (WordPress)

Plugin que conecta o WordPress do cliente ao Publisher P12.

## Instalação recomendada (dentro do WordPress)

1. Baixe `p12-publisher-bridge.zip` no Publisher (botão **Instalar no WordPress**)
2. No wp-admin: **Plugins → Adicionar novo → Enviar plugin**
3. Selecione o ZIP → **Instalar agora** → **Ativar**
4. No Publisher: **Testar conexão**

## Alternativa (mu-plugin)

Copie `p12-publisher-bridge.php` para `wp-content/mu-plugins/` (carrega sem ativar).

## Segurança (v1.1.0)

| Controle | Detalhe |
|---|---|
| Acesso direto | Bloqueado com `ABSPATH` |
| Escrita REST | Só usuários com `edit_posts` |
| Sanitização | Textos SEO + JSON-LD validado (`json_decode` + re-encode) |
| XSS no front | Escapa `</` no JSON-LD impresso em `<script>` |
| Rascunhos | JSON-LD só em posts `publish` |
| Telemetria | Nenhuma — o plugin **não** faz HTTP para fora |
| Credenciais | Não armazena senhas nem Application Passwords |

O Publisher guarda a Application Password **criptografada no backend (D1)**; o plugin no WordPress nunca a vê além das requisições autenticadas que o próprio WP processa.
