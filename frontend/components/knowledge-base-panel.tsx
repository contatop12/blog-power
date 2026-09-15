'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import type {
  ArticleIdea,
  ClientPostSummary,
  CorpusStatus,
  Job,
} from '@publisher-p12/types'

const POLL_MS = 4000

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatarNumero(valor: number): string {
  return valor.toLocaleString('pt-BR')
}

interface KnowledgeBasePanelProps {
  clientId: string
}

/**
 * Base de conhecimento do cliente: ingestão dos artigos publicados no WordPress
 * e pautas sugeridas pela IA a partir desse corpus.
 */
export function KnowledgeBasePanel({ clientId }: KnowledgeBasePanelProps) {
  const router = useRouter()

  const [status, setStatus] = useState<CorpusStatus | null>(null)
  const [posts, setPosts] = useState<ClientPostSummary[]>([])
  const [pautas, setPautas] = useState<ArticleIdea[]>([])
  const [busca, setBusca] = useState('')
  const [quantidade, setQuantidade] = useState(5)
  const [foco, setFoco] = useState('')

  const [jobSync, setJobSync] = useState<string | null>(null)
  const [jobPautas, setJobPautas] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [criandoArtigo, setCriandoArtigo] = useState<string | null>(null)

  const buscaRef = useRef(busca)
  buscaRef.current = busca

  const recarregar = useCallback(async () => {
    const [novoStatus, novosPosts, novasPautas] = await Promise.all([
      api.corpus.status(clientId),
      api.corpus.list(clientId, { limit: 30, busca: buscaRef.current || undefined }),
      api.pautas.list(clientId),
    ])
    setStatus(novoStatus)
    setPosts(novosPosts)
    setPautas(novasPautas)
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
        setErro(job.erro ?? 'Job falhou')
      } else {
        setErro(null)
        const resultado = (job.payload as { resultado?: Record<string, number> } | null)?.resultado
        if (resultado) {
          setAviso(
            job.tipo === 'sincronizar_corpus'
              ? `Sincronizado: ${resultado.inseridos ?? 0} novos, ${resultado.atualizados ?? 0} atualizados.`
              : `${resultado.pautas_geradas ?? 0} pautas geradas a partir de ${resultado.posts_considerados ?? 0} artigos.`,
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
    setErro(null)
    setAviso(null)
    try {
      const res = await api.corpus.sync(clientId, { completo, tipos: ['post'] })
      setJobSync(res.job_id)
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  async function gerarPautas() {
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
    try {
      await api.pautas.setStatus(clientId, ideaId, 'descartada')
    } catch (e) {
      setErro((e as Error).message)
      await recarregar().catch(() => undefined)
    }
  }

  async function virarArtigo(ideaId: string) {
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

  if (carregando) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-zinc-600">
          <Spinner size="sm" /> Carregando base de conhecimento...
        </div>
      </Card>
    )
  }

  const pautasNovas = pautas.filter((p) => p.status === 'nova')

  return (
    <div className="space-y-6">
      {erro && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {aviso}
        </p>
      )}

      <Card>
        <CardTitle>Artigos publicados (base da IA)</CardTitle>
        <p className="mt-1 text-sm text-zinc-600">
          Lê todos os posts publicados no WordPress do cliente. É esse inventário que a IA usa
          para propor pautas novas e, depois, para escolher links internos.
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Artigos</dt>
            <dd className="text-xl font-semibold text-slate-900">
              {formatarNumero(status?.total ?? 0)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Palavras</dt>
            <dd className="text-xl font-semibold text-slate-900">
              {formatarNumero(status?.palavras_total ?? 0)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">Última sincronização</dt>
            <dd className="text-sm text-slate-800">{formatarData(status?.ultimo_sync ?? null)}</dd>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            loading={Boolean(jobSync)}
            loadingText="Sincronizando..."
            disabled={ocupado}
            onClick={() => sincronizar(false)}
          >
            Sincronizar artigos
          </Button>
          <Button variant="outline" disabled={ocupado} onClick={() => sincronizar(true)}>
            Recarregar tudo
          </Button>
          <input
            type="search"
            value={busca}
            placeholder="Buscar por título..."
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') recarregar().catch(() => undefined)
            }}
            className="h-10 flex-1 rounded-md border border-zinc-300 px-3 text-sm"
          />
        </div>

        {posts.length > 0 ? (
          <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100">
            {posts.map((post) => (
              <li key={post.id} className="flex items-baseline justify-between gap-4 py-2">
                <a
                  href={post.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm text-blue-700 hover:underline"
                >
                  {post.titulo}
                </a>
                <span className="shrink-0 text-xs text-zinc-500">
                  {post.categorias.map((cat) => cat.name).join(', ') || 'sem categoria'} ·{' '}
                  {formatarNumero(post.palavras)} palavras
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            Nenhum artigo na base ainda. Clique em “Sincronizar artigos”.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Pautas sugeridas pela IA</CardTitle>
        <p className="mt-1 text-sm text-zinc-600">
          A IA lê todos os títulos e temas já publicados, identifica lacunas e propõe pautas
          novas — cada uma já ligada aos artigos existentes que devem virar links internos.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm text-zinc-700">
            Quantidade
            <input
              type="number"
              min={1}
              max={15}
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              className="ml-2 h-10 w-20 rounded-md border border-zinc-300 px-3 text-sm"
            />
          </label>
          <input
            type="text"
            value={foco}
            placeholder="Foco opcional (ex: SD-WAN, fundo de funil)"
            onChange={(e) => setFoco(e.target.value)}
            className="h-10 flex-1 rounded-md border border-zinc-300 px-3 text-sm"
          />
          <Button
            loading={Boolean(jobPautas)}
            loadingText="Analisando blog..."
            disabled={ocupado || (status?.total ?? 0) === 0}
            onClick={gerarPautas}
          >
            Sugerir pautas
          </Button>
        </div>

        {pautasNovas.length > 0 ? (
          <ul className="mt-5 space-y-4">
            {pautasNovas.map((idea) => (
              <li key={idea.id} className="rounded-lg border border-zinc-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-slate-900">{idea.tema}</h3>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {idea.kw_principal} · {idea.pauta.etapa_funil} ·{' '}
                      {idea.cluster || 'sem cluster'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      loading={criandoArtigo === idea.id}
                      loadingText="Criando..."
                      disabled={Boolean(criandoArtigo)}
                      onClick={() => virarArtigo(idea.id)}
                    >
                      Criar artigo
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={Boolean(criandoArtigo)}
                      onClick={() => descartar(idea.id)}
                    >
                      Descartar
                    </Button>
                  </div>
                </div>

                {idea.pauta.justificativa && (
                  <p className="mt-2 text-sm text-zinc-700">{idea.pauta.justificativa}</p>
                )}

                {idea.pauta.artigos_relacionados.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Links internos sugeridos:{' '}
                    {idea.pauta.artigos_relacionados.map((url, i) => (
                      <span key={url}>
                        {i > 0 && ', '}
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 hover:underline"
                        >
                          {url.replace(/^https?:\/\/[^/]+/, '')}
                        </a>
                      </span>
                    ))}
                  </p>
                )}

                {idea.pauta.risco_canibalizacao && (
                  <p className="mt-2 text-xs text-amber-700">
                    Risco de canibalização: {idea.pauta.risco_canibalizacao}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            {(status?.total ?? 0) === 0
              ? 'Sincronize os artigos publicados para liberar a sugestão de pautas.'
              : 'Nenhuma pauta pendente. Clique em “Sugerir pautas”.'}
          </p>
        )}
      </Card>
    </div>
  )
}
