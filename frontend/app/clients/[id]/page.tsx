'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ClientForm } from '@/components/client-form'
import { MuPluginGuide } from '@/components/client-form-guides'
import { ClientStatusIcon, clientStatusTitle } from '@/components/client-status-icon'
import { FieldGuide } from '@/components/field-hint'
import { InstallBridgeButton } from '@/components/install-bridge-button'
import { KnowledgeBasePanel } from '@/components/knowledge-base-panel'
import { MaterialsUpload } from '@/components/materials-upload'
import { WpCategoriesManager } from '@/components/wp-categories-manager'
import { Button, buttonClass } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { ClientPageSkeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import type { Client, ConnectionCheckResult } from '@publisher-p12/types'

export default function ClientDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [client, setClient] = useState<Client | null>(null)
  const [connection, setConnection] = useState<ConnectionCheckResult | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<'dados' | 'base' | 'categorias' | 'materiais'>('dados')
  const [testing, setTesting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    api.clients.get(id).then(setClient).catch(() => setClient(null))
  }, [id])

  if (!client) {
    return <ClientPageSkeleton />
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <ClientStatusIcon status={client.status_conexao} />
            <span>{client.nome}</span>
            {(testing || syncing) && <Spinner size="sm" className="text-blue-700" />}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">{client.dominio}</p>
          <p className="text-xs text-slate-500">{clientStatusTitle(client.status_conexao)}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/articles/new?client_id=${id}`} className={buttonClass()}>
            Novo artigo
          </Link>
          <Link href="/clients" className="text-sm text-blue-700 hover:underline">
            ← Voltar
          </Link>
        </div>
      </div>

      <div className="flex gap-2 border-b border-zinc-200">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium transition-colors duration-150 ${
            tab === 'dados' ? 'border-b-2 border-blue-700 text-blue-700' : 'text-zinc-600 hover:text-blue-700'
          }`}
          onClick={() => setTab('dados')}
        >
          Dados e WordPress
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium transition-colors duration-150 ${
            tab === 'base'
              ? 'border-b-2 border-blue-700 text-blue-700'
              : 'text-zinc-600 hover:text-blue-700'
          }`}
          onClick={() => setTab('base')}
        >
          Base e pautas
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium transition-colors duration-150 ${
            tab === 'categorias'
              ? 'border-b-2 border-blue-700 text-blue-700'
              : 'text-zinc-600 hover:text-blue-700'
          }`}
          onClick={() => setTab('categorias')}
        >
          Categorias
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium transition-colors duration-150 ${
            tab === 'materiais'
              ? 'border-b-2 border-blue-700 text-blue-700'
              : 'text-zinc-600 hover:text-blue-700'
          }`}
          onClick={() => setTab('materiais')}
        >
          Materiais
        </button>
      </div>

      {tab === 'dados' && (
        <div key="dados" className="animate-slide-up space-y-6">
          <Card>
            <CardTitle className="flex flex-wrap items-center gap-1.5">
              Ações WordPress
              <FieldGuide title="mu-plugin P12 Bridge — instalação">
                <MuPluginGuide />
              </FieldGuide>
            </CardTitle>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="outline"
                loading={testing}
                loadingText="Testando..."
                disabled={syncing}
                onClick={async () => {
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
                }}
              >
                Testar conexão
              </Button>
              <Button
                variant="outline"
                loading={syncing}
                loadingText="Sincronizando..."
                disabled={testing}
                onClick={async () => {
                  setSyncing(true)
                  setActionError(null)
                  setSyncMsg(null)
                  try {
                    const r = await api.clients.syncSitemap(id)
                    const secs =
                      typeof r.duration_ms === 'number'
                        ? ` em ${(r.duration_ms / 1000).toFixed(1)}s`
                        : ''
                    setSyncMsg(`${r.synced} URLs sincronizadas${secs}`)
                  } catch (e) {
                    setActionError(e instanceof Error ? e.message : 'Falha ao sincronizar sitemap')
                  } finally {
                    setSyncing(false)
                  }
                }}
              >
                Sincronizar sitemap
              </Button>
              <InstallBridgeButton dominio={client.dominio} />
              <a
                href="/p12-publisher-bridge.zip"
                download="p12-publisher-bridge.zip"
                className={buttonClass('ghost', 'h-10 text-sm')}
              >
                Só baixar ZIP
              </a>
            </div>
            {actionError && (
              <p className="mt-3 animate-fade-in text-sm text-red-600">{actionError}</p>
            )}
            {syncMsg && !syncing && (
              <p className="mt-3 animate-fade-in text-sm text-green-700">{syncMsg}</p>
            )}
            {testing && !connection && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <Spinner size="sm" className="text-blue-700" />
                Verificando HTTPS, autenticação e plugins...
              </div>
            )}
            {connection && (
              <ul
                className={`mt-4 space-y-2 text-sm ${testing ? 'opacity-60' : 'animate-fade-in'}`}
              >
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
            clientId={id}
            submitLabel="Salvar alterações"
            onSubmit={async (data) => {
              const updated = await api.clients.update(id, data)
              setClient(updated)
            }}
          />
        </div>
      )}

      {tab === 'base' && (
        <div key="base" className="animate-slide-up">
          <KnowledgeBasePanel clientId={id} />
        </div>
      )}

      {tab === 'categorias' && (
        <div key="categorias" className="animate-slide-up">
          <WpCategoriesManager clientId={id} />
        </div>
      )}

      {tab === 'materiais' && (
        <div key="materiais" className="animate-slide-up">
          <MaterialsUpload clientId={id} />
        </div>
      )}
    </div>
  )
}
