// frontend/components/google-panel.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, FilePlus2, LineChart, RefreshCw, Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { ListSkeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import type { ClientGoogleView, GoogleConta, Oportunidade, SyncOportunidadesResult } from '@publisher-p12/types'

const ROTULO_CONTA: Record<GoogleConta, string> = { contato: 'Conta Contato', ryan: 'Conta Ryan' }
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })

interface GooglePanelProps {
  clientId: string
}

export function GooglePanel({ clientId }: GooglePanelProps) {
  const [view, setView] = useState<ClientGoogleView | null>(null)
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([])
  const [selecao, setSelecao] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [acao, setAcao] = useState<string | null>(null)
  const [resultado, setResultado] = useState<SyncOportunidadesResult | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    const [novaView, lista] = await Promise.all([api.google.get(clientId), api.oportunidades.list(clientId, 'nova')])
    setView(novaView)
    setOportunidades(lista)
    const { gsc_site_url, gsc_conta } = novaView.vinculo
    setSelecao(gsc_site_url && gsc_conta ? `${gsc_conta}|${gsc_site_url}` : '')
  }, [clientId])

  useEffect(() => {
    recarregar()
      .catch((e: Error) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [recarregar])

  async function salvarVinculo() {
    setErro(null)
    setSalvando(true)
    try {
      const [conta, ...resto] = selecao.split('|')
      const site = resto.join('|')
      await api.google.salvar(clientId, selecao ? { gsc_site_url: site, gsc_conta: conta as GoogleConta } : { gsc_site_url: null, gsc_conta: null })
      await recarregar()
      setAviso('Propriedade do Search Console vinculada.')
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function buscarOportunidades() {
    setErro(null)
    setAviso(null)
    setSincronizando(true)
    try {
      setResultado(await api.oportunidades.sync(clientId))
      setOportunidades(await api.oportunidades.list(clientId, 'nova'))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSincronizando(false)
    }
  }

  async function virarPauta(op: Oportunidade) {
    setAcao(op.id)
    try {
      await api.oportunidades.virarPauta(clientId, op.id)
      setOportunidades((lista) => lista.filter((o) => o.id !== op.id))
      setAviso(`"${op.query}" virou pauta — veja na aba Base e pautas.`)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setAcao(null)
    }
  }

  async function descartar(op: Oportunidade) {
    setAcao(op.id)
    try {
      await api.oportunidades.descartar(clientId, op.id)
      setOportunidades((lista) => lista.filter((o) => o.id !== op.id))
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setAcao(null)
    }
  }

  if (carregando) return <ListSkeleton rows={3} label="Carregando dados do Google" />

  const vinculado = Boolean(view?.vinculo.gsc_site_url)
  const selecaoAtual = view?.vinculo.gsc_site_url ? `${view.vinculo.gsc_conta}|${view.vinculo.gsc_site_url}` : ''

  return (
    <div className="space-y-6">
      {erro && <Notice tone="danger" title={erro} />}
      {aviso && <Notice tone="success" title={aviso} />}

      <Panel icon={<Search />} bodyClassName="p-5" title="Search Console" description="Escolha a propriedade deste cliente. As duas contas Google da agência são consultadas.">
        {view?.erros.map((e) => (
          <Notice key={e.conta} tone="warning" title={`${ROTULO_CONTA[e.conta]}: ${e.erro}`} className="mb-3" />
        ))}
        <label className="field-label" htmlFor="gsc-site">Propriedade</label>
        <div className="flex flex-wrap items-center gap-3">
          <select id="gsc-site" className="field-input max-w-xl" value={selecao} onChange={(e) => setSelecao(e.target.value)}>
            <option value="">Nenhuma</option>
            {view?.sites_disponiveis.map((s) => (
              <option key={`${s.conta}|${s.site_url}`} value={`${s.conta}|${s.site_url}`}>
                {s.site_url} — {ROTULO_CONTA[s.conta]}
              </option>
            ))}
          </select>
          <Button onClick={salvarVinculo} loading={salvando} loadingText="Salvando…" disabled={selecao === selecaoAtual}>
            Salvar
          </Button>
        </div>
        {view?.vinculo.updated_at && <p className="field-help">Atualizado em {formatDateTime(view.vinculo.updated_at)}</p>}
      </Panel>

      <Panel
        icon={<LineChart />}
        bodyClassName="p-5"
        title={
          <span className="flex items-center gap-2">
            Oportunidades (quick wins)
            {oportunidades.length > 0 && <Badge tone="brand" className="tabular-nums">{oportunidades.length}</Badge>}
          </span>
        }
        description="Buscas em que o site já aparece entre as posições 4 e 20 nos últimos 28 dias, com o volume mensal do Keyword Planner."
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button onClick={buscarOportunidades} loading={sincronizando} loadingText="Consultando o Google…" disabled={!vinculado}>
            <RefreshCw aria-hidden />
            Buscar oportunidades
          </Button>
          {resultado && (
            <span className="text-sm text-muted">
              {num(resultado.queries_analisadas)} buscas analisadas, {resultado.quick_wins} quick wins, {resultado.com_volume} com volume ·{' '}
              {resultado.janela.inicio} a {resultado.janela.fim}
            </span>
          )}
        </div>
        {resultado?.keyword_planner_erro && (
          <Notice tone="warning" title={`Sem volume do Keyword Planner: ${resultado.keyword_planner_erro}`} className="mb-4" />
        )}

        {oportunidades.length === 0 ? (
          <EmptyState
            compact
            icon={<LineChart />}
            title={vinculado ? 'Nenhuma oportunidade aberta' : 'Vincule o Search Console'}
            description={vinculado ? 'Clique em Buscar oportunidades para consultar os últimos 28 dias.' : 'Escolha a propriedade acima para começar.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Busca</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Posição</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Impressões</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Volume/mês</th>
                  <th className="py-2 pr-4 font-medium tabular-nums">Score</th>
                  <th className="py-2 font-medium"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {oportunidades.map((op) => (
                  <tr key={op.id}>
                    <td className="py-3 pr-4">
                      <div className="font-medium">{op.query}</div>
                      {op.page_url && (
                        <a href={op.page_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted hover:underline">
                          {op.page_url.replace(/^https?:\/\//, '')}
                          <ExternalLink aria-hidden className="h-3 w-3" />
                        </a>
                      )}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{num(op.posicao)}</td>
                    <td className="py-3 pr-4 tabular-nums">{num(op.impressoes)}</td>
                    <td className="py-3 pr-4 tabular-nums">{op.volume_mensal === null ? '—' : num(op.volume_mensal)}</td>
                    <td className="py-3 pr-4"><Badge tone="brand" className="tabular-nums">{op.score}</Badge></td>
                    <td className="py-3">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => virarPauta(op)} loading={acao === op.id} disabled={Boolean(acao)}>
                          <FilePlus2 aria-hidden />
                          Virar pauta
                        </Button>
                        <Button onClick={() => descartar(op)} disabled={Boolean(acao)} aria-label={`Descartar ${op.query}`}>
                          <X aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
