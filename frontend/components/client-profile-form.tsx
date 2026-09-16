'use client'

import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { FieldLabel } from '@/components/field-hint'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import {
  PERFIL_BLOCOS,
  PERFIL_CAMPOS,
  calcularCompletudeLocal,
  limparListasEstruturadas,
  listaParaTexto,
  paginaVazia,
  perfilVazio,
  profissionalVazio,
  servicoVazio,
  textoParaLista,
} from '@/lib/perfil-cliente'
import type {
  PaginaRef,
  PerfilBloco,
  PerfilCampoMeta,
  PerfilCliente,
  ProfissionalResponsavel,
  ServicoMarca,
} from '@publisher-p12/types'

const inputClass =
  'mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200'

const linhaClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200'

interface ClientProfileFormProps {
  clientId: string
}

export function ClientProfileForm({ clientId }: ClientProfileFormProps) {
  const [perfil, setPerfil] = useState<PerfilCliente>(perfilVazio)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvoEm, setSalvoEm] = useState<string | null>(null)
  const [abertos, setAbertos] = useState<PerfilBloco[]>(['identidade'])

  useEffect(() => {
    let ativo = true
    api.clients
      .perfil(clientId)
      .then((view) => {
        if (ativo) setPerfil(view.perfil)
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar o perfil')
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
  }

  function alternarBloco(bloco: PerfilBloco) {
    setAbertos((atual) =>
      atual.includes(bloco) ? atual.filter((b) => b !== bloco) : [...atual, bloco],
    )
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    try {
      const view = await api.clients.savePerfil(clientId, limparListasEstruturadas(perfil))
      setPerfil(view.perfil)
      setSalvoEm(new Date().toLocaleTimeString('pt-BR'))
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar o perfil')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner size="sm" className="text-blue-700" />
          Carregando perfil do cliente...
        </div>
      </Card>
    )
  }

  const faltamObrigatorios = completude.faltando_obrigatorios.length > 0

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Perfil do cliente</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          É a fonte primária que os agentes usam sobre o negócio. O que estiver vazio não é
          inventado: o artigo trata o assunto de forma neutra ou marca como pendente.
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">
              {completude.preenchidos} de {completude.total} campos
            </span>
            <span className="tabular-nums text-slate-500">{completude.percentual}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-700 transition-all duration-300"
              style={{ width: `${completude.percentual}%` }}
            />
          </div>
        </div>

        {faltamObrigatorios ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <strong>O pipeline não roda ainda.</strong> Faltam campos obrigatórios:{' '}
            {PERFIL_CAMPOS.filter((c) => completude.faltando_obrigatorios.includes(c.chave))
              .map((c) => c.label)
              .join(', ')}
            .
          </p>
        ) : (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            <strong>Pronto para gerar artigos.</strong> Quanto mais blocos preenchidos, menos
            genérico fica o texto.
          </p>
        )}
      </Card>

      {PERFIL_BLOCOS.map(({ bloco, titulo, descricao }) => {
        const campos = PERFIL_CAMPOS.filter((c) => c.bloco === bloco)
        const aberto = abertos.includes(bloco)
        const contagem = completude.blocos.find((b) => b.bloco === bloco)

        return (
          <Card key={bloco} className="p-0">
            <button
              type="button"
              onClick={() => alternarBloco(bloco)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors duration-150 hover:bg-slate-50"
              aria-expanded={aberto}
            >
              <span>
                <span className="block text-base font-semibold text-slate-900">{titulo}</span>
                <span className="block text-sm text-slate-500">{descricao}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="tabular-nums text-xs text-slate-500">
                  {contagem?.preenchidos ?? 0}/{contagem?.total ?? 0}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                    aberto ? 'rotate-180' : ''
                  }`}
                />
              </span>
            </button>

            {aberto && (
              <div className="animate-slide-up space-y-5 border-t border-zinc-200 px-6 py-5">
                {campos.map((campo) => (
                  <CampoPerfil key={campo.chave} campo={campo} perfil={perfil} set={set} />
                ))}
              </div>
            )}
          </Card>
        )
      })}

      {erro && <p className="animate-fade-in text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-4">
        <Button onClick={salvar} loading={salvando} loadingText="Salvando...">
          Salvar perfil
        </Button>
        {salvoEm && !salvando && (
          <span className="animate-fade-in text-sm text-green-700">Salvo às {salvoEm}</span>
        )}
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

function CampoPerfil({ campo, perfil, set }: CampoPerfilProps) {
  const label = campo.obrigatorio ? `${campo.label} *` : campo.label

  if (campo.tipo === 'texto') {
    return (
      <FieldLabel label={label} hint={campo.dica}>
        <input
          className={inputClass}
          value={(perfil[campo.chave] as string) ?? ''}
          placeholder={campo.placeholder}
          onChange={(e) => set(campo.chave, e.target.value as never)}
        />
      </FieldLabel>
    )
  }

  if (campo.tipo === 'texto_longo') {
    return (
      <FieldLabel label={label} hint={campo.dica}>
        <textarea
          className={`${inputClass} min-h-20`}
          value={(perfil[campo.chave] as string) ?? ''}
          placeholder={campo.placeholder}
          onChange={(e) => set(campo.chave, e.target.value as never)}
        />
      </FieldLabel>
    )
  }

  if (campo.tipo === 'lista') {
    return (
      <FieldLabel label={label} hint={campo.dica}>
        <textarea
          className={`${inputClass} min-h-24`}
          value={listaParaTexto(perfil[campo.chave] as string[])}
          placeholder="Um item por linha"
          onChange={(e) => set(campo.chave, textoParaLista(e.target.value) as never)}
        />
        <span className="mt-1 block text-xs text-slate-500">Um item por linha.</span>
      </FieldLabel>
    )
  }

  if (campo.tipo === 'lista_servico') {
    const itens = (perfil[campo.chave] as ServicoMarca[]) ?? []
    return (
      <ListaEstruturada
        label={label}
        dica={campo.dica}
        itens={itens}
        novoItem={servicoVazio}
        onChange={(novos) => set(campo.chave, novos as never)}
        renderItem={(item, atualizar) => (
          <>
            <input
              className={linhaClass}
              value={item.nome}
              placeholder="Nome do serviço"
              onChange={(e) => atualizar({ ...item, nome: e.target.value })}
            />
            <input
              className={linhaClass}
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
        label={label}
        dica={campo.dica}
        itens={itens}
        novoItem={paginaVazia}
        onChange={(novos) => set(campo.chave, novos as never)}
        renderItem={(item, atualizar) => (
          <>
            <input
              className={linhaClass}
              value={item.url}
              placeholder="https://site.com.br/pagina"
              onChange={(e) => atualizar({ ...item, url: e.target.value })}
            />
            <input
              className={linhaClass}
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
      label={label}
      dica={campo.dica}
      itens={pessoas}
      novoItem={profissionalVazio}
      colunas="sm:grid-cols-2"
      onChange={(novos) => set(campo.chave, novos as never)}
      renderItem={(item, atualizar) => (
        <>
          <input
            className={linhaClass}
            value={item.nome}
            placeholder="Nome"
            onChange={(e) => atualizar({ ...item, nome: e.target.value })}
          />
          <input
            className={linhaClass}
            value={item.funcao}
            placeholder="Função"
            onChange={(e) => atualizar({ ...item, funcao: e.target.value })}
          />
          <input
            className={linhaClass}
            value={item.especialidade}
            placeholder="Especialidade"
            onChange={(e) => atualizar({ ...item, especialidade: e.target.value })}
          />
          <input
            className={linhaClass}
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
// Lista de itens com mais de um campo
// ---------------------------------------------------------------------------

interface ListaEstruturadaProps<T> {
  label: string
  dica: string
  itens: T[]
  novoItem: () => T
  onChange: (itens: T[]) => void
  renderItem: (item: T, atualizar: (novo: T) => void) => React.ReactNode
  colunas?: string
}

function ListaEstruturada<T>({
  label,
  dica,
  itens,
  novoItem,
  onChange,
  renderItem,
  colunas = 'sm:grid-cols-2',
}: ListaEstruturadaProps<T>) {
  return (
    <div className="block text-sm text-slate-700">
      <FieldLabel label={label} hint={dica}>
        <div className="mt-1.5 space-y-2">
          {itens.map((item, indice) => (
            <div key={indice} className="flex items-start gap-2">
              <div className={`grid flex-1 gap-2 ${colunas}`}>
                {renderItem(item, (novo) => {
                  const copia = [...itens]
                  copia[indice] = novo
                  onChange(copia)
                })}
              </div>
              <button
                type="button"
                className="mt-1 rounded-md p-2 text-slate-400 transition-colors duration-150 hover:bg-red-50 hover:text-red-600"
                aria-label="Remover item"
                onClick={() => onChange(itens.filter((_, i) => i !== indice))}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 transition-colors duration-150 hover:text-blue-800"
            onClick={() => onChange([...itens, novoItem()])}
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </button>
        </div>
      </FieldLabel>
    </div>
  )
}
