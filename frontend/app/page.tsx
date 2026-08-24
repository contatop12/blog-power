'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type {
  ArticleStatus,
  ConnectionStatus,
  DashboardArticleRow,
  DashboardPayload,
} from '@publisher-p12/types'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function statusLabel(status: ArticleStatus): string {
  const map: Record<ArticleStatus, string> = {
    briefing: 'Briefing',
    gerando: 'Gerando',
    rascunho: 'Rascunho',
    em_revisao: 'Em revisão',
    aprovado: 'Aprovado',
    agendado: 'Agendado',
    publicado: 'Publicado',
    erro: 'Erro',
  }
  return map[status]
}

function statusClass(status: ArticleStatus): string {
  if (status === 'publicado') return 'bg-emerald-50 text-emerald-800'
  if (status === 'agendado') return 'bg-blue-50 text-blue-800'
  if (status === 'erro') return 'bg-red-50 text-red-800'
  if (status === 'em_revisao' || status === 'aprovado') return 'bg-amber-50 text-amber-900'
  return 'bg-slate-100 text-slate-700'
}

function conexaoLabel(status: ConnectionStatus): string {
  if (status === 'ok') return 'OK'
  if (status === 'erro') return 'Erro'
  return 'Não testado'
}

function conexaoClass(status: ConnectionStatus): string {
  if (status === 'ok') return 'text-emerald-700'
  if (status === 'erro') return 'text-red-700'
  return 'text-slate-500'
}

function KpiCard({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'danger' | 'ok'
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 bg-red-50'
      : tone === 'ok'
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-slate-200 bg-white'

  const valueClass =
    tone === 'danger' ? 'text-red-800' : tone === 'ok' ? 'text-emerald-800' : 'text-slate-900'

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  )
}

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-8 text-center text-sm text-slate-500">
        {text}
      </td>
    </tr>
  )
}

function ArticleTable({
  rows,
  empty,
  showError,
}: {
  rows: DashboardArticleRow[]
  empty: string
  showError?: boolean
}) {
  return (
    <table className="min-w-full text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-5 py-3 font-medium">Artigo</th>
          <th className="px-5 py-3 font-medium">Cliente</th>
          <th className="px-5 py-3 font-medium">Status</th>
          {showError && <th className="px-5 py-3 font-medium">Erro</th>}
          <th className="px-5 py-3 font-medium">Atualizado</th>
          <th className="px-5 py-3 font-medium" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.length === 0 ? (
          <EmptyRow colSpan={showError ? 6 : 5} text={empty} />
        ) : (
          rows.map((row) => (
            <tr key={row.id} className="hover:bg-blue-50/40">
              <td className="px-5 py-3 font-medium text-slate-900">{row.tema}</td>
              <td className="px-5 py-3 text-slate-600">
                <Link href={`/clients/${row.client_id}`} className="text-blue-700 hover:underline">
                  {row.client_nome}
                </Link>
              </td>
              <td className="px-5 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(row.status)}`}
                >
                  {statusLabel(row.status)}
                </span>
              </td>
              {showError && (
                <td className="max-w-xs truncate px-5 py-3 text-red-700" title={row.erro_msg ?? ''}>
                  {row.erro_msg ?? '—'}
                </td>
              )}
              <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                {formatDate(row.publicado_em ?? row.agendado_para ?? row.updated_at)}
              </td>
              <td className="px-5 py-3 text-right">
                <Link
                  href={`/articles/${row.id}/review`}
                  className="text-sm font-medium text-blue-700 hover:underline"
                >
                  Abrir
                </Link>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )
}

export default function HomePage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard
      .get()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar painel'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-slate-500">Carregando painel...</p>
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        {error ?? 'Não foi possível carregar o painel.'}
      </div>
    )
  }

  const { kpis } = data

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Painel</h1>
          <p className="mt-1 text-slate-600">
            Visão geral de publicações, clientes e falhas operacionais.
          </p>
        </div>
        <Link
          href="/clients"
          className="inline-flex h-10 items-center rounded-md bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Gerenciar clientes
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Clientes" value={kpis.clientes} />
        <KpiCard label="Publicados" value={kpis.publicados} tone="ok" />
        <KpiCard label="Agendados" value={kpis.agendados} />
        <KpiCard label="Em andamento" value={kpis.em_andamento} />
        <KpiCard label="Erros publicação" value={kpis.erros_publicacao} tone="danger" />
        <KpiCard label="Erros serviços" value={kpis.erros_servicos} tone="danger" />
      </div>

      <Section
        title="Artigos publicados"
        action={
          <Link href="/articles" className="text-sm font-medium text-blue-700 hover:underline">
            Ver todos
          </Link>
        }
      >
        <ArticleTable
          rows={data.artigos_publicados}
          empty="Nenhum artigo publicado ainda."
        />
      </Section>

      <Section title="Erros de publicação">
        <ArticleTable
          rows={data.erros_publicacao}
          empty="Nenhum erro de publicação."
          showError
        />
      </Section>

      <Section title="Erros nos serviços">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Tipo</th>
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Descrição</th>
              <th className="px-5 py-3 font-medium">Detalhe</th>
              <th className="px-5 py-3 font-medium">Quando</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.erros_servicos.length === 0 ? (
              <EmptyRow colSpan={5} text="Nenhum erro de serviço registrado." />
            ) : (
              data.erros_servicos.map((row) => (
                <tr key={row.id} className="hover:bg-blue-50/40">
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-800">
                      {row.tipo === 'conexao_wp' ? 'WordPress' : 'Job'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {row.client_id ? (
                      <Link
                        href={`/clients/${row.client_id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {row.client_nome}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-5 py-3 font-medium text-slate-900">{row.titulo}</td>
                  <td className="max-w-sm truncate px-5 py-3 text-slate-600" title={row.detalhe ?? ''}>
                    {row.detalhe ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                    {formatDate(row.updated_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Section>

      <Section
        title="Clientes"
        action={
          <Link href="/clients/new" className="text-sm font-medium text-blue-700 hover:underline">
            Novo cliente
          </Link>
        }
      >
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Cliente</th>
              <th className="px-5 py-3 font-medium">Domínio</th>
              <th className="px-5 py-3 font-medium">Conexão WP</th>
              <th className="px-5 py-3 font-medium">Artigos</th>
              <th className="px-5 py-3 font-medium">Publicados</th>
              <th className="px-5 py-3 font-medium">Erros</th>
              <th className="px-5 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.clientes.length === 0 ? (
              <EmptyRow colSpan={7} text="Nenhum cliente cadastrado." />
            ) : (
              data.clientes.map((c) => (
                <tr key={c.id} className="hover:bg-blue-50/40">
                  <td className="px-5 py-3 font-medium text-slate-900">{c.nome}</td>
                  <td className="px-5 py-3 text-slate-600">{c.dominio}</td>
                  <td className={`px-5 py-3 font-medium ${conexaoClass(c.status_conexao)}`}>
                    {conexaoLabel(c.status_conexao)}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-700">{c.artigos_total}</td>
                  <td className="px-5 py-3 tabular-nums text-emerald-800">{c.publicados}</td>
                  <td className="px-5 py-3 tabular-nums text-red-700">{c.erros}</td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-sm font-medium text-blue-700 hover:underline"
                    >
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Section>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Publicações por cliente</h2>
        {data.publicacoes_por_cliente.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
            Cadastre um cliente para acompanhar publicações.
          </p>
        ) : (
          data.publicacoes_por_cliente.map((group) => (
            <Section
              key={group.client_id}
              title={`${group.client_nome} — ${group.dominio}`}
              action={
                <Link
                  href={`/articles/new?client_id=${group.client_id}`}
                  className="text-sm font-medium text-blue-700 hover:underline"
                >
                  Novo artigo
                </Link>
              }
            >
              <ArticleTable
                rows={group.artigos}
                empty="Nenhuma publicação neste cliente."
              />
            </Section>
          ))
        )}
      </div>
    </div>
  )
}
