'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Building2, Plus, Search, X } from 'lucide-react'
import { Badge, ConnectionBadge } from '@/components/ui/badge'
import { Button, buttonClass } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { queries } from '@/lib/api'
import { SEO_PLUGINS } from '@/lib/client-form'
import { calcularCompletudeLocal } from '@/lib/perfil-cliente'
import { prefetchQuery, useQuery } from '@/lib/query'
import type { Client, SeoPlugin } from '@publisher-p12/types'

/** A partir daqui a lista ganha busca. */
const SEARCH_THRESHOLD = 6

function siteHost(dominio: string): string {
  return dominio.replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function seoPluginLabel(plugin: SeoPlugin): string {
  if (plugin === 'nenhum') return 'Sem plugin SEO'
  return SEO_PLUGINS.find((p) => p.value === plugin)?.label ?? plugin
}

/** Iniciais do nome para o avatar: "ABX Telecom" → "AT". */
function initials(nome: string): string {
  const words = nome.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
}

function ClientCard({ client }: { client: Client }) {
  const perfilIncompleto =
    !client.perfil_marca || calcularCompletudeLocal(client.perfil_marca).faltando_obrigatorios.length > 0

  // Busca o cliente enquanto o cursor/foco chega no card: o clique já abre com dados
  const prefetch = () => prefetchQuery(queries.client(client.id))

  return (
    <article
      className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-5 transition-colors duration-150 hover:border-line-strong"
      onPointerEnter={prefetch}
      onFocusCapture={prefetch}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-sm font-bold tracking-tight text-brand-strong"
          aria-hidden
        >
          {initials(client.nome)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold tracking-tight">
            <Link href={`/clients/${client.id}`} className="text-ink transition-colors hover:text-brand">
              {client.nome}
            </Link>
          </h2>
          <p className="truncate text-[13px] text-muted" title={client.dominio}>
            {siteHost(client.dominio)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <ConnectionBadge status={client.status_conexao} />
        <Badge title="Plugin SEO">{seoPluginLabel(client.seo_plugin)}</Badge>
        {perfilIncompleto && (
          <Badge tone="warning" title="Faltam campos obrigatórios do perfil. Os artigos não são gerados sem eles.">
            Perfil incompleto
          </Badge>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link
          href={`/articles/new?client_id=${client.id}`}
          className={buttonClass('default', undefined, 'sm')}
        >
          <Plus aria-hidden />
          Novo artigo
        </Link>
        <Link href={`/clients/${client.id}`} className={buttonClass('outline', undefined, 'sm')}>
          Abrir
        </Link>
      </div>
    </article>
  )
}

function ClientsSkeleton() {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      aria-label="Carregando clientes"
    >
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 rounded-lg" />
            <div className="flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="mt-4 flex gap-1.5">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="mt-5 flex gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ClientsPage() {
  const { data, error, isLoading, reload } = useQuery(queries.clients())
  const clients = useMemo(() => data ?? [], [data])
  const [busca, setBusca] = useState('')

  const visible = useMemo(() => {
    const term = busca.trim().toLowerCase()
    if (!term) return clients
    return clients.filter(
      (c) => c.nome.toLowerCase().includes(term) || c.dominio.toLowerCase().includes(term),
    )
  }, [clients, busca])

  const showSearch = clients.length > SEARCH_THRESHOLD

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Os sites WordPress atendidos pela P12. Abra um cliente para ajustar a conexão, o perfil e a base de conteúdo."
        actions={
          <Link href="/clients/new" className={buttonClass()}>
            <Plus aria-hidden />
            Novo cliente
          </Link>
        }
      />

      {showSearch && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="relative w-full sm:max-w-sm">
            <span className="sr-only">Buscar por nome ou domínio</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
              aria-hidden
            />
            <input
              type="search"
              className="field-input pl-9"
              placeholder="Buscar por nome ou domínio"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <span className="text-sm tabular-nums text-muted" aria-live="polite">
            {busca.trim()
              ? `${visible.length} de ${clients.length} clientes`
              : `${clients.length} clientes`}
          </span>
        </div>
      )}

      {error && !data && (
        <Notice
          tone="danger"
          title="Não foi possível carregar os clientes"
          action={
            <Button variant="outline" size="sm" onClick={() => reload().catch(() => undefined)}>
              Tentar de novo
            </Button>
          }
        >
          {error.message}
        </Notice>
      )}

      {isLoading ? (
        <ClientsSkeleton />
      ) : !data ? null : clients.length === 0 ? (
        <EmptyState
          icon={<Building2 />}
          title="Nenhum cliente cadastrado"
          description="Cadastre o site WordPress de um cliente para começar a produzir artigos para ele."
          action={
            <Link href="/clients/new" className={buttonClass()}>
              <Plus aria-hidden />
              Novo cliente
            </Link>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title="Nenhum cliente encontrado"
          description={`Nada com "${busca.trim()}" no nome ou no domínio.`}
          action={
            <Button variant="outline" onClick={() => setBusca('')}>
              <X aria-hidden />
              Limpar busca
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((c) => (
            <ClientCard key={c.id} client={c} />
          ))}
        </div>
      )}
    </div>
  )
}
