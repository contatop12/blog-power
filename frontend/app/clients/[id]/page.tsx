'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ClientForm } from '@/components/client-form'
import { MaterialsUpload } from '@/components/materials-upload'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Client, ConnectionCheckResult } from '@publisher-p12/types'

export default function ClientDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [client, setClient] = useState<Client | null>(null)
  const [connection, setConnection] = useState<ConnectionCheckResult | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<'dados' | 'materiais'>('dados')

  useEffect(() => {
    api.clients.get(id).then(setClient)
  }, [id])

  if (!client) {
    return <p className="text-zinc-500">Carregando cliente...</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{client.nome}</h1>
          <p className="text-sm text-zinc-600">{client.dominio}</p>
        </div>
        <Link href="/clients" className="text-sm text-blue-700 hover:underline">
          ← Voltar
        </Link>
      </div>

      <div className="flex gap-2 border-b border-zinc-200">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'dados' ? 'border-b-2 border-blue-700 text-blue-700' : 'text-zinc-600'
          }`}
          onClick={() => setTab('dados')}
        >
          Dados e WordPress
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${
            tab === 'materiais' ? 'border-b-2 border-blue-700 text-blue-700' : 'text-zinc-600'
          }`}
          onClick={() => setTab('materiais')}
        >
          Materiais
        </button>
      </div>

      {tab === 'dados' && (
        <>
          <Card>
            <CardTitle>Ações WordPress</CardTitle>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={async () => {
                  const result = await api.clients.testConnection(id)
                  setConnection(result)
                }}
              >
                Testar conexão
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  const r = await api.clients.syncSitemap(id)
                  setSyncMsg(`${r.synced} URLs sincronizadas`)
                }}
              >
                Sincronizar sitemap
              </Button>
            </div>
            {syncMsg && <p className="mt-3 text-sm text-green-700">{syncMsg}</p>}
            {connection && (
              <ul className="mt-4 space-y-2 text-sm">
                {connection.itens.map((item) => (
                  <li key={item.nome} className={item.ok ? 'text-green-700' : 'text-red-600'}>
                    {item.ok ? '✅' : '❌'} {item.nome}
                    {item.instrucao && (
                      <span className="block text-xs text-zinc-500">{item.instrucao}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <ClientForm
            initial={client}
            submitLabel="Salvar alterações"
            onSubmit={async (data) => {
              const updated = await api.clients.update(id, data)
              setClient(updated)
            }}
          />
        </>
      )}

      {tab === 'materiais' && <MaterialsUpload clientId={id} />}
    </div>
  )
}
