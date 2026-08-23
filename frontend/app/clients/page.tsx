'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { buttonClass } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Link href="/clients/new" className={buttonClass()}>
          Novo cliente
        </Link>
      </div>

      {loading && <p className="text-zinc-500">Carregando...</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="grid gap-4">
        {clients.map((c) => (
          <Card key={c.id}>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{c.nome}</CardTitle>
                <p className="mt-1 text-sm text-zinc-600">{c.dominio}</p>
                <p className="text-xs text-zinc-500">
                  Conexão: {c.status_conexao} · SEO: {c.seo_plugin}
                </p>
              </div>
              <Link href={`/clients/${c.id}`} className={buttonClass('outline', 'h-8 px-3 text-sm')}>
                Editar
              </Link>
            </div>
          </Card>
        ))}
        {!loading && clients.length === 0 && (
          <p className="text-zinc-500">Nenhum cliente cadastrado.</p>
        )}
      </div>
    </div>
  )
}
