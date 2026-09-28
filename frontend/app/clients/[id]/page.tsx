'use client'

import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  IdCard,
  Library,
  ListChecks,
  Paperclip,
  Plug,
  PlugZap,
  Plus,
  Puzzle,
  RefreshCw,
  Tags,
  XCircle,
} from 'lucide-react'
import { ClientForm } from '@/components/client-form'
import { ClientProfileForm } from '@/components/client-profile-form'
import { MuPluginGuide } from '@/components/client-form-guides'
import { ClientStatusIcon } from '@/components/client-status-icon'
import { FieldGuide } from '@/components/field-hint'
import { InstallBridgeButton } from '@/components/install-bridge-button'
import { KnowledgeBasePanel } from '@/components/knowledge-base-panel'
import { MaterialsUpload } from '@/components/materials-upload'
import { WpCategoriesManager } from '@/components/wp-categories-manager'
import { Badge, ConnectionBadge, StatusDot } from '@/components/ui/badge'
import { Button, buttonClass } from '@/components/ui/button'
import { Panel } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { ClientPageSkeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, type TabItem } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import { SEO_PLUGINS } from '@/lib/client-form'
import { PERFIL_CAMPOS, calcularCompletudeLocal, perfilVazio } from '@/lib/perfil-cliente'
import { cn } from '@/lib/utils'
import type { Client, ConnectionCheckResult, ConnectionStatus, SeoPlugin } from '@publisher-p12/types'

const ABAS = ['dados', 'perfil', 'base', 'categorias', 'materiais'] as const
type Aba = (typeof ABAS)[number]

/** `?tab=perfil` abre direto na aba; valor desconhecido cai em "dados". */
function abaInicial(valor: string | null): Aba {
  return ABAS.includes(valor as Aba) ? (valor as Aba) : 'dados'
}

const ABA_ROTULO: Record<Aba, string> = {
  dados: 'Dados e WordPress',
  perfil: 'Perfil',
  base: 'Base e pautas',
  categorias: 'Categorias',
  materiais: 'Materiais',
}

const TABS_ANCHOR = 'cliente-abas'
const WP_ACTIONS_ANCHOR = 'acoes-wordpress'

function siteUrl(dominio: string): string {
  return /^https?:\/\//.test(dominio) ? dominio : `https://${dominio}`
}

function siteHost(dominio: string): string {
  return dominio.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function seoPluginLabel(plugin: SeoPlugin): string {
  if (plugin === 'nenhum') return 'Sem plugin SEO'
  return SEO_PLUGINS.find((p) => p.value === plugin)?.label ?? plugin
}

function listaLegivel(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

function scrollToAnchor(id: string) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

const CONEXAO_PENDENTE: Record<ConnectionStatus, string> = {
  nao_testado: 'Teste a conexão para confirmar que o Publisher consegue publicar neste site.',
  erro: 'O último teste falhou. Revise a URL da API, o usuário e a Application Password e teste de novo.',
  atencao: 'A conexão funciona, mas algo precisa de ajuste. Rode o teste para ver o quê.',
  ok: 'O Publisher consegue publicar neste site.',
}

// ---------------------------------------------------------------------------
// Checklist de configuração
// ---------------------------------------------------------------------------

interface SetupStep {
  key: string
  title: string
  done: boolean
  description: React.ReactNode
  action: React.ReactNode
}

function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length
  const current = steps.findIndex((s) => !s.done)

  return (
    <section
      aria-labelledby="setup-title"
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <ListChecks className="size-4 shrink-0 text-muted" aria-hidden />
          <div className="min-w-0">
            <h2 id="setup-title" className="text-[15px] font-semibold tracking-tight text-ink">
              Configuração do cliente
            </h2>
            <p className="text-[13px] leading-snug text-muted">
              Conclua os passos em ordem para os agentes começarem a escrever.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] tabular-nums text-muted">
            {doneCount} de {steps.length} concluídos
          </span>
          <span className="flex gap-1" aria-hidden>
            {steps.map((s) => (
              <span
                key={s.key}
                className={cn('h-1.5 w-6 rounded-full', s.done ? 'bg-emerald-500' : 'bg-ink/[0.08]')}
              />
            ))}
          </span>
        </div>
      </header>

      <ol className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {steps.map((step, i) => {
          const isCurrent = i === current
          return (
            <li
              key={step.key}
              className={cn('flex gap-3.5 px-5 py-4', isCurrent && 'bg-brand-soft/40')}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums',
                  step.done
                    ? 'bg-emerald-50 text-emerald-600'
                    : isCurrent
                      ? 'bg-brand text-white'
                      : 'bg-surface text-muted ring-1 ring-inset ring-line-strong',
                )}
                aria-hidden
              >
                {step.done ? <Check className="size-4" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                  {step.title}
                  {step.done && <Badge tone="success">Concluído</Badge>}
                </p>
                <div className="mt-0.5 text-[13px] leading-snug text-muted">{step.description}</div>
                {!step.done && <div className="mt-3">{step.action}</div>}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Ações WordPress
// ---------------------------------------------------------------------------

function ActionRow({
  icon,
  title,
  description,
  actions,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  actions: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="flex gap-3 px-5 py-4">
      <span
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand [&_svg]:size-4"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>
        {children}
      </div>
    </div>
  )
}

function ConnectionResults({ result, stale }: { result: ConnectionCheckResult; stale: boolean }) {
  const falhas = result.itens.filter((i) => !i.ok).length
  return (
    <div className={cn('mt-4 rounded-lg border border-line p-3', stale ? 'opacity-60' : 'animate-fade-in')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-ink">Resultado do teste</p>
        <Badge tone={falhas === 0 ? 'success' : 'danger'}>
          {falhas === 0 ? 'Tudo certo' : falhas === 1 ? '1 falha' : `${falhas} falhas`}
        </Badge>
      </div>
      <ul className="mt-2.5 space-y-2.5">
        {result.itens.map((item) => (
          <li key={item.nome} className="flex gap-2.5">
            {item.ok ? (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-emerald-600"
                role="img"
                aria-label="Passou"
              />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" role="img" aria-label="Falhou" />
            )}
            <div className="min-w-0">
              <p className="text-sm text-ink">{item.nome}</p>
              {item.instrucao && (
                <p className="mt-0.5 text-xs leading-snug text-muted">{item.instrucao}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

export default function ClientDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const [client, setClient] = useState<Client | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [connection, setConnection] = useState<ConnectionCheckResult | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<Aba>(() => abaInicial(searchParams.get('tab')))
  // Só anima o conteúdo quando o usuário troca de aba, não na primeira carga
  const [tabChanged, setTabChanged] = useState(false)
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    api.clients
      .get(id)
      .then(setClient)
      .catch((e) => {
        setClient(null)
        setLoadError(e instanceof Error ? e.message : 'Erro ao carregar o cliente')
      })
  }, [id])

  async function testarConexao() {
    setTesting(true)
    setActionError(null)
    try {
      const result = await api.clients.testConnection(id)
      setConnection(result)
      if (result.status_conexao) {
        setClient((current) =>
          current ? { ...current, status_conexao: result.status_conexao } : current,
        )
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Falha ao testar conexão')
    } finally {
      setTesting(false)
    }
  }

  async function sincronizarSitemap() {
    setSyncing(true)
    setActionError(null)
    setSyncMsg(null)
    try {
      const r = await api.clients.syncSitemap(id)
      const secs = typeof r.duration_ms === 'number' ? ` em ${(r.duration_ms / 1000).toFixed(1)}s` : ''
      setSyncMsg(`${r.synced} URLs sincronizadas${secs}`)
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Falha ao sincronizar sitemap')
    } finally {
      setSyncing(false)
    }
  }

  if (loadError && !client) {
    return (
      <div className="space-y-6">
        <PageHeader back={{ href: '/clients', label: 'Clientes' }} title="Cliente" />
        <Notice tone="danger" title="Não foi possível abrir este cliente">
          <p>{loadError}</p>
          <p className="mt-1">Volte para a lista de clientes e tente de novo.</p>
        </Notice>
      </div>
    )
  }

  if (!client) {
    return <ClientPageSkeleton />
  }

  const faltandoPerfil = PERFIL_CAMPOS.filter((c) =>
    calcularCompletudeLocal(client.perfil_marca ?? perfilVazio()).faltando_obrigatorios.includes(
      c.chave,
    ),
  ).map((c) => c.label)

  const conectado = client.status_conexao === 'ok'
  const perfilIncompleto = faltandoPerfil.length > 0

  function changeTab(aba: Aba) {
    setTab(aba)
    setTabChanged(true)
  }

  function irPara(aba: Aba, anchor: string) {
    changeTab(aba)
    scrollToAnchor(anchor)
  }

  const setupSteps: SetupStep[] = [
    {
      key: 'wordpress',
      title: 'Conectar o WordPress',
      done: conectado,
      description: CONEXAO_PENDENTE[client.status_conexao],
      action: (
        <Button
          size="sm"
          variant={!conectado ? 'default' : 'outline'}
          loading={testing}
          loadingText="Testando…"
          disabled={syncing}
          onClick={() => {
            irPara('dados', WP_ACTIONS_ANCHOR)
            void testarConexao()
          }}
        >
          <PlugZap aria-hidden />
          Testar conexão
        </Button>
      ),
    },
    {
      key: 'perfil',
      title: 'Completar o perfil',
      done: !perfilIncompleto,
      description: perfilIncompleto ? (
        <>
          {faltandoPerfil.length === 1
            ? 'Falta 1 campo obrigatório: '
            : `Faltam ${faltandoPerfil.length} campos obrigatórios: `}
          <span className="font-medium text-ink">{listaLegivel(faltandoPerfil)}</span>. Sem eles os
          agentes não escrevem.
        </>
      ) : (
        'Os campos obrigatórios estão preenchidos.'
      ),
      action: (
        <Button
          size="sm"
          variant={conectado ? 'default' : 'outline'}
          onClick={() => irPara('perfil', TABS_ANCHOR)}
        >
          Preencher perfil
          <ChevronRight aria-hidden />
        </Button>
      ),
    },
  ]

  const showSetup = setupSteps.some((s) => !s.done)

  const tabItems: TabItem<Aba>[] = [
    {
      value: 'dados',
      label: ABA_ROTULO.dados,
      icon: <Plug aria-hidden />,
      indicator:
        client.status_conexao === 'erro' || client.status_conexao === 'atencao' ? (
          <StatusDot
            tone={client.status_conexao === 'erro' ? 'danger' : 'warning'}
            label={client.status_conexao === 'erro' ? 'Conexão com erro' : 'Conexão pede atenção'}
          />
        ) : undefined,
    },
    {
      value: 'perfil',
      label: ABA_ROTULO.perfil,
      icon: <IdCard aria-hidden />,
      indicator: perfilIncompleto ? <StatusDot tone="warning" label="Perfil incompleto" /> : undefined,
    },
    { value: 'base', label: ABA_ROTULO.base, icon: <Library aria-hidden /> },
    { value: 'categorias', label: ABA_ROTULO.categorias, icon: <Tags aria-hidden /> },
    { value: 'materiais', label: ABA_ROTULO.materiais, icon: <Paperclip aria-hidden /> },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/clients', label: 'Clientes' }}
        title={
          <span className="flex min-w-0 items-center gap-3">
            <ClientStatusIcon status={client.status_conexao} />
            <span className="min-w-0 truncate">{client.nome}</span>
            {(testing || syncing) && <Spinner size="sm" className="shrink-0 text-brand" />}
          </span>
        }
        meta={
          <>
            <a
              href={siteUrl(client.dominio)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-brand"
            >
              <span className="truncate">{siteHost(client.dominio)}</span>
              <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
            <ConnectionBadge status={client.status_conexao} />
            <Badge title="Plugin SEO">{seoPluginLabel(client.seo_plugin)}</Badge>
          </>
        }
        actions={
          <Link href={`/articles/new?client_id=${id}`} className={buttonClass()}>
            <Plus aria-hidden />
            Novo artigo
          </Link>
        }
      />

      {showSetup && <SetupChecklist steps={setupSteps} />}

      <div id={TABS_ANCHOR} className="scroll-mt-20 space-y-6 lg:scroll-mt-6">
        <Tabs items={tabItems} value={tab} onChange={changeTab} label="Seções do cliente" />

        <div
          role="tabpanel"
          aria-label={ABA_ROTULO[tab]}
          key={tab}
          className={cn(tabChanged && 'animate-fade-in')}
        >
          {tab === 'dados' && (
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div id={WP_ACTIONS_ANCHOR} className="min-w-0 scroll-mt-20 lg:scroll-mt-6 xl:order-last">
                <Panel
                  icon={<PlugZap />}
                  title="Ações WordPress"
                  description="Teste a conexão e mantenha os links internos em dia."
                  action={
                    <FieldGuide title="Como instalar o P12 Bridge">
                      <MuPluginGuide />
                    </FieldGuide>
                  }
                  bodyClassName="divide-y divide-line"
                >
                  <ActionRow
                    icon={<PlugZap />}
                    title="Testar conexão"
                    description="Confere HTTPS, o login com a Application Password e os plugins do site."
                    actions={
                      <Button
                        size="sm"
                        variant={conectado ? 'outline' : 'default'}
                        loading={testing}
                        loadingText="Testando…"
                        disabled={syncing}
                        onClick={testarConexao}
                      >
                        Testar conexão
                      </Button>
                    }
                  >
                    {testing && !connection && (
                      <p className="mt-3 flex items-center gap-2 text-[13px] text-muted">
                        <Spinner size="sm" className="text-brand" />
                        Verificando HTTPS, autenticação e plugins…
                      </p>
                    )}
                    {connection && <ConnectionResults result={connection} stale={testing} />}
                  </ActionRow>
  
                  <ActionRow
                    icon={<RefreshCw />}
                    title="Sincronizar sitemap"
                    description="Lê o sitemap do site e atualiza as URLs que os agentes usam nos links internos."
                    actions={
                      <Button
                        size="sm"
                        variant="outline"
                        loading={syncing}
                        loadingText="Sincronizando…"
                        disabled={testing}
                        onClick={sincronizarSitemap}
                      >
                        Sincronizar sitemap
                      </Button>
                    }
                  >
                    {syncMsg && !syncing && (
                      <Notice tone="success" className="mt-3 animate-fade-in">
                        {syncMsg}.
                      </Notice>
                    )}
                  </ActionRow>
  
                  <ActionRow
                    icon={<Puzzle />}
                    title="Plugin P12 Bridge"
                    description="Deixa o Publisher gravar os campos de SEO e o JSON-LD no WordPress. Instale uma vez por site."
                    actions={
                      <>
                        <InstallBridgeButton dominio={client.dominio} size="sm" />
                        <a
                          href="/p12-publisher-bridge.zip"
                          download="p12-publisher-bridge.zip"
                          className={buttonClass('ghost', undefined, 'sm')}
                        >
                          <Download aria-hidden />
                          Só baixar o ZIP
                        </a>
                      </>
                    }
                  />
  
                  {actionError && (
                    <div className="px-5 py-4">
                      <Notice tone="danger" title="A ação não foi concluída" className="animate-fade-in">
                        {actionError}
                      </Notice>
                    </div>
                  )}
                </Panel>
              </div>

              <div className="min-w-0">
                <ClientForm
                  initial={client}
                  clientId={id}
                  submitLabel="Salvar alterações"
                  onSubmit={async (data) => {
                    const updated = await api.clients.update(id, data)
                    setClient(updated)
                  }}
                />
              </div>
            </div>
          )}

          {tab === 'perfil' && (
            <ClientProfileForm
              clientId={id}
              onSaved={(perfil) =>
                setClient((atual) => (atual ? { ...atual, perfil_marca: perfil } : atual))
              }
            />
          )}

          {tab === 'base' && <KnowledgeBasePanel clientId={id} />}

          {tab === 'categorias' && <WpCategoriesManager clientId={id} />}

          {tab === 'materiais' && <MaterialsUpload clientId={id} />}
        </div>
      </div>
    </div>
  )
}
