'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import {
  AlertOctagon,
  Building2,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  PenLine,
  Plug,
  Plus,
  Send,
  Wrench,
} from 'lucide-react'
import { ClientStatusIcon } from '@/components/client-status-icon'
import { PipelineOverview } from '@/components/pipeline'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClass } from '@/components/ui/button'
import { Panel } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatDateTime, formatRelative } from '@/lib/format'
import { STAGES, TONE_CLASSES, type Stage, type Tone } from '@/lib/status'
import { cn } from '@/lib/utils'
import type { DashboardArticleRow, DashboardPayload, DashboardServiceError } from '@publisher-p12/types'

const ATTENTION_LIMIT = 8

interface AttentionItem {
  key: string
  tone: Tone
  icon: React.ReactNode
  title: string
  client: string | null
  detail: string | null
  when: string
  href: string
  action: string
}

/** Junta falhas e artigos esperando a equipe numa lista única, do mais grave ao mais recente. */
function buildAttention(data: DashboardPayload, articles: DashboardArticleRow[]): AttentionItem[] {
  const failures: AttentionItem[] = [
    ...data.erros_publicacao.map((a) => ({
      key: `pub-${a.id}`,
      tone: 'danger' as const,
      icon: <Send />,
      title: a.tema,
      client: a.client_nome,
      detail: a.erro_msg ?? 'Falha ao publicar no WordPress',
      when: a.updated_at,
      href: `/articles/${a.id}/review`,
      action: 'Abrir artigo',
    })),
    ...data.erros_servicos
      .filter((e) => !e.resolvido_em)
      .map((e) => serviceErrorItem(e)),
  ]

  const waiting: AttentionItem[] = articles
    .filter((a) => a.status === 'em_revisao' || a.status === 'aprovado')
    .map((a) => ({
      key: `rev-${a.id}`,
      tone: 'warning' as const,
      icon: <PenLine />,
      title: a.tema,
      client: a.client_nome,
      detail: a.status === 'aprovado' ? 'Aprovado, falta agendar ou publicar' : 'Pronto para revisão',
      when: a.updated_at,
      href: `/articles/${a.id}/review`,
      action: a.status === 'aprovado' ? 'Publicar' : 'Revisar',
    }))

  const byDate = (x: AttentionItem, y: AttentionItem) => y.when.localeCompare(x.when)
  return [...failures.sort(byDate), ...waiting.sort(byDate)]
}

function serviceErrorItem(e: DashboardServiceError): AttentionItem {
  const isConnection = e.tipo === 'conexao_wp'
  return {
    key: `svc-${e.id}`,
    tone: 'danger',
    icon: isConnection ? <Plug /> : <Wrench />,
    title: e.titulo,
    client: e.client_nome,
    detail: e.detalhe,
    when: e.updated_at,
    href: e.client_id ? `/clients/${e.client_id}` : '/clients',
    action: isConnection ? 'Testar conexão' : 'Ver cliente',
  }
}

function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        icon={<CheckCircle2 />}
        title="Nada pendente"
        description="Falhas e artigos esperando revisão aparecem aqui."
      />
    )
  }

  return (
    <ul className="divide-y divide-line">
      {items.slice(0, ATTENTION_LIMIT).map((item) => (
        <li key={item.key}>
          <Link
            href={item.href}
            className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-canvas/70"
          >
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-lg [&_svg]:size-4',
                TONE_CLASSES[item.tone].soft,
              )}
              aria-hidden
            >
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-medium text-ink sm:line-clamp-1">{item.title}</span>
              <span className="mt-0.5 flex min-w-0 flex-wrap gap-x-2 text-[13px] text-muted sm:flex-nowrap">
                {item.client && <span className="shrink-0 font-medium text-ink/70">{item.client}</span>}
                {item.detail && (
                  <span className="truncate" title={item.detail}>
                    {item.detail}
                  </span>
                )}
              </span>
            </span>
            <time
              dateTime={item.when}
              title={formatDateTime(item.when)}
              className="hidden shrink-0 text-xs text-subtle md:block"
            >
              {formatRelative(item.when)}
            </time>
            <span
              className={buttonClass(
                'outline',
                'hidden shrink-0 group-hover:border-ink sm:inline-flex',
                'sm',
              )}
            >
              {item.action}
            </span>
            <ChevronRight className="size-4 shrink-0 text-subtle sm:hidden" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

function ClientsList({ clients }: { clients: DashboardPayload['clientes'] }) {
  if (clients.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Building2 />}
        title="Nenhum cliente ainda"
        description="Cadastre um site WordPress para começar a produzir."
        action={
          <Link href="/clients/new" className={buttonClass('default', undefined, 'sm')}>
            <Plus aria-hidden />
            Novo cliente
          </Link>
        }
      />
    )
  }

  return (
    <ul className="divide-y divide-line">
      {clients.map((c) => (
        <li key={c.id}>
          <Link
            href={`/clients/${c.id}`}
            className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas/70"
          >
            <ClientStatusIcon status={c.status_conexao} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{c.nome}</span>
              <span className="block truncate text-xs text-muted">{c.dominio}</span>
            </span>
            {c.erros > 0 && (
              <Badge tone="danger" title="Artigos com erro de publicação">
                {c.erros} {c.erros === 1 ? 'erro' : 'erros'}
              </Badge>
            )}
            <span className="w-16 shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums text-ink">{c.publicados}</span>
              <span className="block text-[11px] text-subtle">
                {c.publicados === 1 ? 'publicado' : 'publicados'}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function RecentPublished({ rows }: { rows: DashboardArticleRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        icon={<Send />}
        title="Nenhum artigo publicado ainda"
        description="Quando um artigo for ao ar no site do cliente, ele aparece aqui."
      />
    )
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Artigo</th>
          <th className="hidden md:table-cell">Cliente</th>
          <th className="hidden sm:table-cell">Publicado</th>
          <th>
            <span className="sr-only">Ações</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 8).map((row) => (
          <tr key={row.id}>
            <td className="max-w-md">
              <Link
                href={`/articles/${row.id}/review`}
                className="line-clamp-2 font-medium text-ink hover:text-brand md:line-clamp-1"
              >
                {row.tema}
              </Link>
              <span className="mt-0.5 flex gap-2 text-xs text-muted md:hidden">
                <span>{row.client_nome}</span>
                <span className="sm:hidden">{formatRelative(row.publicado_em ?? row.updated_at)}</span>
              </span>
            </td>
            <td className="hidden whitespace-nowrap text-muted md:table-cell">
              <Link href={`/clients/${row.client_id}`} className="hover:text-ink">
                {row.client_nome}
              </Link>
            </td>
            <td className="hidden whitespace-nowrap text-muted sm:table-cell">
              <time
                dateTime={row.publicado_em ?? row.updated_at}
                title={formatDateTime(row.publicado_em ?? row.updated_at)}
              >
                {formatRelative(row.publicado_em ?? row.updated_at)}
              </time>
            </td>
            <td className="text-right">
              {row.wp_url && (
                <a
                  href={row.wp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-brand hover:text-brand-strong"
                >
                  Ver no site
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ResolvedHistory({ rows }: { rows: DashboardServiceError[] }) {
  if (rows.length === 0) return null
  return (
    <details className="group rounded-xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5 font-medium text-ink">
          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
          Falhas já resolvidas
          <Badge>{rows.length}</Badge>
        </span>
        <span className="text-muted group-open:hidden">Mostrar</span>
        <span className="hidden text-muted group-open:inline">Ocultar</span>
      </summary>
      <ul className="divide-y divide-line border-t border-line">
        {rows.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-sm">
            <span className="font-medium text-ink">{e.titulo}</span>
            {e.client_nome && <span className="text-muted">{e.client_nome}</span>}
            <span className="ml-auto text-xs text-emerald-700" title={formatDateTime(e.resolvido_em)}>
              Resolvida {formatRelative(e.resolvido_em)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando painel">
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-3 bg-surface p-6">
            <Skeleton className="h-1 w-10" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  )
}

export default function HomePage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    api.dashboard
      .get()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar o painel'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  if (loading && !data) return <DashboardSkeleton />

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Painel" />
        <Notice
          tone="danger"
          title="Não foi possível carregar o painel"
          action={
            <Button variant="outline" size="sm" onClick={load}>
              Tentar de novo
            </Button>
          }
        >
          {error ?? 'A API não respondeu.'}
        </Notice>
      </div>
    )
  }

  // Produção e revisão vêm da lista por cliente; agendados, publicados e erros dos totais exatos
  const articles = data.publicacoes_por_cliente.flatMap((g) => g.artigos)
  const countStage = (stage: Stage) =>
    articles.filter((a) => STAGES[stage].statuses.includes(a.status)).length
  const counts: Record<Stage, number> = {
    producao: countStage('producao'),
    revisao: countStage('revisao'),
    agendado: data.kpis.agendados,
    publicado: data.kpis.publicados,
    erro: data.kpis.erros_publicacao,
  }
  const generating = articles.filter((a) => a.status === 'gerando').length
  const attention = buildAttention(data, articles)
  const resolved = data.erros_servicos.filter((e) => e.resolvido_em)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel"
        description="O que está em produção, o que espera por você e o que já foi ao ar."
        actions={
          <Link href="/clients/new" className={buttonClass('outline')}>
            <Plus aria-hidden />
            Novo cliente
          </Link>
        }
      />

      <PipelineOverview counts={counts} generating={generating} />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          icon={<AlertOctagon />}
          title={
            <span className="flex items-center gap-2">
              Precisa de atenção
              {attention.length > 0 && (
                <Badge tone={attention.some((a) => a.tone === 'danger') ? 'danger' : 'warning'}>
                  {attention.length}
                </Badge>
              )}
            </span>
          }
          description="Falhas primeiro, depois artigos esperando revisão."
          footer={
            attention.length > ATTENTION_LIMIT ? (
              <span className="text-muted">
                Mostrando {ATTENTION_LIMIT} de {attention.length}.{' '}
                <Link href="/articles?etapa=revisao" className="text-link">
                  Ver todos em revisão
                </Link>
              </span>
            ) : undefined
          }
        >
          <AttentionList items={attention} />
        </Panel>

        <Panel
          icon={<Building2 />}
          title="Clientes"
          description={`${data.kpis.clientes} ${data.kpis.clientes === 1 ? 'site cadastrado' : 'sites cadastrados'}`}
          action={
            <Link href="/clients" className="text-link text-sm">
              Ver todos
            </Link>
          }
        >
          <ClientsList clients={data.clientes} />
        </Panel>
      </div>

      <Panel
        icon={<Send />}
        title="Publicados recentemente"
        action={
          data.artigos_publicados.length > 0 ? (
            <Link href="/articles?etapa=publicado" className="text-link text-sm">
              Ver todos
            </Link>
          ) : undefined
        }
      >
        <RecentPublished rows={data.artigos_publicados} />
      </Panel>

      <ResolvedHistory rows={resolved} />
    </div>
  )
}
