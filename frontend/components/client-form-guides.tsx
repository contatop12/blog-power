import { Notice } from '@/components/ui/notice'

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-canvas [overflow-wrap:anywhere] px-1 py-0.5 font-mono text-[12px] text-ink ring-1 ring-inset ring-line">
      {children}
    </code>
  )
}

function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-2.5">{children}</div>
    </section>
  )
}

function Bullets({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-ink marker:text-subtle">{children}</ul>
}

/** Passos numerados de um guia — a ordem importa. */
export function GuideSteps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span
            className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold tabular-nums text-brand-strong"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="min-w-0">{step}</span>
        </li>
      ))}
    </ol>
  )
}

export function WpApiUrlGuide() {
  return (
    <>
      <Notice tone="warning" title="Não é a URL de login">
        O login do WordPress fica em <Code>/wp-admin</Code> ou <Code>/wp-login.php</Code>. Este
        campo é a API REST: o endereço que o Publisher usa para publicar os posts.
      </Notice>

      <GuideSection title="Como montar a URL">
        <GuideSteps
          steps={[
            <>
              Comece pelo mesmo endereço do campo <strong>Domínio</strong>, ex.:{' '}
              <Code>https://abxtelecom.com.br</Code>
            </>,
            <>
              Acrescente <Code>/wp-json</Code> no final: <Code>https://abxtelecom.com.br/wp-json</Code>
            </>,
            <>
              Não coloque barra depois de <Code>wp-json</Code>.
            </>,
          ]}
        />
      </GuideSection>

      <GuideSection title="Como conferir no navegador">
        <GuideSteps
          steps={[
            'Abra a URL no navegador, logado ou em janela anônima.',
            <>
              Deve aparecer um JSON com algo como <Code>&quot;name&quot;:&quot;Nome do site&quot;</Code>
            </>,
            'Se o JSON apareceu, a URL está certa. Não existe tela no wp-admin para copiar esse endereço.',
          ]}
        />
      </GuideSection>

      <GuideSection title="Se der erro">
        <Bullets>
          <li>
            Em <strong>Ajustes › Links permanentes</strong>, escolha qualquer opção menos
            &quot;Simples&quot;. A API precisa de links permanentes ativos.
          </li>
          <li>
            Site em subpasta? Inclua a pasta: <Code>https://site.com.br/blog/wp-json</Code>
          </li>
          <li>404 ou página em branco? Verifique cache, firewall ou plugin que bloqueie a API REST.</li>
        </Bullets>
      </GuideSection>

      <Notice tone="info" title="Resumo">
        Domínio + <Code>/wp-json</Code>. Nunca use <Code>/wp-admin</Code> neste campo.
      </Notice>
    </>
  )
}

export function WpAppPasswordGuide() {
  return (
    <>
      <p>
        Não use a senha de login do WordPress. A <strong>Application Password</strong> é uma senha
        gerada só para integrações.
      </p>
      <GuideSteps
        steps={[
          <>
            Entre no wp-admin com o usuário informado em <strong>Usuário WP</strong>.
          </>,
          <>
            Abra <strong>Usuários › Perfil</strong> (ou clique no seu nome, no canto superior
            direito).
          </>,
          <>
            Role até <strong>Senhas de aplicativo</strong> (<em>Application Passwords</em>).
          </>,
          <>
            Dê um nome, como <Code>Publisher P12</Code>, e clique em <strong>Adicionar</strong>.
          </>,
          'Copie o código, que aparece uma única vez, e cole neste campo. Os espaços são opcionais.',
        ]}
      />
      <p className="text-xs text-muted">
        Se a seção não aparecer, confirme que o WordPress é 5.6 ou mais novo e que o site usa HTTPS.
      </p>
    </>
  )
}

/** O que o plugin faz e não faz — para responder dúvidas do cliente. */
export function BridgeSecurityNotes() {
  return (
    <GuideSection title="Segurança">
      <Bullets>
        <li>Não envia dados para servidores externos (sem telemetria).</li>
        <li>
          Só usuários com <Code>edit_posts</Code> gravam metadados pela API.
        </li>
        <li>JSON-LD validado e protegido contra XSS.</li>
        <li>Não armazena a Application Password.</li>
      </Bullets>
    </GuideSection>
  )
}

export function BridgeFtpAlternative() {
  return (
    <GuideSection title="Alternativa: mu-plugin via FTP">
      <p>
        Envie <Code>p12-publisher-bridge.php</Code> para <Code>wp-content/mu-plugins/</Code>. Ele
        carrega sozinho, sem precisar ativar.
      </p>
    </GuideSection>
  )
}

export function MuPluginGuide() {
  return (
    <>
      <Notice tone="info">
        O <strong>P12 Publisher Bridge</strong> expõe os campos de SEO (Yoast ou Rank Math) e o
        JSON-LD para o Publisher gravar pela API. Prefira instalar pelo menu Plugins do WordPress;
        a alternativa é copiar como mu-plugin via FTP.
      </Notice>

      <GuideSection title="Instalar pelo WordPress (recomendado)">
        <GuideSteps
          steps={[
            <>
              Clique em <strong>Instalar no WordPress</strong>. O ZIP baixa sozinho.
            </>,
            <>
              A tela <strong>Plugins › Enviar plugin</strong> do site do cliente abre em outra aba.
            </>,
            <>
              Em &quot;Plugin zip&quot;, escolha <Code>p12-publisher-bridge.zip</Code>.
            </>,
            <>
              Clique em <strong>Instalar agora</strong> e depois em <strong>Ativar</strong>.
            </>,
            <>
              Volte ao Publisher e clique em <strong>Testar conexão</strong>.
            </>,
          ]}
        />
      </GuideSection>

      <BridgeSecurityNotes />
      <BridgeFtpAlternative />
    </>
  )
}
