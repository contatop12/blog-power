'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { Building2, FileText, Search, X } from 'lucide-react'
import { ArticleStatusBadge, StatusDot } from '@/components/ui/badge'
import { Button, buttonClass } from '@/components/ui/button'
import { Panel } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { ListSkeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatDateTime, formatRelative } from '@/lib/format'
import { ARTICLE_STATUS, PIPELINE_ORDER, STAGES, isStage, type Stage } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { Article, Client } from '@publisher-p12/types'

const STAGE_FILTERS: Stage[] = [...PIPELINE_ORDER, 'erro']

function ArticlesList() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const etapaParam = searchParams.get('etapa')
  const etapa: Stage | null = isStage(etapaParam) ? etapaParam : null
  const clientFilter = searchParams.get('client_id') ?? ''

  const [articles, setArticles] = useState<Article[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    Promise.all([api.articles.list(), api.clients.list()])
      .then(([arts, cls]) => {
        setArticles(arts)
        setClients(cls)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar artigos'))
      .finally(() => setLoading(false))
  }, [])

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const clientNames = useMemo(() => new Map(clients.map((c) => [c.id, c.nome])), [clients])

  // Contagem por etapa respeita cliente e busca, para os chips mostrarem o que o clique vai trazer
  const base = useMemo(() => {
    const term = busca.trim().toLowerCase()
    return articles.filter((a) => {
      if (clientFilter && a.client_id !== clientFilter) return false
      if (term && !(a.briefing?.tema ?? '').toLowerCase().includes(term)) return false
      return true
    })
  }, [articles, clientFilter, busca])

  const stageCount = (stage: Stage) =>
    base.filter((a) => ARTICLE_STATUS[a.status]?.stage === stage).length

  const visible = etapa ? base.filter((a) => ARTICLE_STATUS[a.status]?.stage === etapa) : base
  const sorted = [...visible].sort((x, y) => y.updated_at.localeCompare(x.updated_at))
  const hasFilters = Boolean(etapa || clientFilter || busca.trim())

  return (
    <div className="space-y-6">
      <PageHeader
        title="Artigos"
        description="Tudo o que os agentes produziram, em qualquer etapa. Para criar um artigo, abra o cliente."
        actions={
          <Link href="/clients" className={buttonClass('outline')}>
            <Building2 aria-hidden />
            Escolher cliente
          </Link>
        }
      />

      <div className="space-y-3">
        <div role="group" aria-label="Filtrar por etapa" className="flex flex-wrap gap-2">
          <FilterChip active={!etapa} onClick={() => setParam('etapa', null)} count={base.length}>
            Todos
          </FilterChip>
          {STAGE_FILTERS.map((stage) => (
            <FilterChip
              key={stage}
              active={etapa === stage}
              onClick={() => setParam('etapa', etapa === stage ? null : stage)}
              count={stageCount(stage)}
            >
              <StatusDot tone={STAGES[stage].tone} className="size-1.5" />
              {STAGES[stage].label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar por tema</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              className="field-input pl-9"
              placeholder="Buscar por tema"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <label className="sm:w-64">
            <span className="sr-only">Filtrar por cliente</span>
            <select
              className="field-input"
              value={clientFilter}
              onChange={(e) => setParam('client_id', e.target.value || null)}
            >
              <option value="">Todos os clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error && (
        <Notice tone="danger" title="Não foi possível carregar os artigos">
          {error}
        </Notice>
      )}

      {loading ? (
        <ListSkeleton rows={5} label="Carregando artigos" />
      ) : articles.length === 0 && !error ? (
        <EmptyState
          icon={<FileText />}
          title="Nenhum artigo ainda"
          description="Abra um cliente e crie o primeiro briefing. Os agentes cuidam do resto."
          action={
            <Link href="/clients" className={buttonClass()}>
              Escolher cliente
            </Link>
          }
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Nenhum artigo com esses filtros"
          description="Tente outra etapa, outro cliente ou limpe a busca."
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setBusca('')
                  router.replace(pathname, { scroll: false })
                }}
              >
                <X aria-hidden />
                Limpar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Panel
          title={etapa ? STAGES[etapa].label : 'Todos os artigos'}
          description={etapa ? STAGES[etapa].description : undefined}
          action={
            <span className="text-sm tabular-nums text-muted">
              {sorted.length} {sorted.length === 1 ? 'artigo' : 'artigos'}
            </span>
          }
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Artigo</th>
                <th className="hidden md:table-cell">Cliente</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Atualizado</th>
                <th className="hidden sm:table-cell">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => (
                <tr key={a.id}>
                  <td className="max-w-md">
                    <Link
                      href={`/articles/${a.id}/review`}
                      className="line-clamp-2 font-medium text-ink hover:text-brand"
                    >
                      {a.briefing?.tema ?? 'Sem tema'}
                    </Link>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted md:hidden">
                      <span>{clientNames.get(a.client_id) ?? 'Cliente removido'}</span>
                      <span className="sm:hidden">{formatRelative(a.updated_at)}</span>
                    </span>
                    {a.status === 'erro' && a.erro_msg && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-red-700" title={a.erro_msg}>
                        {a.erro_msg}
                      </p>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap text-muted md:table-cell">
                    <Link href={`/clients/${a.client_id}`} className="hover:text-ink">
                      {clientNames.get(a.client_id) ?? 'Cliente removido'}
                    </Link>
                  </td>
                  <td>
                    <ArticleStatusBadge status={a.status} />
                  </td>
                  <td className="hidden whitespace-nowrap text-muted sm:table-cell">
                    <time dateTime={a.updated_at} title={formatDateTime(a.updated_at)}>
                      {formatRelative(a.updated_at)}
                    </time>
                  </td>
                  <td className="hidden text-right sm:table-cell">
                    <Link
                      href={`/articles/${a.id}/review`}
                      className={buttonClass('ghost', 'text-brand hover:text-brand-strong', 'sm')}
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean
  onClick: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150',
        active
          ? 'border-ink bg-ink text-white'
          : 'border-line-strong bg-surface text-ink hover:border-subtle',
      )}
    >
      {children}
      <span className={cn('tabular-nums', active ? 'text-white/70' : 'text-subtle')}>{count}</span>
    </button>
  )
}

export default function ArticlesPage() {
  return (
    <Suspense fallback={<ListSkeleton rows={5} label="Carregando artigos" />}>
      <ArticlesList />
    </Suspense>
  )
}
