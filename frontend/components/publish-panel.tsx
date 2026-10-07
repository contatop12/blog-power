'use client'

import { useEffect, useState } from 'react'
import { CalendarClock, Send, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { ChoiceGroup } from '@/components/ui/choice-group'
import { Notice } from '@/components/ui/notice'
import { WpCategorySelect } from '@/components/wp-category-select'
import { api, queries } from '@/lib/api'
import { getQueryData, useQuery } from '@/lib/query'
import {
  defaultScheduleLocal,
  formatSchedulePreview,
  localDatetimeToUtcIso,
  utcIsoToLocalDatetime,
} from '@/lib/schedule'
import type { Client, WpPostType } from '@publisher-p12/types'

interface PublishPanelProps {
  articleId: string
  clientId: string
  linksInvalid: boolean
  initialWpPostType?: WpPostType
  initialAgendadoPara?: string | null
  initialCategoriaIds?: number[]
}

export function PublishPanel({
  articleId,
  clientId,
  linksInvalid,
  initialWpPostType = 'post',
  initialAgendadoPara = null,
  initialCategoriaIds,
}: PublishPanelProps) {
  // Cliente, tags e autores em paralelo (antes as tags esperavam o cliente chegar)
  const clientQuery = useQuery(queries.client(clientId), {
    placeholder: () => getQueryData<Client[]>(queries.clients().key)?.find((c) => c.id === clientId),
  })
  const tagsQuery = useQuery(queries.wpTags(clientId))
  const authorsQuery = useQuery(queries.wpAuthors(clientId))
  const client = clientQuery.data ?? null
  const tags = tagsQuery.data ?? []
  const authors = authorsQuery.data ?? []
  const loadError =
    (!tagsQuery.data && tagsQuery.error?.message) ||
    (!authorsQuery.data && authorsQuery.error?.message) ||
    null

  const [wpPostType, setWpPostType] = useState<WpPostType>(initialWpPostType)
  const [mode, setMode] = useState<'now' | 'schedule'>(initialAgendadoPara ? 'schedule' : 'schedule')
  const [scheduleLocal, setScheduleLocal] = useState('')
  const [categoriaId, setCategoriaId] = useState<number | null>(null)
  const [tagIds, setTagIds] = useState<number[]>([])
  const [autorId, setAutorId] = useState<number | ''>('')
  const [publishing, setPublishing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setWpPostType(initialWpPostType)
  }, [initialWpPostType])

  // Padrões entram no formulário uma vez por cliente; revalidar o artigo não apaga a escolha
  const [seededFor, setSeededFor] = useState<string | null>(null)
  if (client && seededFor !== client.id) {
    setSeededFor(client.id)
    const localDefault = defaultScheduleLocal(client.timezone)
    const fromBriefing =
      initialAgendadoPara != null ? utcIsoToLocalDatetime(initialAgendadoPara, client.timezone) : ''
    setScheduleLocal(fromBriefing || localDefault)
    if (initialAgendadoPara) setMode('schedule')
    if (initialCategoriaIds && initialCategoriaIds.length > 0) {
      setCategoriaId(initialCategoriaIds[0] ?? null)
    } else if (client.categoria_padrao_id) {
      setCategoriaId(client.categoria_padrao_id)
    }
    if (client.autor_padrao_id) setAutorId(client.autor_padrao_id)
  }

  async function handlePublish() {
    if (!client) return
    setPublishing(true)
    setError(null)
    setMessage(null)
    try {
      const agendado_para =
        mode === 'now'
          ? new Date().toISOString()
          : localDatetimeToUtcIso(scheduleLocal, client.timezone)

      await api.articles.publish(articleId, {
        categoria_ids: wpPostType === 'page' || categoriaId == null ? [] : [categoriaId],
        tag_ids: wpPostType === 'page' ? [] : tagIds,
        autor_id: autorId === '' ? undefined : autorId,
        agendado_para,
        wp_post_type: wpPostType,
      })

      setMessage(
        mode === 'now'
          ? `${wpPostType === 'page' ? 'Página enviada' : 'Post enviado'} ao WordPress para publicação imediata.`
          : `${wpPostType === 'page' ? 'Página agendada' : 'Post agendado'} para ${formatSchedulePreview(scheduleLocal, client.timezone)} (${client.timezone}).`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao publicar')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Card>
      <CardTitle className="flex items-center gap-2">
        <Send className="size-4 text-muted" aria-hidden />
        Publicação no WordPress
      </CardTitle>
      <CardDescription>
        O agendamento usa o fuso do cliente{client ? ` (${client.timezone})` : ''}. Categorias e tags
        só valem para posts.
      </CardDescription>

      {loadError && (
        <Notice tone="warning" title="Tags e autores do WordPress não carregaram" className="mt-4">
          {loadError}. Teste a conexão na página do cliente.
        </Notice>
      )}

      <div className="mt-5 space-y-5">
        <ChoiceGroup
          name="publish-mode"
          legend="Quando publicar"
          value={mode}
          onChange={setMode}
          options={[
            {
              value: 'schedule',
              label: 'Agendar',
              description: 'Escolha data e hora no fuso do cliente.',
              icon: <CalendarClock />,
            },
            {
              value: 'now',
              label: 'Publicar agora',
              description: 'Vai ao ar assim que o WordPress receber.',
              icon: <Zap />,
            },
          ]}
        />

        {mode === 'schedule' && client && (
          <label className="block animate-fade-in">
            <span className="field-label">Data e hora ({client.timezone})</span>
            <input
              type="datetime-local"
              className="field-input sm:max-w-xs"
              value={scheduleLocal}
              onChange={(e) => setScheduleLocal(e.target.value)}
              required
            />
            <span className="field-help">
              Vai ao ar em {formatSchedulePreview(scheduleLocal, client.timezone)}.
            </span>
          </label>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="field-label">Tipo no WordPress</span>
            <select
              className="field-input"
              value={wpPostType}
              onChange={(e) => setWpPostType(e.target.value as WpPostType)}
            >
              <option value="post">Post (artigo de blog)</option>
              <option value="page">Página</option>
            </select>
            {wpPostType === 'page' && (
              <span className="field-help">Páginas não usam categorias nem tags no WordPress.</span>
            )}
          </label>

          <label className="block">
            <span className="field-label">Autor</span>
            <select
              className="field-input"
              value={autorId === '' ? '' : String(autorId)}
              onChange={(e) => setAutorId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Padrão do WordPress</option>
              {authors.map((author) => (
                <option key={author.id} value={author.id}>
                  {author.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {wpPostType === 'post' && (
          <div className="grid gap-5 sm:grid-cols-2">
            <WpCategorySelect
              clientId={clientId}
              value={categoriaId}
              onChange={setCategoriaId}
              label="Categoria"
              hint="Categoria editorial do post no WordPress."
            />

            <label className="block">
              <span className="field-label">Tags (opcional)</span>
              <select
                multiple
                className="field-input min-h-[96px] !bg-none !pr-3"
                value={tagIds.map(String)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions).map((o) => Number(o.value))
                  setTagIds(selected)
                }}
              >
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
              <span className="field-help">Segure Ctrl (ou Cmd) para escolher várias.</span>
            </label>
          </div>
        )}
      </div>

      {linksInvalid && (
        <Notice tone="danger" title="Há links internos inválidos" className="mt-5">
          Corrija ou remova os links marcados no painel SEO antes de publicar.
        </Notice>
      )}

      {error && (
        <Notice tone="danger" title="A publicação falhou" className="mt-5 animate-fade-in">
          {error}
        </Notice>
      )}
      {message && (
        <Notice tone="success" className="mt-5 animate-fade-in">
          {message}
        </Notice>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <Button
          loading={publishing}
          loadingText={mode === 'now' ? 'Publicando…' : 'Agendando…'}
          disabled={linksInvalid || !client}
          onClick={handlePublish}
        >
          {mode === 'now' ? <Zap aria-hidden /> : <CalendarClock aria-hidden />}
          {mode === 'now' ? 'Publicar agora no WordPress' : 'Agendar no WordPress'}
        </Button>
        {mode === 'schedule' && client && scheduleLocal && (
          <span className="text-sm text-muted">
            {formatSchedulePreview(scheduleLocal, client.timezone)}
          </span>
        )}
      </div>
    </Card>
  )
}
