'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExternalLink,
  FilePlus2,
  History,
  KeyRound,
  Library,
  Lightbulb,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button, buttonClass } from '@/components/ui/button'
import { Panel } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { formatDateTime, formatRelative } from '@/lib/format'
import { getQueryData, setQueryData } from '@/lib/query'
import type {
  ArticleIdea,
  ClientPostSummary,
  CorpusStatus,
  Job,
} from '@publisher-p12/types'

const POLL_MS = 4000
/** Quantos artigos da base a lista mostra por vez. */
const LIMITE_LISTA = 30
const MAX_CATEGORIAS_VISIVEIS = 3

/** `jobs.payload.resultado` dos jobs de corpus e pautas. */
interface ResultadoJob {
  inseridos?: number
  atualizados?: number
  total_lidos?: number
  /** Sync dividida por orçamento de tempo: há um job de continuação na fila. */
  continua?: boolean
  continuacao_job_id?: string
  pautas_geradas?: number
  posts_considerados?: number
}

/** Qual painel mostra as mensagens de erro/aviso: o da base ou o das pautas. */
type Frente = 'base' | 'pautas'

function formatarNumero(valor: number): string {
  return valor.toLocaleString('pt-BR')
}

/** Caminho da URL para exibir (o domínio é sempre o do cliente). */
function caminho(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, '') || '/'
}

interface KnowledgeBasePanelProps {
  clientId: string
}

/** Última carga sem busca, guardada no cache para a aba reabrir na hora. */
interface BaseSnapshot {
  status: CorpusStatus
  posts: ClientPostSummary[]
  pautas: ArticleIdea[]
}

const chaveBase = (clientId: string) => `/clients/${clientId}/base`

/**
 * Base de conhecimento do cliente: ingestão dos artigos publicados no WordPress
 * e pautas sugeridas pela IA a partir desse corpus.
 */
export function KnowledgeBasePanel({ clientId }: KnowledgeBasePanelProps) {
  const router = useRouter()

  const [snapshot] = useState(() => getQueryData<BaseSnapshot>(chaveBase(clientId)))
  const [status, setStatus] = useState<CorpusStatus | null>(snapshot?.status ?? null)
  const [posts, setPosts] = useState<ClientPostSummary[]>(snapshot?.posts ?? [])
  const [pautas, setPautas] = useState<ArticleIdea[]>(snapshot?.pautas ?? [])
  const [busca, setBusca] = useState('')
  /** Termo que filtrou a lista atual (o campo pode ter texto ainda não buscado). */
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [quantidade, setQuantidade] = useState(5)
  const [foco, setFoco] = useState('')

  const [jobSync, setJobSync] = useState<string | null>(null)
  // Totais somados entre o job inicial e as continuações da mesma sincronização
  const acumuladoSync = useRef({ inseridos: 0, atualizados: 0, lidos: 0 })
  const [jobPautas, setJobPautas] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [frente, setFrente] = useState<Frente>('base')
  const [carregando, setCarregando] = useState(!snapshot)
  const [recarregando, setRecarregando] = useState(false)
  const [criandoArtigo, setCriandoArtigo] = useState<string | null>(null)

  const buscaRef = useRef(busca)
  buscaRef.current = busca

  const recarregar = useCallback(async () => {
    const termo = buscaRef.current
    const [novoStatus, novosPosts, novasPautas] = await Promise.all([
      api.corpus.status(clientId),
      api.corpus.list(clientId, { limit: LIMITE_LISTA, busca: termo || undefined }),
      api.pautas.list(clientId),
    ])
    setStatus(novoStatus)
    setPosts(novosPosts)
    setPautas(novasPautas)
    setBuscaAplicada(termo.trim())
    if (!termo.trim()) {
      setQueryData<BaseSnapshot>(chaveBase(clientId), { status: novoStatus, posts: novosPosts, pautas: novasPautas })
    }
    if (novoStatus.job_em_andamento) setJobSync(novoStatus.job_em_andamento)
    return novoStatus
  }, [clientId])

  useEffect(() => {
    recarregar()
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [recarregar])

  // Acompanha os jobs de corpus/pautas até terminarem
  useEffect(() => {
    const jobId = jobSync ?? jobPautas
    if (!jobId) return

    let ativo = true
    const timer = setInterval(async () => {
      let job: Job
      try {
        job = await api.jobs.get(jobId)
      } catch {
        return
      }
      if (!ativo) return
      if (job.status !== 'ok' && job.status !== 'erro') return

      clearInterval(timer)
      if (jobId === jobSync) setJobSync(null)
      if (jobId === jobPautas) setJobPautas(null)

      if (job.status === 'erro') {
        acumuladoSync.current = { inseridos: 0, atualizados: 0, lidos: 0 }
        setErro(job.erro ?? 'Job falhou')
      } else {
        setErro(null)
        const resultado = (job.payload as { resultado?: ResultadoJob } | null)?.resultado
        if (resultado && job.tipo === 'sincronizar_corpus') {
          // A sync grava em blocos de 5 e pode se dividir em vários jobs: soma tudo
          const acumulado = acumuladoSync.current
          acumulado.inseridos += Number(resultado.inseridos ?? 0)
          acumulado.atualizados += Number(resultado.atualizados ?? 0)
          acumulado.lidos += Number(resultado.total_lidos ?? 0)

          if (resultado.continua && resultado.continuacao_job_id) {
            // Ainda não acabou: segue o job de continuação em vez de anunciar conclusão
            setAviso(
              `Ainda sincronizando: ${formatarNumero(acumulado.lidos)} artigos lidos até agora. Blogs grandes são lidos em partes.`,
            )
            setJobSync(resultado.continuacao_job_id)
            await recarregar().catch(() => undefined)
            return
          }

          setAviso(
            `Base sincronizada: ${formatarNumero(acumulado.inseridos)} artigos novos e ${formatarNumero(acumulado.atualizados)} atualizados.`,
          )
          acumuladoSync.current = { inseridos: 0, atualizados: 0, lidos: 0 }
        } else if (resultado) {
          setAviso(
            `${resultado.pautas_geradas ?? 0} pautas geradas a partir de ${resultado.posts_considerados ?? 0} artigos.`,
          )
        }
      }
      await recarregar().catch(() => undefined)
    }, POLL_MS)

    return () => {
      ativo = false
      clearInterval(timer)
    }
  }, [jobSync, jobPautas, recarregar])

  const ocupado = Boolean(jobSync || jobPautas)

  async function sincronizar(completo: boolean) {
    setFrente('base')
    setErro(null)
    setAviso(null)
    acumuladoSync.current = { inseridos: 0, atualizados: 0, lidos: 0 }
    try {
      const res = await api.corpus.sync(clientId, { completo, tipos: ['post'] })
      setJobSync(res.job_id)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function gerarPautas() {
    setFrente('pautas')
    setErro(null)
    setAviso(null)
    try {
      const res = await api.pautas.gerar(clientId, {
        quantidade,
        foco: foco.trim() || undefined,
      })
      setJobPautas(res.job_id)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function descartar(ideaId: string) {
    setPautas((atual) => atual.filter((p) => p.id !== ideaId))
    setQueryData<BaseSnapshot>(chaveBase(clientId), (s) =>
      s ? { ...s, pautas: s.pautas.filter((p) => p.id !== ideaId) } : s,
    )
    try {
      await api.pautas.setStatus(clientId, ideaId, 'descartada')
    } catch (e) {
      setFrente('pautas')
      setErro((e as Error).message)
      await recarregar().catch(() => undefined)
    }
  }

  async function virarArtigo(ideaId: string) {
    setFrente('pautas')
    setCriandoArtigo(ideaId)
    setErro(null)
    try {
      const article = await api.pautas.criarArtigo(clientId, ideaId)
      router.push(`/articles/${article.id}/review`)
    } catch (e) {
      setErro((e as Error).message)
      setCriandoArtigo(null)
    }
  }

  /** Mesma recarga que o Enter na busca sempre fez; falha na busca não vira erro na tela. */
  async function aplicarBusca() {
    setRecarregando(true)
    try {
      await recarregar()
    } catch {
      // Mantém a lista anterior
    } finally {
      setRecarregando(false)
    }
  }

  function limparBusca() {
    setBusca('')
    buscaRef.current = ''
    void aplicarBusca()
  }

  async function tentarDeNovo() {
    setErro(null)
    setRecarregando(true)
    try {
      await recarregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setRecarregando(false)
    }
  }

  if (carregando) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Carregando base de conhecimento">
        <Skeleton className="h-56 w-full rounded-xl" />
        <ListSkeleton rows={3} label="Carregando pautas" />
      </div>
    )
  }

  const total = status?.total ?? 0
  const pautasNovas = pautas.filter((p) => p.status === 'nova')
  const pautasUsadas = pautas.filter((p) => p.status === 'usada' && p.article_id)

  function mensagens(alvo: Frente) {
    if (frente !== alvo || (!erro && !aviso)) return null
    return (
      <div className="space-y-2 border-b border-line px-5 py-4">
        {erro && (
          <Notice
            tone="danger"
            className="animate-fade-in"
            action={
              !status ? (
                <Button variant="outline" size="sm" loading={recarregando} onClick={tentarDeNovo}>
                  Tentar de novo
                </Button>
              ) : undefined
            }
          >
            {erro}
          </Notice>
        )}
        {aviso && (
          <Notice tone={jobSync ? 'info' : 'success'} className="animate-fade-in">
            {aviso}
          </Notice>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Base: o que o cliente já publicou */}
      <Panel
        icon={<Library />}
        title={
          <span className="flex items-center gap-2">
            Artigos já publicados
            {jobSync ? (
              <Badge tone="brand" dot pulse>
                Sincronizando
              </Badge>
            ) : total === 0 ? (
              <Badge>Vazia</Badge>
            ) : null}
          </span>
        }
        description="Tudo o que o cliente já publicou no WordPress. É daqui que os agentes tiram pautas novas, sem repetir assunto, e os links internos de cada uma."
      >
        <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-3">
          <div className="bg-surface px-5 py-4">
            <dt className="text-[13px] text-muted">Artigos na base</dt>
            <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-ink">
              {formatarNumero(total)}
            </dd>
          </div>
          <div className="bg-surface px-5 py-4">
            <dt className="text-[13px] text-muted">Palavras lidas</dt>
            <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-ink">
              {formatarNumero(status?.palavras_total ?? 0)}
            </dd>
          </div>
          <div className="col-span-2 bg-surface px-5 py-4 sm:col-span-1">
            <dt className="text-[13px] text-muted">Última sincronização</dt>
            <dd className="mt-1 text-2xl font-bold tracking-tight text-ink">
              {status?.ultimo_sync ? (
                <time dateTime={status.ultimo_sync} title={formatDateTime(status.ultimo_sync)}>
                  {formatRelative(status.ultimo_sync)}
                </time>
              ) : (
                <span className="text-subtle">Nunca</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-snug text-muted">
            <span className="font-medium text-ink">Sincronizar</span> traz os posts novos ou
            editados desde a última leitura.{' '}
            <span className="font-medium text-ink">Reler tudo</span> lê o blog inteiro de novo.
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" disabled={ocupado} onClick={() => sincronizar(true)}>
              <RotateCcw aria-hidden />
              Reler tudo
            </Button>
            <Button
              loading={Boolean(jobSync)}
              loadingText="Sincronizando…"
              disabled={ocupado}
              onClick={() => sincronizar(false)}
            >
              <RefreshCw aria-hidden />
              Sincronizar
            </Button>
          </div>
        </div>

        {mensagens('base')}

        {total > 0 && (
          <div className="flex gap-2 border-b border-line px-5 py-3">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Buscar artigo por título</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
                aria-hidden
              />
              <input
                type="search"
                className="field-input pl-9"
                value={busca}
                placeholder="Buscar por título"
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void aplicarBusca()
                }}
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              className="h-auto"
              loading={recarregando}
              onClick={() => void aplicarBusca()}
            >
              Buscar
            </Button>
          </div>
        )}

        {posts.length > 0 ? (
          <>
            <ul className="divide-y divide-line">
              {posts.map((post) => {
                const extras = post.categorias.length - MAX_CATEGORIAS_VISIVEIS
                return (
                  <li key={post.id} className="flex items-start gap-4 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-ink transition-colors hover:text-brand"
                      >
                        <span className="min-w-0 truncate">{post.titulo}</span>
                        <ExternalLink
                          className="size-3.5 shrink-0 text-subtle transition-colors group-hover:text-brand"
                          aria-hidden
                        />
                        <span className="sr-only">(abre em nova aba)</span>
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {post.categorias.length > 0 ? (
                          <>
                            {post.categorias.slice(0, MAX_CATEGORIAS_VISIVEIS).map((cat) => (
                              <Badge key={cat.id} className="px-2">
                                {cat.name}
                              </Badge>
                            ))}
                            {extras > 0 && (
                              <span
                                className="text-xs text-subtle"
                                title={post.categorias
                                  .slice(MAX_CATEGORIAS_VISIVEIS)
                                  .map((cat) => cat.name)
                                  .join(', ')}
                              >
                                +{extras}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-subtle">Sem categoria</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <span className="block tabular-nums text-muted">
                        {formatarNumero(post.palavras)} palavras
                      </span>
                      {post.publicado_em && (
                        <time
                          dateTime={post.publicado_em}
                          title={formatDateTime(post.publicado_em)}
                          className="mt-0.5 block text-subtle"
                        >
                          {formatRelative(post.publicado_em)}
                        </time>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {(buscaAplicada || total > posts.length) && (
              <p className="border-t border-line px-5 py-3 text-[13px] text-muted">
                {buscaAplicada ? (
                  <>
                    {posts.length >= LIMITE_LISTA
                      ? `Mostrando os ${LIMITE_LISTA} primeiros resultados para “${buscaAplicada}”.`
                      : `${posts.length} ${posts.length === 1 ? 'resultado' : 'resultados'} para “${buscaAplicada}”.`}{' '}
                    <button type="button" className="text-link" onClick={limparBusca}>
                      Limpar busca
                    </button>
                  </>
                ) : (
                  <>
                    Mostrando os {posts.length} mais recentes de{' '}
                    <span className="tabular-nums">{formatarNumero(total)}</span>. Busque pelo
                    título para achar os outros.
                  </>
                )}
              </p>
            )}
          </>
        ) : total === 0 ? (
          <EmptyState
            compact
            icon={<Library />}
            title="A base ainda está vazia"
            description="Sincronize para ler os posts publicados no WordPress do cliente. Em blogs grandes, a leitura acontece em partes e pode levar alguns minutos."
            action={
              <Button
                size="sm"
                loading={Boolean(jobSync)}
                loadingText="Sincronizando…"
                disabled={ocupado}
                onClick={() => sincronizar(false)}
              >
                <RefreshCw aria-hidden />
                Sincronizar agora
              </Button>
            }
          />
        ) : (
          <EmptyState
            compact
            icon={<Search />}
            title="Nenhum artigo com esse título"
            description="Tente outra palavra ou limpe a busca para ver os mais recentes."
            action={
              buscaAplicada ? (
                <Button variant="outline" size="sm" onClick={limparBusca}>
                  <X aria-hidden />
                  Limpar busca
                </Button>
              ) : undefined
            }
          />
        )}
      </Panel>

      {/* Pautas: ideias novas a partir da base */}
      <Panel
        icon={<Lightbulb />}
        title={
          <span className="flex items-center gap-2">
            Pautas sugeridas
            {pautasNovas.length > 0 && (
              <Badge tone="brand" className="tabular-nums">
                {pautasNovas.length}
              </Badge>
            )}
          </span>
        }
        description="Ideias de artigo que os agentes encontram nas lacunas do blog, sem repetir o que já foi publicado. Ao criar o artigo, o briefing já vem preenchido."
      >
        <div className="border-b border-line bg-canvas/40 px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-end">
            <label className="block">
              <span className="field-label">Quantas</span>
              <input
                type="number"
                min={1}
                max={15}
                value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                className="field-input tabular-nums"
              />
            </label>
            <label className="block">
              <span className="field-label">
                Foco <span className="font-normal text-subtle">(opcional)</span>
              </span>
              <input
                type="text"
                value={foco}
                placeholder="Ex.: SD-WAN, fundo de funil"
                onChange={(e) => setFoco(e.target.value)}
                className="field-input"
              />
            </label>
            <Button
              loading={Boolean(jobPautas)}
              loadingText="Analisando o blog…"
              disabled={ocupado || total === 0}
              onClick={gerarPautas}
            >
              <Sparkles aria-hidden />
              Sugerir pautas
            </Button>
          </div>
          <p className="field-help">
            {total === 0
              ? 'Sincronize os artigos publicados primeiro: as pautas partem do que o blog já tem.'
              : 'De 1 a 15 pautas por vez. O foco pode ser um tema, uma categoria ou uma etapa do funil.'}
          </p>
        </div>

        {jobPautas && (
          <div
            className="flex animate-fade-in items-center gap-2.5 border-b border-line px-5 py-3 text-sm text-muted"
            role="status"
          >
            <Spinner size="sm" className="text-brand" />
            Os agentes estão lendo o blog e procurando assuntos que ainda não foram cobertos.
          </div>
        )}

        {mensagens('pautas')}

        {pautasNovas.length > 0 ? (
          <ul className="divide-y divide-line">
            {pautasNovas.map((idea) => (
              <PautaItem
                key={idea.id}
                idea={idea}
                criando={criandoArtigo === idea.id}
                bloqueado={Boolean(criandoArtigo)}
                onCriar={() => virarArtigo(idea.id)}
                onDescartar={() => descartar(idea.id)}
              />
            ))}
          </ul>
        ) : jobPautas ? null : (
          <EmptyState
            compact
            icon={<Lightbulb />}
            title={total === 0 ? 'Sem pautas por enquanto' : 'Nenhuma pauta esperando'}
            description={
              total === 0
                ? 'Sincronize os artigos publicados acima. Depois, peça sugestões: os agentes procuram assuntos que o blog ainda não cobre.'
                : 'Peça novas sugestões acima. Um foco, como um tema ou uma etapa do funil, deixa as pautas mais certeiras.'
            }
          />
        )}
      </Panel>

      {pautasUsadas.length > 0 && (
        <details className="group rounded-xl border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 text-sm [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2.5 font-medium text-ink">
              <History className="size-4 text-muted" aria-hidden />
              Pautas que já viraram artigo
              <Badge className="tabular-nums">{pautasUsadas.length}</Badge>
            </span>
            <span className="text-muted group-open:hidden">Mostrar</span>
            <span className="hidden text-muted group-open:inline">Ocultar</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {pautasUsadas.map((idea) => (
              <li key={idea.id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 truncate text-sm text-ink" title={idea.tema}>
                  {idea.tema}
                </span>
                <Link
                  href={`/articles/${idea.article_id}/review`}
                  className={buttonClass('ghost', 'shrink-0 text-brand hover:text-brand-strong', 'sm')}
                >
                  Abrir artigo
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function PautaItem({
  idea,
  criando,
  bloqueado,
  onCriar,
  onDescartar,
}: {
  idea: ArticleIdea
  criando: boolean
  bloqueado: boolean
  onCriar: () => void
  onDescartar: () => void
}) {
  const { pauta } = idea
  return (
    <li className="px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug text-ink">{idea.tema}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {idea.kw_principal && (
              <Badge tone="brand" title="Palavra-chave principal" className="max-w-full">
                <KeyRound className="size-3 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{idea.kw_principal}</span>
              </Badge>
            )}
            {pauta.etapa_funil && (
              <Badge title="Etapa do funil">
                {pauta.etapa_funil}
              </Badge>
            )}
            {idea.cluster && (
              <Badge title="Assunto do blog em que a pauta se encaixa" className="max-w-full">
                <span className="min-w-0 truncate">{idea.cluster}</span>
              </Badge>
            )}
            <time
              dateTime={idea.created_at}
              title={formatDateTime(idea.created_at)}
              className="text-xs text-subtle"
            >
              Sugerida {formatRelative(idea.created_at)}
            </time>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" loading={criando} loadingText="Criando…" disabled={bloqueado} onClick={onCriar}>
            <FilePlus2 aria-hidden />
            Criar artigo
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={bloqueado}
            onClick={onDescartar}
            aria-label={`Descartar a pauta ${idea.tema}`}
          >
            <X aria-hidden />
            Descartar
          </Button>
        </div>
      </div>

      {pauta.justificativa && (
        <p className="mt-2.5 text-sm leading-relaxed text-muted">{pauta.justificativa}</p>
      )}

      {pauta.artigos_relacionados.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">Links internos sugeridos</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {pauta.artigos_relacionados.map((url) => (
              <li key={url} className="min-w-0 max-w-full">
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  title={url}
                  className="inline-flex max-w-full items-center gap-1 rounded-md border border-line bg-canvas/60 px-2 py-0.5 text-xs text-muted transition-colors hover:border-brand/30 hover:text-brand sm:max-w-[20rem]"
                >
                  <span className="min-w-0 truncate">{caminho(url)}</span>
                  <ExternalLink className="size-3 shrink-0" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pauta.risco_canibalizacao && (
        <Notice tone="warning" title="Pode competir com um artigo que já existe" className="mt-3">
          {pauta.risco_canibalizacao}
        </Notice>
      )}
    </li>
  )
}
