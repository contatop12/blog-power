import type { Briefing, PesquisaDossie, QaReport } from '@publisher-p12/types'
import { renderPesquisaParaPrompt } from '../skill/dossie.js'
import { renderPerfilParaPrompt } from '../skill/perfil.js'
import { renderCorrecoesParaPrompt } from '../skill/qa.js'
import { buildSystemPrompt } from '../skill/skill.js'
import { chatCompletion } from './client.js'

export interface RedatorInput {
  briefing: Briefing
  /** PerfilCliente cru; a renderização acontece aqui dentro. */
  perfil: unknown
  /** Diagnóstico do Pesquisador. Null quando o job de pesquisa falhou ou foi pulado. */
  pesquisa?: PesquisaDossie | null
  /** Relatório do Revisor da rodada anterior. Presente só na rodada 2. */
  qaAnterior?: QaReport | null
  /** Markdown reprovado, para o Redator corrigir em vez de recomeçar do zero. */
  conteudoAnterior?: string | null
  urlsRelevantes: Array<{ url: string; titulo: string | null; resumo: string | null }>
  artigosIrmaos: string[]
  apiKey: string
  model?: string
}

const FORMATO = `Devolva SOMENTE o Markdown do artigo, sem cercas de código, sem comentário e
sem preâmbulo. Não inclua nenhuma URL nem link: o Editor cuida disso na etapa seguinte.`

export async function runRedator(input: RedatorInput): Promise<string> {
  const correcoes = input.qaAnterior ? renderCorrecoesParaPrompt(input.qaAnterior) : ''

  const partes = [
    renderPesquisaParaPrompt(input.pesquisa ?? null),
    `# BRIEFING\n${JSON.stringify(input.briefing)}`,
    input.artigosIrmaos.length > 0
      ? `# TEMAS VIZINHOS JÁ PUBLICADOS (contexto de cluster, não linkar)\n- ${input.artigosIrmaos.join('\n- ')}`
      : '',
    input.urlsRelevantes.length > 0
      ? `# PÁGINAS DO CLIENTE (contexto; o Editor escolhe os links)\n${JSON.stringify(input.urlsRelevantes)}`
      : '',
    correcoes,
    correcoes && input.conteudoAnterior
      ? `# VERSÃO REPROVADA (corrija esta versão, não recomece)\n\n${input.conteudoAnterior}`
      : '',
  ].filter(Boolean)

  const instrucao = correcoes
    ? 'Reescreva o artigo aplicando as correções da revisão:'
    : 'Escreva o artigo em Markdown:'

  return chatCompletion({
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      {
        role: 'system',
        content: `${buildSystemPrompt('redator', renderPerfilParaPrompt(input.perfil))}\n\n---\n\n${FORMATO}`,
      },
      { role: 'user', content: `${instrucao}\n\n${partes.join('\n\n---\n\n')}` },
    ],
    referer: 'https://publisher.p12.digital',
    title: 'Publisher P12 Redator',
  })
}
