'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ClientStatusIcon, clientStatusTitle } from '@/components/client-status-icon'
import { buttonClass } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import type { Client } from '@publisher-p12/types'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.clients
      .list()
      .then(setClients)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Link href="/clients/new" className={buttonClass()}>
          Novo cliente
        </Link>
      </div>

      {loading && (
        <div className="grid gap-4" aria-busy="true" aria-label="Carregando clientes">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Spinner size="sm" className="text-blue-700" />
            Carregando clientes...
          </div>
        </div>
      )}

      {error && <p className="animate-fade-in text-red-600">{error}</p>}

      {!loading && (
        <div className="grid gap-4">
          {clients.map((c) => (
            <Card key={c.id} className="animate-slide-up transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>
                    <span className="flex items-center gap-2">
                      <ClientStatusIcon status={c.status_conexao} />
                      <span>{c.nome}</span>
                    </span>
                  </CardTitle>
                  <p className="mt-1 text-sm text-zinc-600">{c.dominio}</p>
                  <p className="text-xs text-zinc-500">
                    {clientStatusTitle(c.status_conexao)} · SEO: {c.seo_plugin}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href={`/articles/new?client_id=${c.id}`}
                    className={buttonClass('default', 'h-8 px-3 text-sm')}
                  >
                    Novo artigo
                  </Link>
                  <Link
                    href={`/clients/${c.id}`}
                    className={buttonClass('outline', 'h-8 px-3 text-sm')}
                  >
                    Editar
                  </Link>
                </div>
              </div>
            </Card>
          ))}
          {clients.length === 0 && (
            <p className="text-zinc-500">Nenhum cliente cadastrado.</p>
          )}
        </div>
      )}
    </div>
  )
}
