'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { WpCategorySelect } from '@/components/wp-category-select'
import { api } from '@/lib/api'
import { defaultScheduleLocal, formatSchedulePreview, localDatetimeToUtcIso } from '@/lib/schedule'
import type { Briefing, Client, WpPostType } from '@publisher-p12/types'

const emptyBriefing: Briefing = {
  tema: '',
  kw_principal: '',
  kws_secundarias: [],
  intencao: '',
  etapa_funil: 'meio',
  angulo: '',
  publico: 'empresas B2B',
  extensao_alvo: 2500,
  artigos_irmaos: [],
  observacoes: '',
  categoria_ids: [],
}

const FUNIS = ['topo', 'meio', 'fundo', 'topo/meio', 'meio/fundo'] as const

function NewArticleForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client_id')?.trim() ?? ''

  const [client, setClient] = useState<Client | null>(null)
  const [briefing, setBriefing] = useState<Briefing>(emptyBriefing)
  const [kwsSecundariasText, setKwsSecundariasText] = useState('')
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const [conteudoColado, setConteudoColado] = useState('')
  const [wpPostType, setWpPostType] = useState<WpPostType>('post')
  const [scheduleMode, setScheduleMode] = useState<'review' | 'schedule'>('review')
  const [scheduleLocal, setScheduleLocal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId) {
      router.replace('/clients')
      return
    }
    api.clients
      .get(clientId)
      .then((c) => {
        setClient(c)
        setScheduleLocal(defaultScheduleLocal(c.timezone))
        if (c.categoria_padrao_id) setCategoriaId(c.categoria_padrao_id)
      })
      .catch(() => router.replace('/clients'))
  }, [clientId, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !client) return
    setSaving(true)
    setError(null)
    try {
      const payload: Briefing = {
        ...briefing,
        kws_secundarias: kwsSecundariasText
          .split(/[,;|\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        categoria_ids: categoriaId != null ? [categoriaId] : [],
        intencao: '',
      }

      const agendado_para =
        scheduleMode === 'schedule'
          ? localDatetimeToUtcIso(scheduleLocal, client.timezone)
          : null

      const article = await api.articles.create({
        client_id: clientId,
        briefing: payload,
        conteudo_colado: conteudoColado.trim() || null,
        wp_post_type: wpPostType,
        agendado_para,
      })
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

  const inputClass =
    'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/clients/${clientId}`} className="text-sm text-blue-700 hover:underline">
          ← Voltar para {client.nome}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Novo artigo</h1>
        <p className="mt-1 text-sm text-slate-600">Cliente: {client.nome}</p>
        <p className="mt-1 text-xs text-slate-500">
          Campos alinhados à planilha editorial (tema, KW, categorias, funil, direcionamento).
        </p>
      </div>
      <Card>
        <CardTitle>Briefing de pauta</CardTitle>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm text-slate-700">
            Tema / título sugerido
            <input
              className={inputClass}
              value={briefing.tema}
              onChange={(e) => setBriefing({ ...briefing, tema: e.target.value })}
              placeholder="Ex.: Wi‑Fi 7 para empresas: quando vale a pena migrar"
              required
            />
          </label>

          <label className="block text-sm text-slate-700">
            Palavra-chave principal
            <input
              className={inputClass}
              value={briefing.kw_principal}
              onChange={(e) => setBriefing({ ...briefing, kw_principal: e.target.value })}
              required
            />
          </label>

          <label className="block text-sm text-slate-700">
            Palavras-chave secundárias
            <input
              className={inputClass}
              value={kwsSecundariasText}
              onChange={(e) => setKwsSecundariasText(e.target.value)}
              placeholder="Separadas por vírgula"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <WpCategorySelect
              clientId={clientId}
              value={categoriaId}
              onChange={setCategoriaId}
              disabled={wpPostType === 'page'}
              hint={
                wpPostType === 'page'
                  ? 'Páginas não usam categorias no WordPress.'
                  : 'Categoria editorial do artigo.'
              }
            />

            <label className="block text-sm text-slate-700">
              Funil
              <select
                className={inputClass}
                value={briefing.etapa_funil}
                onChange={(e) => setBriefing({ ...briefing, etapa_funil: e.target.value })}
              >
                {FUNIS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm text-slate-700">
            Ângulo / direcionamento editorial
            <textarea
              className={inputClass}
              rows={3}
              value={briefing.angulo}
              onChange={(e) => setBriefing({ ...briefing, angulo: e.target.value })}
              placeholder="Ex.: Focar em critérios B2B, evitar repetir guia geral existente"
            />
          </label>

          <label className="block text-sm text-slate-700">
            Observações (CTA, serviço, URL sugerida, fontes)
            <textarea
              className={inputClass}
              rows={3}
              value={briefing.observacoes ?? ''}
              onChange={(e) => setBriefing({ ...briefing, observacoes: e.target.value })}
              placeholder="CTA, cluster, links de referência, URL sugerida..."
            />
          </label>

          <label className="block text-sm text-slate-700">
            Texto completo do artigo (opcional)
            <textarea
              className={inputClass}
              rows={14}
              value={conteudoColado}
              onChange={(e) => setConteudoColado(e.target.value)}
              placeholder="Cole aqui o artigo completo em Markdown. Se preencher, o sistema pula a redação, tenta aproveitar o SEO/slug/keywords do texto colado e vai direto para edição/revisão."
            />
            <span className="mt-1 block text-xs text-slate-500">
              Ideal para quando você já escreveu o artigo e só quer revisar, gerar SEO, validar links
              e publicar.
            </span>
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
            <p className="text-sm font-medium text-slate-800">Publicação no WordPress</p>

            <label className="block text-sm text-slate-700">
              Tipo de conteúdo
              <select
                className={inputClass}
                value={wpPostType}
                onChange={(e) => setWpPostType(e.target.value as WpPostType)}
              >
                <option value="post">Post (artigo de blog)</option>
                <option value="page">Página</option>
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm text-slate-700">Agendamento</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="schedule-mode"
                  checked={scheduleMode === 'review'}
                  onChange={() => setScheduleMode('review')}
                />
                Definir na revisão
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="schedule-mode"
                  checked={scheduleMode === 'schedule'}
                  onChange={() => setScheduleMode('schedule')}
                />
                Agendar data/hora agora
              </label>
            </fieldset>

            {scheduleMode === 'schedule' && (
              <label className="block text-sm text-slate-700">
                Data e hora ({client.timezone})
                <input
                  type="datetime-local"
                  className={inputClass}
                  value={scheduleLocal}
                  onChange={(e) => setScheduleLocal(e.target.value)}
                  required
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Preview: {formatSchedulePreview(scheduleLocal, client.timezone)}
                </span>
              </label>
            )}
          </div>

          {error && <p className="animate-fade-in text-sm text-red-700">{error}</p>}
          <Button type="submit" loading={saving} loadingText="Gerando...">
            Gerar artigo
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
