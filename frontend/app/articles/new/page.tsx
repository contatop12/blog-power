'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
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

export default function NewArticlePage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [briefing, setBriefing] = useState<Briefing>(emptyBriefing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.clients.list().then(setClients)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId) return
    setSaving(true)
    try {
      const article = await api.articles.create({ client_id: clientId, briefing })
      await api.articles.generate(article.id)
      router.push(`/articles/${article.id}/review`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Novo artigo</h1>
      <Card>
        <CardTitle>Briefing de pauta</CardTitle>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm">
            Cliente
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Selecione...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Tema
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
              value={briefing.tema}
              onChange={(e) => setBriefing({ ...briefing, tema: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            KW principal
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
              value={briefing.kw_principal}
              onChange={(e) => setBriefing({ ...briefing, kw_principal: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            Ângulo editorial
            <textarea
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
              rows={3}
              value={briefing.angulo}
              onChange={(e) => setBriefing({ ...briefing, angulo: e.target.value })}
            />
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? 'Gerando...' : 'Gerar artigo'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
