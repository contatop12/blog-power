'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Briefing, Client } from '@publisher-p12/types'

const emptyBriefing: Briefing = {
  tema: '',
  kw_principal: '',
  kws_secundarias: [],
  intencao: 'informacional',
  etapa_funil: 'meio',
  angulo: '',
  publico: '',
  extensao_alvo: 2500,
  artigos_irmaos: [],
  observacoes: '',
}

function NewArticleForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client_id')?.trim() ?? ''

  const [client, setClient] = useState<Client | null>(null)
  const [briefing, setBriefing] = useState<Briefing>(emptyBriefing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId) {
      router.replace('/clients')
      return
    }
    api.clients
      .get(clientId)
      .then(setClient)
      .catch(() => router.replace('/clients'))
  }, [clientId, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) return
    setSaving(true)
    setError(null)
    try {
      const article = await api.articles.create({ client_id: clientId, briefing })
      await api.articles.generate(article.id)
      router.push(`/articles/${article.id}/review`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar artigo')
    } finally {
      setSaving(false)
    }
  }

  if (!clientId || !client) {
    return <p className="text-slate-500">Carregando...</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/clients/${clientId}`} className="text-sm text-blue-700 hover:underline">
          ← Voltar para {client.nome}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Novo artigo</h1>
        <p className="mt-1 text-sm text-slate-600">Cliente: {client.nome}</p>
      </div>
      <Card>
        <CardTitle>Briefing de pauta</CardTitle>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm text-slate-700">
            Tema
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={briefing.tema}
              onChange={(e) => setBriefing({ ...briefing, tema: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm text-slate-700">
            KW principal
            <input
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={briefing.kw_principal}
              onChange={(e) => setBriefing({ ...briefing, kw_principal: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm text-slate-700">
            Ângulo editorial
            <textarea
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              rows={3}
              value={briefing.angulo}
              onChange={(e) => setBriefing({ ...briefing, angulo: e.target.value })}
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Gerando...' : 'Gerar artigo'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

export default function NewArticlePage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Carregando...</p>}>
      <NewArticleForm />
    </Suspense>
  )
}
