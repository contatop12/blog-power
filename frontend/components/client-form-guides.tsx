export function WpApiUrlGuide() {
  return (
    <>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
        <strong>Não é a URL de login.</strong> Login do WordPress fica em{' '}
        <code className="text-xs">/wp-admin</code> ou <code className="text-xs">/wp-login.php</code>.
        Este campo é a <strong>API REST</strong> — o endereço que o Publisher usa para publicar posts
        automaticamente.
      </p>

      <div>
        <p className="font-medium text-slate-900">Como montar a URL</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            Use o mesmo domínio do campo <strong>Domínio</strong>, ex.:{' '}
            <code className="text-xs">https://abxtelecom.com.br</code>
          </li>
          <li>
            Acrescente <code className="text-xs">/wp-json</code> no final →{' '}
            <code className="text-xs">https://abxtelecom.com.br/wp-json</code>
          </li>
          <li>
            <strong>Sem barra</strong> depois de <code className="text-xs">wp-json</code>
          </li>
        </ol>
      </div>

      <div>
        <p className="font-medium text-slate-900">Como conferir no navegador</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>Abra a URL no Chrome/Edge (logado ou anônimo)</li>
          <li>
            Deve aparecer um <strong>JSON</strong> com algo como{' '}
            <code className="text-xs">&quot;name&quot;:&quot;Nome do site&quot;</code>
          </li>
          <li>Se aparecer JSON, a URL está correta — não há tela específica no wp-admin para copiar</li>
        </ol>
      </div>

      <div>
        <p className="font-medium text-slate-900">Dentro do WordPress (quando dá erro)</p>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>
            <strong>Ajustes → Links permanentes</strong> — escolha qualquer opção{' '}
            <em>exceto</em> &quot;Simples&quot; (a API precisa de permalinks ativos)
          </li>
          <li>
            Site em subpasta? Inclua a pasta:{' '}
            <code className="text-xs">https://site.com.br/blog/wp-json</code>
          </li>
          <li>404 ou página em branco? Verifique cache, firewall ou plugin que bloqueie REST API</li>
        </ul>
      </div>

      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-950">
        <strong>Resumo:</strong> domínio + <code className="text-xs">/wp-json</code> — não use{' '}
        <code className="text-xs">/wp-admin</code> neste campo.
      </p>
    </>
  )
}

export function WpAppPasswordGuide() {
  return (
    <>
      <p>
        Não use a senha de login do WordPress. É uma <strong>Application Password</strong> gerada
        só para integrações.
      </p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Entre no wp-admin com o usuário do campo <strong>Usuário WP</strong>
        </li>
        <li>
          Vá em <strong>Usuários → Perfil</strong> (ou seu perfil, canto superior direito)
        </li>
        <li>
          Role até <strong>Application Passwords</strong> / <strong>Senhas de aplicativo</strong>
        </li>
        <li>
          Nome: ex. <code className="text-xs">Publisher P12</code> → <strong>Adicionar</strong>
        </li>
        <li>Copie o código exibido uma única vez e cole neste campo (espaços são opcionais)</li>
      </ol>
      <p className="text-xs text-slate-500">
        Se não aparecer a seção, confirme WordPress 5.6+ e HTTPS no site.
      </p>
    </>
  )
}

export function MuPluginGuide() {
  return (
    <>
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
        O <strong>P12 Publisher Bridge</strong> já está pronto (v1.1.0). Prefira instalar{' '}
        <strong>dentro do WordPress</strong> pelo menu Plugins (ZIP). Alternativa: mu-plugin via FTP.
      </p>

      <div>
        <p className="font-medium text-slate-900">Instalar no WordPress (recomendado)</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5">
          <li>
            Clique em <strong>Instalar no WordPress</strong> — o ZIP baixa automaticamente
          </li>
          <li>
            Abre a tela <strong>Plugins → Enviar plugin</strong> do site do cliente
          </li>
          <li>
            Em &quot;Plugin zip&quot;, escolha <code className="text-xs">p12-publisher-bridge.zip</code>
          </li>
          <li>
            <strong>Instalar agora</strong> → <strong>Ativar</strong>
          </li>
          <li>
            Volte ao Publisher e clique em <strong>Testar conexão</strong>
          </li>
        </ol>
      </div>

      <div>
        <p className="font-medium text-slate-900">Segurança</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Não envia dados para servidores externos (sem telemetria)</li>
          <li>Só usuários com <code className="text-xs">edit_posts</code> gravam meta via API</li>
          <li>JSON-LD validado e protegido contra XSS</li>
          <li>Não armazena Application Password no plugin</li>
        </ul>
      </div>

      <div>
        <p className="font-medium text-slate-900">Alternativa mu-plugin (FTP)</p>
        <p className="mt-1 text-sm">
          Envie <code className="text-xs">p12-publisher-bridge.php</code> para{' '}
          <code className="text-xs">wp-content/mu-plugins/</code> (carrega sozinho, sem ativar).
        </p>
      </div>
    </>
  )
}
