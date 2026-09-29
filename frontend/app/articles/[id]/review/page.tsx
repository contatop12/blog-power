'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileText,
  ImageIcon,
  Link2,
  Save,
  Search,
  XCircle,
} from 'lucide-react'
import { PipelineStepper } from '@/components/pipeline'
import { PublishPanel } from '@/components/publish-panel'
import { QaReportPanel } from '@/components/qa-report-panel'
import { ArticleStatusBadge, Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { PageHeader } from '@/components/ui/page-header'
import { CropMarks } from '@/components/ui/print'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Article, LinkInterno } from '@publisher-p12/types'

const FRESHNESS: Record<string, string> = {
  evergreen: 'Evergreen',
  semi_evergreen: 'Semi-evergreen',
  alta_volatilidade: 'Alta volatilidade',
}

/** "problema_solucao" → "Problema solucao" — valores de enum legíveis. */
function humanize(value: string): string {
  const text = value.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Contagem de caracteres com barra: verde dentro da faixa ideal, âmbar fora. */
function LengthMeter({
  label,
  value,
  min,
  max,
}: {
  label: string
  value: string | null | undefined
  min: number
  max: number
}) {
  const len = value?.length ?? 0
  const scale = max + 30
  const ok = len >= min && len <= max
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className={cn('text-xs font-medium tabular-nums', ok ? 'text-emerald-700' : 'text-amber-700')}>
          {len} de {min}–{max}
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
        <span
          className="absolute inset-y-0 bg-emerald-500/15"
          style={{ left: `${(min / scale) * 100}%`, width: `${((max - min) / scale) * 100}%` }}
          aria-hidden
        />
        <span
          className={cn('absolute inset-y-0 left-0 rounded-full', ok ? 'bg-emerald-500' : 'bg-amber-500')}
          style={{ width: `${Math.min(len / scale, 1) * 100}%` }}
        />
      </div>
      <p className={cn('mt-2 text-sm', value ? 'text-ink' : 'text-subtle')}>{value || 'Ainda não gerado'}</p>
    </div>
  )
}

function LinkRow({ link }: { link: LinkInterno }) {
  const status = link.status_validacao
  const state = status === undefined ? 'pending' : status === 200 ? 'ok' : 'bad'
  return (
    <li className="flex gap-2.5 py-2">
      {state === 'ok' && <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Link válido" />}
      {state === 'bad' && <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-label={`Link inválido (HTTP ${status})`} />}
      {state === 'pending' && <CircleDashed className="mt-0.5 size-4 shrink-0 text-subtle" aria-label="Ainda não validado" />}
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{link.ancora}</p>
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-xs text-muted hover:text-brand"
          title={link.url}
        >
          {link.url}
        </a>
        {state === 'bad' && <p className="text-xs text-red-700">Respondeu HTTP {status}</p>}
      </div>
    </li>
  )
}

function ReviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando artigo">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[560px] rounded-xl" />
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const params = useParams()
  const id = params.id as string
  const [article, setArticle] = useState<Article | null>(null)
  const [clientName, setClientName] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [md, setMd] = useState('')
  const [savedMd, setSavedMd] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [imageState, setImageState] = useState<'idle' | 'loading' | 'requested' | 'error'>('idle')
  const [imageError, setImageError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.articles
      .get(id)
      .then((a) => {
        setArticle(a)
        setMd(a.conteudo_md ?? '')
        setSavedMd(a.conteudo_md ?? '')
        api.clients
          .get(a.client_id)
          .then((c) => setClientName(c.nome))
          .catch(() => setClientName(null))
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Erro ao carregar o artigo'))
  }, [id])

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Revisão" back={{ href: '/articles', label: 'Artigos' }} />
        <Notice tone="danger" title="Não foi possível abrir o artigo">
          {loadError}
        </Notice>
      </div>
    )
  }

  if (!article) return <ReviewSkeleton />

  const seo = article.seo
  const links = seo?.links_internos ?? []
  const linksInvalid = links.some((l) => l.status_validacao !== 200 && l.status_validacao !== undefined)
  const linksOk = links.filter((l) => l.status_validacao === 200).length
  const words = md.trim() ? md.trim().split(/\s+/).length : 0
  const dirty = md !== savedMd
  const pesquisa = article.dossie?.pesquisa
  const canibalizacao = pesquisa?.canibalizacao.filter((c) => c.recomendacao !== 'seguir') ?? []

  async function saveDraft() {
    setSaving(true)
    setSaveError(null)
    try {
      await api.articles.update(id, { conteudo_md: md })
      setSavedMd(md)
      setSaveState('saved')
    } catch (e) {
      setSaveState('error')
      setSaveError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function regenerateImage() {
    setImageState('loading')
    setImageError(null)
    try {
      await api.articles.regenerateImage(id)
      setImageState('requested')
    } catch (e) {
      setImageState('error')
      setImageError(e instanceof Error ? e.message : 'Erro ao pedir nova imagem')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        back={{
          href: `/clients/${article.client_id}`,
          label: clientName ?? 'Cliente',
        }}
        title={article.briefing?.tema ?? 'Artigo sem tema'}
        meta={
          <>
            <ArticleStatusBadge status={article.status} />
            {article.briefing?.kw_principal && (
              <Badge tone="neutral" title="Palavra-chave principal">
                <Search className="size-3" aria-hidden />
                {article.briefing.kw_principal}
              </Badge>
            )}
            <span className="text-xs text-subtle" title={formatDateTime(article.updated_at)}>
              Atualizado {formatRelative(article.updated_at)}
            </span>
          </>
        }
        actions={
          article.wp_url ? (
            <a
              href={article.wp_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-strong"
            >
              Ver no site
              <ExternalLink className="size-4" aria-hidden />
            </a>
          ) : undefined
        }
      />

      <PipelineStepper status={article.status} />

      {article.status === 'gerando' && (
        <Notice tone="info" title="Os agentes ainda estão trabalhando neste artigo">
          Pesquisa, redação, edição, links, imagem e revisão rodam em sequência. Recarregue a página
          em alguns minutos para ver o resultado.
        </Notice>
      )}
      {article.status === 'erro' && (
        <Notice tone="danger" title="Este artigo parou com erro">
          {article.erro_msg ?? 'Veja o painel para mais detalhes.'}
        </Notice>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <CropMarks
            className="mt-8 lg:mx-0"
            label={`Prova${article.dossie?.rodada ? ` da rodada ${article.dossie.rodada}` : ''}`}
          >
          <Card className="p-0 transition-[border-color,box-shadow] focus-within:border-ink/40 focus-within:shadow-[0_0_0_3px_rgb(var(--cyan)/0.18)] sm:p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-muted" aria-hidden />
                Conteúdo
              </CardTitle>
              <span className="text-xs tabular-nums text-muted">
                {words.toLocaleString('pt-BR')} palavras
                {article.briefing?.extensao_alvo
                  ? ` de ${article.briefing.extensao_alvo.toLocaleString('pt-BR')} previstas`
                  : ''}
              </span>
            </div>
            <textarea
              aria-label="Conteúdo do artigo em Markdown"
              className="block h-[560px] w-full resize-y border-0 bg-transparent px-5 py-4 font-mono text-[13px] leading-relaxed text-ink outline-none focus-visible:outline-none"
              value={md}
              onChange={(e) => {
                setMd(e.target.value)
                setSaveState('idle')
              }}
              spellCheck
            />
            <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
              <Button
                variant={dirty ? 'default' : 'outline'}
                size="sm"
                loading={saving}
                loadingText="Salvando…"
                disabled={!dirty}
                onClick={saveDraft}
              >
                <Save aria-hidden />
                Salvar rascunho
              </Button>
              <span className="text-xs text-muted" aria-live="polite">
                {saveState === 'saved' && !dirty && 'Rascunho salvo.'}
                {dirty && saveState !== 'error' && 'Alterações não salvas.'}
              </span>
            </div>
            {saveState === 'error' && saveError && (
              <div className="px-5 pb-4">
                <Notice tone="danger" title="O rascunho não foi salvo">
                  {saveError}
                </Notice>
              </div>
            )}
          </Card>
          </CropMarks>

          <QaReportPanel qa={article.qa} dossie={article.dossie} />

          <PublishPanel
            articleId={id}
            clientId={article.client_id}
            linksInvalid={linksInvalid}
            initialWpPostType={article.wp_post_type}
            initialAgendadoPara={article.agendado_para}
            initialCategoriaIds={article.briefing?.categoria_ids}
          />
        </div>

        <aside className="min-w-0 space-y-6 lg:mt-8">
          <Card>
            <CardTitle className="flex items-center gap-2">
              <Search className="size-4 text-muted" aria-hidden />
              SEO
            </CardTitle>
            <div className="mt-5 space-y-5">
              <LengthMeter label="Title" value={seo?.titulo_seo} min={50} max={60} />
              <LengthMeter label="Meta description" value={seo?.meta_description} min={140} max={160} />
              <div>
                <p className="text-sm font-medium text-ink">Slug</p>
                <p className="mt-1 break-all rounded-md bg-canvas px-2 py-1 font-mono text-xs text-muted">
                  {seo?.slug ?? 'Ainda não gerado'}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Link2 className="size-4 text-muted" aria-hidden />
                Links internos
              </CardTitle>
              {links.length > 0 && (
                <Badge tone={linksInvalid ? 'danger' : 'success'}>
                  {linksOk} de {links.length} válidos
                </Badge>
              )}
            </div>
            {links.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhum link interno neste artigo.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {links.map((l) => (
                  <LinkRow key={l.url} link={l} />
                ))}
              </ul>
            )}
          </Card>

          {pesquisa && (
            <Card>
              <CardTitle>Diagnóstico do Pesquisador</CardTitle>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge tone="brand" title="Intenção de busca">
                  {humanize(pesquisa.intencao)}
                </Badge>
                <Badge>{FRESHNESS[pesquisa.freshness] ?? pesquisa.freshness}</Badge>
                {pesquisa.cluster && <Badge>Cluster: {pesquisa.cluster}</Badge>}
              </div>
              {canibalizacao.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-ink">Risco de canibalização</p>
                  {canibalizacao.map((c) => (
                    <div key={c.url} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                      <p className="font-medium text-amber-950">{c.titulo || c.url}</p>
                      <p className="mt-0.5 text-amber-800">
                        Risco {c.risco.replace(/_/g, ' ')}. Recomendação:{' '}
                        {c.recomendacao.replace(/_/g, ' ')}.
                      </p>
                      {c.motivo && <p className="mt-1 text-amber-900/80">{c.motivo}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {article.imagem_url && (
            <Card>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="size-4 text-muted" aria-hidden />
                Imagem destacada
              </CardTitle>
              <p className="mt-2 text-sm text-muted">
                {article.imagem_alt ? (
                  <>
                    <span className="font-medium text-ink">Texto alternativo:</span> {article.imagem_alt}
                  </>
                ) : (
                  'Sem texto alternativo.'
                )}
              </p>
              <Button
                className="mt-4"
                variant="outline"
                size="sm"
                loading={imageState === 'loading'}
                loadingText="Pedindo…"
                onClick={regenerateImage}
              >
                Gerar outra imagem
              </Button>
              {imageState === 'requested' && (
                <p className="mt-2 text-xs text-emerald-700" role="status">
                  Nova imagem pedida. Ela substitui a atual quando o agente terminar.
                </p>
              )}
              {imageState === 'error' && imageError && (
                <p className="mt-2 text-xs text-red-700" role="alert">
                  {imageError}
                </p>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  )
}
