'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { WpCategorySelect } from '@/components/wp-category-select'
import { api } from '@/lib/api'
import {
  defaultScheduleLocal,
  formatSchedulePreview,
  localDatetimeToUtcIso,
  utcIsoToLocalDatetime,
} from '@/lib/schedule'
import type {
  Client,
  WpAuthorOption,
  WpPostType,
  WpTagOption,
} from '@publisher-p12/types'

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
  const [client, setClient] = useState<Client | null>(null)
  const [tags, setTags] = useState<WpTagOption[]>([])
  const [authors, setAuthors] = useState<WpAuthorOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

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

  useEffect(() => {
    api.clients.get(clientId).then((c) => {
      setClient(c)
      const localDefault = defaultScheduleLocal(c.timezone)
      const fromBriefing =
        initialAgendadoPara != null
          ? utcIsoToLocalDatetime(initialAgendadoPara, c.timezone)
          : ''
      setScheduleLocal(fromBriefing || localDefault)
      if (initialAgendadoPara) setMode('schedule')
      if (initialCategoriaIds && initialCategoriaIds.length > 0) {
        setCategoriaId(initialCategoriaIds[0] ?? null)
      } else if (c.categoria_padrao_id) {
        setCategoriaId(c.categoria_padrao_id)
      }
      if (c.autor_padrao_id) setAutorId(c.autor_padrao_id)
    })
  }, [clientId, initialAgendadoPara, initialCategoriaIds])

  useEffect(() => {
    if (!client) return
    setLoadError(null)
    Promise.all([api.clients.wpTags(clientId), api.clients.wpAuthors(clientId)])
      .then(([tgs, auths]) => {
        setTags(tgs)
        setAuthors(auths)
      })
      .catch((e: Error) => setLoadError(e.message))
  }, [client, clientId])

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
          ? `Publicação enviada como ${wpPostType === 'page' ? 'página' : 'post'}. Será publicado imediatamente no WordPress.`
          : `${wpPostType === 'page' ? 'Página' : 'Post'} agendado para ${formatSchedulePreview(scheduleLocal, client.timezone)} (${client.timezone}).`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao publicar')
    } finally {
      setPublishing(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200'

  return (
    <Card>
      <CardTitle>Publicação no WordPress</CardTitle>
      <p className="mt-2 text-sm text-slate-600">
        Escolha o tipo de conteúdo, categorias (só para posts), data/hora e envie. O fuso do cliente é
        usado no agendamento.
      </p>

      {loadError && (
        <p className="mt-3 text-sm text-amber-800">
          Não foi possível carregar taxonomias do WP: {loadError}. Verifique a conexão do cliente.
        </p>
      )}

      <div className="mt-4 space-y-4">
        <label className="block text-sm text-slate-700">
          Tipo no WordPress
          <select
            className={inputClass}
            value={wpPostType}
            onChange={(e) => setWpPostType(e.target.value as WpPostType)}
          >
            <option value="post">Post (artigo de blog)</option>
            <option value="page">Página</option>
          </select>
          {wpPostType === 'page' && (
            <span className="mt-1 block text-xs text-slate-500">
              Páginas não usam categorias nem tags no WordPress.
            </span>
          )}
        </label>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-800">Quando publicar</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="publish-mode"
              checked={mode === 'now'}
              onChange={() => setMode('now')}
            />
            Publicar agora
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="publish-mode"
              checked={mode === 'schedule'}
              onChange={() => setMode('schedule')}
            />
            Agendar publicação
          </label>
        </fieldset>

        {mode === 'schedule' && client && (
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

        {wpPostType === 'post' && (
          <>
            <WpCategorySelect
              clientId={clientId}
              value={categoriaId}
              onChange={setCategoriaId}
              label="Categoria"
              hint="Categoria editorial do post no WordPress."
            />

            <label className="block text-sm text-slate-700">
              Tags (opcional)
              <select
                multiple
                className={`${inputClass} min-h-[88px]`}
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
            </label>
          </>
        )}

        <label className="block text-sm text-slate-700">
          Autor
          <select
            className={inputClass}
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

      {linksInvalid && (
        <p className="mt-3 text-sm text-red-700">
          Corrija links internos inválidos antes de publicar.
        </p>
      )}

      {error && <p className="mt-3 animate-fade-in text-sm text-red-700">{error}</p>}
      {message && <p className="mt-3 animate-fade-in text-sm text-emerald-700">{message}</p>}

      <Button
        className="mt-4"
        loading={publishing}
        loadingText={mode === 'now' ? 'Publicando...' : 'Agendando...'}
        disabled={linksInvalid || !client}
        onClick={handlePublish}
      >
        {mode === 'now' ? 'Publicar agora no WordPress' : 'Agendar no WordPress'}
      </Button>
    </Card>
  )
}
