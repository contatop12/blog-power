'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CalendarClock, ClipboardCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { WpCategorySelect } from '@/components/wp-category-select'
import { api, queries } from '@/lib/api'
import { getQueryData, useQuery } from '@/lib/query'
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

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {description && <CardDescription>{description}</CardDescription>}
      <div className="mt-5 space-y-5">{children}</div>
    </Card>
  )
}

function NewArticleSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Carregando">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

function NewArticleForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clientId = searchParams.get('client_id')?.trim() ?? ''

  const clientQuery = useQuery(clientId ? queries.client(clientId) : null, {
    placeholder: () => getQueryData<Client[]>(queries.clients().key)?.find((c) => c.id === clientId),
  })
  const client = clientQuery.data ?? null
  const clientMissing = Boolean(clientQuery.error) && !client
  const [briefing, setBriefing] = useState<Briefing>(emptyBriefing)
  const [kwsSecundariasText, setKwsSecundariasText] = useState('')
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const [conteudoColado, setConteudoColado] = useState('')
  const [wpPostType, setWpPostType] = useState<WpPostType>('post')
  const [scheduleMode, setScheduleMode] = useState<'review' | 'schedule'>('review')
  const [scheduleLocal, setScheduleLocal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Padrões do cliente entram no formulário uma vez, quando ele chega (do cache ou da API)
  const [seededFor, setSeededFor] = useState<string | null>(null)
  if (client && seededFor !== client.id) {
    setSeededFor(client.id)
    setScheduleLocal(defaultScheduleLocal(client.timezone))
    if (client.categoria_padrao_id) setCategoriaId(client.categoria_padrao_id)
  }

  useEffect(() => {
    if (!clientId || clientMissing) router.replace('/clients')
  }, [clientId, clientMissing, router])

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

  if (!clientId || !client) return <NewArticleSkeleton />

  const hasPastedText = conteudoColado.trim().length > 0

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        back={{ href: `/clients/${clientId}`, label: client.nome }}
        title="Novo artigo"
        description="Preencha a pauta como na planilha editorial. Os agentes usam este briefing junto com o perfil do cliente."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Pauta" description="Sobre o que o artigo fala e para qual busca ele deve aparecer.">
          <label className="block">
            <span className="field-label">Tema ou título sugerido</span>
            <input
              className="field-input"
              value={briefing.tema}
              onChange={(e) => setBriefing({ ...briefing, tema: e.target.value })}
              placeholder="Ex.: Wi‑Fi 7 para empresas: quando vale a pena migrar"
              required
            />
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block">
              <span className="field-label">Palavra-chave principal</span>
              <input
                className="field-input"
                value={briefing.kw_principal}
                onChange={(e) => setBriefing({ ...briefing, kw_principal: e.target.value })}
                required
              />
            </label>

            <label className="block">
              <span className="field-label">Palavras-chave secundárias</span>
              <input
                className="field-input"
                value={kwsSecundariasText}
                onChange={(e) => setKwsSecundariasText(e.target.value)}
                placeholder="wifi 7, roteador empresarial"
              />
              <span className="field-help">Separe por vírgula.</span>
            </label>
          </div>
        </Section>

        <Section title="Direcionamento" description="Como o artigo deve ser escrito e onde ele entra no blog.">
          <div className="grid gap-5 sm:grid-cols-2">
            <WpCategorySelect
              clientId={clientId}
              value={categoriaId}
              onChange={setCategoriaId}
              label="Categoria"
              disabled={wpPostType === 'page'}
              hint={
                wpPostType === 'page'
                  ? 'Páginas não usam categorias no WordPress.'
                  : 'Categoria editorial do artigo.'
              }
            />

            <label className="block">
              <span className="field-label">Etapa do funil</span>
              <select
                className="field-input"
                value={briefing.etapa_funil}
                onChange={(e) => setBriefing({ ...briefing, etapa_funil: e.target.value })}
              >
                {FUNIS.map((v) => (
                  <option key={v} value={v}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="field-label">Ângulo editorial</span>
            <textarea
              className="field-input"
              rows={3}
              value={briefing.angulo}
              onChange={(e) => setBriefing({ ...briefing, angulo: e.target.value })}
              placeholder="Ex.: focar em critérios B2B e não repetir o guia geral que já existe"
            />
          </label>

          <label className="block">
            <span className="field-label">Observações</span>
            <textarea
              className="field-input"
              rows={3}
              value={briefing.observacoes ?? ''}
              onChange={(e) => setBriefing({ ...briefing, observacoes: e.target.value })}
              placeholder="CTA, serviço a destacar, URL sugerida, links de referência"
            />
          </label>
        </Section>

        <Section
          title="Texto pronto (opcional)"
          description="Se você já tem o artigo escrito, cole aqui em Markdown. A redação é pulada e os agentes cuidam de SEO, links e revisão."
        >
          <label className="block">
            <span className="sr-only">Texto completo do artigo em Markdown</span>
            <textarea
              className="field-input font-mono text-[13px] leading-relaxed"
              rows={hasPastedText ? 16 : 5}
              value={conteudoColado}
              onChange={(e) => setConteudoColado(e.target.value)}
              placeholder={'# Título do artigo\n\nCole o texto completo aqui…'}
            />
          </label>
          {hasPastedText && (
            <Notice tone="info">A redação será pulada: o texto colado vai direto para edição e revisão.</Notice>
          )}
        </Section>

        <Section title="Publicação" description="Você pode decidir a data agora ou só depois de revisar.">
          <label className="block sm:max-w-xs">
            <span className="field-label">Tipo de conteúdo</span>
            <select
              className="field-input"
              value={wpPostType}
              onChange={(e) => setWpPostType(e.target.value as WpPostType)}
            >
              <option value="post">Post (artigo de blog)</option>
              <option value="page">Página</option>
            </select>
          </label>

          <ChoiceGroup
            name="schedule-mode"
            legend="Agendamento"
            value={scheduleMode}
            onChange={setScheduleMode}
            options={[
              {
                value: 'review',
                label: 'Decidir na revisão',
                description: 'O artigo espera por você antes de ir ao ar.',
                icon: <ClipboardCheck />,
              },
              {
                value: 'schedule',
                label: 'Agendar agora',
                description: 'Já deixa data e hora marcadas.',
                icon: <CalendarClock />,
              },
            ]}
          />

          {scheduleMode === 'schedule' && (
            <label className="block animate-fade-in sm:max-w-xs">
              <span className="field-label">Data e hora ({client.timezone})</span>
              <input
                type="datetime-local"
                className="field-input"
                value={scheduleLocal}
                onChange={(e) => setScheduleLocal(e.target.value)}
                required
              />
              <span className="field-help">
                Vai ao ar em {formatSchedulePreview(scheduleLocal, client.timezone)}.
              </span>
            </label>
          )}
        </Section>

        {error && (
          <Notice tone="danger" title="O artigo não foi criado" className="animate-fade-in">
            {error}
          </Notice>
        )}

        <div className="flex flex-col-reverse items-start gap-3 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Os agentes começam assim que você enviar. O artigo aparece na revisão quando ficar pronto.
          </p>
          <Button type="submit" loading={saving} loadingText="Enviando aos agentes…" className="shrink-0">
            <Sparkles aria-hidden />
            Gerar artigo
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function NewArticlePage() {
  return (
    <Suspense fallback={<NewArticleSkeleton />}>
      <NewArticleForm />
    </Suspense>
  )
}
