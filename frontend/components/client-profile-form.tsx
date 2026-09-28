'use client'

import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  CircleDot,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useId, useMemo, useState } from 'react'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FieldLabel } from '@/components/field-hint'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import {
  PERFIL_BLOCOS,
  PERFIL_CAMPOS,
  calcularCompletudeLocal,
  campoPreenchido,
  limparListasEstruturadas,
  listaParaTexto,
  paginaVazia,
  perfilVazio,
  profissionalVazio,
  servicoVazio,
  textoParaLista,
} from '@/lib/perfil-cliente'
import { cn } from '@/lib/utils'
import type {
  PaginaRef,
  PerfilBloco,
  PerfilCampoMeta,
  PerfilCampoTipo,
  PerfilCliente,
  ProfissionalResponsavel,
  ServicoMarca,
} from '@publisher-p12/types'

interface ClientProfileFormProps {
  clientId: string
  /** Avisa a página que o perfil mudou (ex.: para esconder o aviso de incompleto). */
  onSaved?: (perfil: PerfilCliente) => void
}

/** Tipos que ocupam a largura toda do bloco; os demais dividem a linha em duas colunas. */
const LARGURA_TOTAL: PerfilCampoTipo[] = ['texto_longo', 'lista_servico', 'lista_url', 'lista_pessoa']

const OBRIGATORIOS = PERFIL_CAMPOS.filter((c) => c.obrigatorio)

const campoDomId = (chave: string) => `perfil-campo-${chave}`
const blocoDomId = (bloco: string) => `perfil-bloco-${bloco}`

type EstadoBloco = 'pendente' | 'completo' | 'parcial' | 'vazio'

function estadoDoBloco(preenchidos: number, total: number, obrigatoriosFaltando: number): EstadoBloco {
  if (obrigatoriosFaltando > 0) return 'pendente'
  if (preenchidos === total) return 'completo'
  return preenchidos > 0 ? 'parcial' : 'vazio'
}

const ESTADO_BLOCO: Record<EstadoBloco, { icon: React.ReactNode; className: string; label: string }> = {
  pendente: { icon: <CircleAlert />, className: 'text-amber-600', label: 'Falta campo obrigatório' },
  completo: { icon: <CheckCircle2 />, className: 'text-emerald-600', label: 'Seção completa' },
  parcial: { icon: <CircleDot />, className: 'text-brand', label: 'Seção em andamento' },
  vazio: { icon: <CircleDashed />, className: 'text-subtle', label: 'Seção vazia' },
}

function EstadoBlocoIcon({ estado, className }: { estado: EstadoBloco; className?: string }) {
  const meta = ESTADO_BLOCO[estado]
  return (
    <span className={cn('inline-flex shrink-0 [&_svg]:size-full', meta.className, className)}>
      {meta.icon}
      <span className="sr-only">{meta.label}</span>
    </span>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando perfil do cliente">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Skeleton className="h-44 rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-20 rounded-xl" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[74px] rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function ClientProfileForm({ clientId, onSaved }: ClientProfileFormProps) {
  const [perfil, setPerfil] = useState<PerfilCliente>(perfilVazio)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  const [alterado, setAlterado] = useState(false)
  const [abertos, setAbertos] = useState<PerfilBloco[]>(['identidade'])
  // Seções abertas na carga aparecem sem animação; só o clique do usuário anima
  const [interagiu, setInteragiu] = useState(false)

  useEffect(() => {
    let ativo = true
    api.clients
      .perfil(clientId)
      .then((view) => {
        if (!ativo) return
        setPerfil(view.perfil)
        // Já abre as seções onde falta campo obrigatório
        const faltando = calcularCompletudeLocal(view.perfil).faltando_obrigatorios
        const pendentes = PERFIL_CAMPOS.filter((c) => faltando.includes(c.chave)).map((c) => c.bloco)
        if (pendentes.length > 0) {
          setAbertos((atual) => Array.from(new Set([...atual, ...pendentes])))
        }
      })
      .catch((e) => {
        if (ativo) setErroCarga(e instanceof Error ? e.message : 'Falha ao carregar o perfil')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [clientId])

  // Recalcula a cada tecla: a barra precisa reagir antes de salvar
  const completude = useMemo(() => calcularCompletudeLocal(perfil), [perfil])

  function set<K extends keyof PerfilCliente>(chave: K, valor: PerfilCliente[K]) {
    setPerfil((atual) => ({ ...atual, [chave]: valor }))
    setSalvoEm(null)
    setAlterado(true)
  }

  function alternarBloco(bloco: PerfilBloco) {
    setInteragiu(true)
    setAbertos((atual) =>
      atual.includes(bloco) ? atual.filter((b) => b !== bloco) : [...atual, bloco],
    )
  }

  function abrirBloco(bloco: PerfilBloco) {
    setInteragiu(true)
    setAbertos((atual) => (atual.includes(bloco) ? atual : [...atual, bloco]))
  }

  function irParaBloco(bloco: PerfilBloco) {
    abrirBloco(bloco)
    requestAnimationFrame(() => {
      document.getElementById(blocoDomId(bloco))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function irParaCampo(campo: PerfilCampoMeta) {
    abrirBloco(campo.bloco)
    requestAnimationFrame(() => {
      const el = document.getElementById(campoDomId(campo.chave))
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const alvo =
        el.querySelector<HTMLElement>('input, textarea, select') ??
        el.querySelector<HTMLElement>('[data-adicionar]')
      alvo?.focus({ preventScroll: true })
    })
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      const view = await api.clients.savePerfil(clientId, limparListasEstruturadas(perfil))
      setPerfil(view.perfil)
      setSalvoEm(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      setAlterado(false)
      onSaved?.(view.perfil)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar o perfil')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) return <ProfileSkeleton />

  const faltando = PERFIL_CAMPOS.filter((c) => completude.faltando_obrigatorios.includes(c.chave))
  const obrigatoriosOk = OBRIGATORIOS.length - faltando.length
  const completo = completude.percentual === 100
  const barra = faltando.length > 0 ? 'bg-amber-500' : completo ? 'bg-emerald-500' : 'bg-brand'

  const blocos = PERFIL_BLOCOS.map((meta) => {
    const contagem = completude.blocos.find((b) => b.bloco === meta.bloco)
    const preenchidos = contagem?.preenchidos ?? 0
    const total = contagem?.total ?? 0
    const pendentes = faltando.filter((c) => c.bloco === meta.bloco).length
    return { ...meta, preenchidos, total, pendentes, estado: estadoDoBloco(preenchidos, total, pendentes) }
  })

  return (
    <div className="space-y-6">
      <header className="max-w-2xl">
        <h2 className="text-lg font-semibold tracking-tight text-ink">Perfil do cliente</h2>
        <p className="mt-1 text-sm text-muted">
          É a fonte primária que os agentes usam sobre o negócio. O que estiver vazio não é
          inventado: o artigo trata o assunto de forma neutra ou marca como pendente.
        </p>
      </header>

      {erroCarga && (
        <Notice tone="danger" title="Não foi possível carregar o perfil salvo">
          <p>{erroCarga}</p>
          <p className="mt-1">
            Recarregue a página antes de editar, para não sobrescrever o que já existe.
          </p>
        </Notice>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-5 lg:sticky lg:top-6">
          <Card className="p-5 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-ink">Completude</p>
              <p className="text-2xl font-extrabold tabular-nums tracking-tight text-ink">
                {completude.percentual}%
              </p>
            </div>
            <div
              role="progressbar"
              aria-label="Completude do perfil"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completude.percentual}
              className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.07]"
            >
              <div
                className={cn('h-full rounded-full transition-[width,background-color] duration-300', barra)}
                style={{ width: `${completude.percentual}%` }}
              />
            </div>
            <p className="mt-2 text-xs tabular-nums text-muted">
              {completude.preenchidos} de {completude.total} campos preenchidos
            </p>

            <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-sm">
              {faltando.length > 0 ? (
                <>
                  <CircleAlert className="size-4 shrink-0 text-amber-600" aria-hidden />
                  <span className="text-ink">
                    <span className="font-semibold tabular-nums">
                      {obrigatoriosOk} de {OBRIGATORIOS.length}
                    </span>{' '}
                    obrigatórios
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span className="font-medium text-emerald-700">Obrigatórios completos</span>
                </>
              )}
            </div>
          </Card>

          <nav aria-label="Seções do perfil" className="hidden lg:block">
            <p className="px-2 text-xs font-medium text-subtle">Seções</p>
            <ul className="mt-1.5 space-y-0.5">
              {blocos.map((b) => (
                <li key={b.bloco}>
                  <button
                    type="button"
                    onClick={() => irParaBloco(b.bloco)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-muted transition-colors hover:bg-ink/[0.05] hover:text-ink"
                  >
                    <EstadoBlocoIcon estado={b.estado} className="size-3.5" />
                    <span className="min-w-0 flex-1 truncate">{b.titulo}</span>
                    <span className="text-xs tabular-nums text-subtle">
                      {b.preenchidos}/{b.total}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          {faltando.length > 0 ? (
            <Notice tone="warning" title="Os agentes ainda não escrevem para este cliente">
              <p>
                {faltando.length === 1
                  ? 'Falta 1 campo obrigatório. Clique para ir até ele:'
                  : `Faltam ${faltando.length} campos obrigatórios. Clique para ir até cada um:`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {faltando.map((campo) => (
                  <button
                    key={campo.chave}
                    type="button"
                    onClick={() => irParaCampo(campo)}
                    className="rounded-full border border-amber-300 bg-surface px-2.5 py-0.5 text-xs font-medium text-amber-900 transition-colors hover:border-amber-400 hover:bg-amber-100"
                  >
                    {campo.label}
                  </button>
                ))}
              </div>
            </Notice>
          ) : (
            <Notice tone="success" title="Pronto para gerar artigos">
              Quanto mais seções preenchidas, menos genérico fica o texto.
            </Notice>
          )}

          {blocos.map((b) => {
            const campos = PERFIL_CAMPOS.filter((c) => c.bloco === b.bloco)
            const aberto = abertos.includes(b.bloco)
            const painelId = `${blocoDomId(b.bloco)}-campos`

            return (
              <section
                key={b.bloco}
                id={blocoDomId(b.bloco)}
                className="scroll-mt-20 rounded-xl border border-line bg-surface lg:scroll-mt-6"
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => alternarBloco(b.bloco)}
                    aria-expanded={aberto}
                    aria-controls={painelId}
                    className={cn(
                      'flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors duration-150 hover:bg-canvas/60 sm:px-6',
                      aberto ? 'rounded-t-xl' : 'rounded-xl',
                    )}
                  >
                    <EstadoBlocoIcon estado={b.estado} className="size-5" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold tracking-tight text-ink">
                        {b.titulo}
                      </span>
                      <span className="block text-[13px] leading-snug text-muted">{b.descricao}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {b.pendentes > 0 && (
                        <Badge tone="warning" className="hidden sm:inline-flex">
                          {b.pendentes === 1 ? '1 obrigatório' : `${b.pendentes} obrigatórios`}
                        </Badge>
                      )}
                      <span className="text-xs tabular-nums text-muted">
                        {b.preenchidos}/{b.total}
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-4 text-subtle transition-transform duration-200',
                          aberto && 'rotate-180',
                        )}
                        aria-hidden
                      />
                    </span>
                  </button>
                </h3>

                {aberto && (
                  <div
                    id={painelId}
                    className={cn(
                      'grid gap-5 border-t border-line px-5 py-5 sm:grid-cols-2 sm:px-6',
                      interagiu && 'animate-fade-in',
                    )}
                  >
                    {campos.map((campo) => (
                      <div
                        key={campo.chave}
                        id={campoDomId(campo.chave)}
                        className={cn('min-w-0 scroll-mt-24', LARGURA_TOTAL.includes(campo.tipo) && 'sm:col-span-2')}
                      >
                        <CampoPerfil campo={campo} perfil={perfil} set={set} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}

          {erro && (
            <Notice tone="danger" title="O perfil não foi salvo" className="animate-fade-in">
              {erro}
            </Notice>
          )}

          <div className="sticky bottom-4 z-10 flex flex-col-reverse items-start gap-3 rounded-xl border border-line bg-surface/95 p-4 shadow-[0_10px_30px_-12px_rgb(14_27_61/0.28)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p className="text-sm" aria-live="polite">
              {salvoEm && !alterado ? (
                <span className="inline-flex animate-fade-in items-center gap-1.5 font-medium text-emerald-700">
                  <CheckCircle2 className="size-4" aria-hidden />
                  Perfil salvo às {salvoEm}.
                </span>
              ) : alterado ? (
                <span className="inline-flex items-center gap-2 font-medium text-amber-700">
                  <StatusDot tone="warning" />
                  Alterações não salvas.
                </span>
              ) : (
                <span className="text-muted">Os agentes usam a versão salva do perfil.</span>
              )}
            </p>
            <Button onClick={salvar} loading={salvando} loadingText="Salvando…" className="shrink-0">
              <Save aria-hidden />
              Salvar perfil
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Campo individual
// ---------------------------------------------------------------------------

interface CampoPerfilProps {
  campo: PerfilCampoMeta
  perfil: PerfilCliente
  set: <K extends keyof PerfilCliente>(chave: K, valor: PerfilCliente[K]) => void
}

/** Marca de obrigatório: âmbar enquanto vazio, neutra depois de preenchido. */
function MarcaObrigatorio({ preenchido }: { preenchido: boolean }) {
  return (
    <Badge tone={preenchido ? 'neutral' : 'warning'} className="px-2 text-[11px]">
      Obrigatório
    </Badge>
  )
}

function CampoPerfil({ campo, perfil, set }: CampoPerfilProps) {
  const badge = campo.obrigatorio ? (
    <MarcaObrigatorio preenchido={campoPreenchido(perfil, campo)} />
  ) : undefined

  if (campo.tipo === 'texto') {
    return (
      <FieldLabel label={campo.label} hint={campo.dica} badge={badge}>
        <input
          className="field-input"
          value={(perfil[campo.chave] as string) ?? ''}
          placeholder={campo.placeholder}
          onChange={(e) => set(campo.chave, e.target.value as never)}
        />
      </FieldLabel>
    )
  }

  if (campo.tipo === 'texto_longo') {
    return (
      <FieldLabel label={campo.label} hint={campo.dica} badge={badge}>
        <textarea
          className="field-input min-h-24"
          rows={3}
          value={(perfil[campo.chave] as string) ?? ''}
          placeholder={campo.placeholder}
          onChange={(e) => set(campo.chave, e.target.value as never)}
        />
      </FieldLabel>
    )
  }

  if (campo.tipo === 'lista') {
    return (
      <CampoLista
        campo={campo}
        badge={badge}
        valor={(perfil[campo.chave] as string[]) ?? []}
        onChange={(itens) => set(campo.chave, itens as never)}
      />
    )
  }

  if (campo.tipo === 'lista_servico') {
    const itens = (perfil[campo.chave] as ServicoMarca[]) ?? []
    return (
      <ListaEstruturada
        label={campo.label}
        dica={campo.dica}
        badge={badge}
        itens={itens}
        novoItem={servicoVazio}
        rotuloItem="serviço"
        rotuloAdicionar="Adicionar serviço"
        onChange={(novos) => set(campo.chave, novos as never)}
        renderItem={(item, atualizar) => (
          <>
            <input
              className="field-input"
              aria-label="Nome do serviço"
              value={item.nome}
              placeholder="Nome do serviço"
              onChange={(e) => atualizar({ ...item, nome: e.target.value })}
            />
            <input
              className="field-input"
              aria-label="URL da página do serviço"
              inputMode="url"
              value={item.url}
              placeholder="https://site.com.br/servico"
              onChange={(e) => atualizar({ ...item, url: e.target.value })}
            />
          </>
        )}
      />
    )
  }

  if (campo.tipo === 'lista_url') {
    const itens = (perfil[campo.chave] as PaginaRef[]) ?? []
    return (
      <ListaEstruturada
        label={campo.label}
        dica={campo.dica}
        badge={badge}
        itens={itens}
        novoItem={paginaVazia}
        rotuloItem="página"
        rotuloAdicionar="Adicionar página"
        onChange={(novos) => set(campo.chave, novos as never)}
        renderItem={(item, atualizar) => (
          <>
            <input
              className="field-input"
              aria-label="URL da página"
              inputMode="url"
              value={item.url}
              placeholder="https://site.com.br/pagina"
              onChange={(e) => atualizar({ ...item, url: e.target.value })}
            />
            <input
              className="field-input"
              aria-label="Título da página"
              value={item.titulo}
              placeholder="Título da página"
              onChange={(e) => atualizar({ ...item, titulo: e.target.value })}
            />
          </>
        )}
      />
    )
  }

  const pessoas = (perfil[campo.chave] as ProfissionalResponsavel[]) ?? []
  return (
    <ListaEstruturada
      label={campo.label}
      dica={campo.dica}
      badge={badge}
      itens={pessoas}
      novoItem={profissionalVazio}
      rotuloItem="profissional"
      rotuloAdicionar="Adicionar profissional"
      onChange={(novos) => set(campo.chave, novos as never)}
      renderItem={(item, atualizar) => (
        <>
          <input
            className="field-input"
            aria-label="Nome"
            value={item.nome}
            placeholder="Nome"
            onChange={(e) => atualizar({ ...item, nome: e.target.value })}
          />
          <input
            className="field-input"
            aria-label="Função"
            value={item.funcao}
            placeholder="Função"
            onChange={(e) => atualizar({ ...item, funcao: e.target.value })}
          />
          <input
            className="field-input"
            aria-label="Especialidade"
            value={item.especialidade}
            placeholder="Especialidade"
            onChange={(e) => atualizar({ ...item, especialidade: e.target.value })}
          />
          <input
            className="field-input"
            aria-label="Página de autor (opcional)"
            inputMode="url"
            value={item.url_autor ?? ''}
            placeholder="Página de autor (opcional)"
            onChange={(e) => atualizar({ ...item, url_autor: e.target.value })}
          />
        </>
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// Lista simples (um item por linha)
// ---------------------------------------------------------------------------

function mesmaLista(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Guarda o texto digitado como rascunho local: converter a cada tecla apagava o espaço
 * no fim da linha e a quebra de linha nova. O valor enviado continua sendo a lista limpa.
 */
function CampoLista({
  campo,
  badge,
  valor,
  onChange,
}: {
  campo: PerfilCampoMeta
  badge?: React.ReactNode
  valor: string[]
  onChange: (itens: string[]) => void
}) {
  const [texto, setTexto] = useState(() => listaParaTexto(valor))

  // Valor trocado de fora (carga ou resposta do salvar): o rascunho acompanha
  useEffect(() => {
    setTexto((atual) => (mesmaLista(textoParaLista(atual), valor) ? atual : listaParaTexto(valor)))
  }, [valor])

  return (
    <FieldLabel label={campo.label} hint={campo.dica} badge={badge} help="Um item por linha.">
      <textarea
        className="field-input min-h-24"
        rows={4}
        value={texto}
        placeholder="Um item por linha"
        onChange={(e) => {
          setTexto(e.target.value)
          onChange(textoParaLista(e.target.value))
        }}
      />
    </FieldLabel>
  )
}

// ---------------------------------------------------------------------------
// Lista de itens com mais de um campo
// ---------------------------------------------------------------------------

interface ListaEstruturadaProps<T> {
  label: string
  dica: string
  badge?: React.ReactNode
  itens: T[]
  novoItem: () => T
  /** Nome do item no singular, para o botão de remover. */
  rotuloItem: string
  rotuloAdicionar: string
  onChange: (itens: T[]) => void
  renderItem: (item: T, atualizar: (novo: T) => void) => React.ReactNode
}

function ListaEstruturada<T>({
  label,
  dica,
  badge,
  itens,
  novoItem,
  rotuloItem,
  rotuloAdicionar,
  onChange,
  renderItem,
}: ListaEstruturadaProps<T>) {
  const listaId = useId()

  return (
    <FieldLabel label={label} hint={dica} badge={badge}>
      <div className="space-y-2">
        {itens.length > 0 && (
          <ul id={listaId} className="space-y-2">
            {itens.map((item, indice) => (
              <li
                key={indice}
                className="flex items-start gap-2 rounded-lg border border-line bg-canvas/50 p-2"
              >
                <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                  {renderItem(item, (novo) => {
                    const copia = [...itens]
                    copia[indice] = novo
                    onChange(copia)
                  })}
                </div>
                <button
                  type="button"
                  className="grid size-9 shrink-0 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remover ${rotuloItem} ${indice + 1}`}
                  onClick={() => onChange(itens.filter((_, i) => i !== indice))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="outline"
          size="sm"
          data-adicionar
          aria-controls={itens.length > 0 ? listaId : undefined}
          onClick={() => onChange([...itens, novoItem()])}
        >
          <Plus aria-hidden />
          {rotuloAdicionar}
        </Button>
      </div>
    </FieldLabel>
  )
}
