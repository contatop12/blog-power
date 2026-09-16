import type { Briefing, PesquisaDossie } from '@publisher-p12/types'
import { normalizePesquisa } from '../skill/dossie.js'
import { buildSystemPrompt } from '../skill/skill.js'
import { renderPerfilParaPrompt } from '../skill/perfil.js'
import { chatJson } from './client.js'

/** Artigo publicado pelo cliente, compactado para a checagem de canibalização. */
export interface InventarioItem {
  titulo: string
  url: string
  categorias: string
  excerpt: string
  publicado_em: string
}

export interface PesquisadorInput {
  briefing: Briefing
  /** PerfilCliente cru; a renderização acontece aqui dentro. */
  perfil: unknown
  /** Inventário do corpus do cliente, já recortado por relevância. */
  inventario: InventarioItem[]
  apiKey: string
  model?: string
}

/** Teto do inventário no prompt: o Pesquisador precisa de cobertura, não do texto inteiro. */
export const MAX_INVENTARIO_PESQUISA = 120

const FORMATO = `Retorne JSON com exatamente estas chaves:
{
  "intencao": "informacional|comercial|transacional|navegacional|local|comparativa|investigativa|problema_solucao",
  "estagio_consciencia": "desconhece_problema|reconhece_problema|procura_solucoes|compara_alternativas|escolhe_fornecedor|pronto_para_contratar",
  "entidades": ["..."],
  "kws_relacionadas": ["..."],
  "perguntas": ["..."],
  "cluster": "...",
  "pagina_pilar": "url do inventário ou vazio",
  "canibalizacao": [{ "url": "...", "titulo": "...", "risco": "alto|medio|baixo", "recomendacao": "atualizar|consolidar|redirecionar|mudar_intencao|mudar_palavra_chave|cluster_complementar|seguir", "motivo": "..." }],
  "blocos_citaveis": ["..."],
  "freshness": "evergreen|semi_evergreen|alta_volatilidade",
  "justificativa": "por que este artigo merece existir em vez de atualizar um já publicado",
  "pendencias": ["informação que faltou no perfil e não pode ser inventada"]
}

Em canibalizacao, use apenas URLs presentes no inventário recebido. Nunca invente URL.`

export interface PesquisadorOutput {
  pesquisa: PesquisaDossie
  pendencias: string[]
}

export async function runPesquisador(input: PesquisadorInput): Promise<PesquisadorOutput> {
  const inventario = input.inventario.slice(0, MAX_INVENTARIO_PESQUISA)

  const userContent = JSON.stringify({
    briefing: input.briefing,
    inventario_publicado: inventario,
  })

  const output = await chatJson<Record<string, unknown>>({
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      {
        role: 'system',
        content: `${buildSystemPrompt('pesquisador', renderPerfilParaPrompt(input.perfil))}\n\n---\n\n${FORMATO}`,
      },
      { role: 'user', content: `Faça o diagnóstico desta pauta:\n${userContent}` },
    ],
    referer: 'https://publisher.p12.digital',
    title: 'Publisher P12 Pesquisador',
  })

  const pesquisa = normalizePesquisa(output)
  if (!pesquisa) throw new Error('Pesquisador devolveu resposta vazia ou inválida')

  const pendencias = Array.isArray(output.pendencias)
    ? output.pendencias.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : []

  return { pesquisa, pendencias }
}
