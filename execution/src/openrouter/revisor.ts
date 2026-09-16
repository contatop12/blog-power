import type { Briefing, PesquisaDossie, QaReport, SeoJson } from '@publisher-p12/types'
import { renderPesquisaParaPrompt } from '../skill/dossie.js'
import { renderPerfilParaPrompt } from '../skill/perfil.js'
import { buildSystemPrompt } from '../skill/skill.js'
import { normalizeQa } from '../skill/qa.js'
import { chatJson } from './client.js'

export interface RevisorInput {
  conteudoMd: string
  briefing: Briefing
  /** PerfilCliente cru. */
  perfil: unknown
  seo: SeoJson | null
  pesquisa: PesquisaDossie | null
  /** 1 na primeira passada, 2 na revisão pós-correção. */
  rodada: number
  apiKey: string
  model?: string
}

const FORMATO = `Retorne JSON com exatamente estas chaves:
{
  "score": {
    "intencao_busca": 0-10, "profundidade": 0-10, "originalidade": 0-10, "seo": 0-10,
    "geo_aeo": 0-10, "eeat": 0-10, "ux": 0-10, "conversao": 0-10, "atualidade": 0-10,
    "qualidade_fontes": 0-10, "naturalidade": 0-10
  },
  "correcoes": [{ "categoria": "nome da categoria do score", "problema": "...", "correcao": "...", "trecho": "..." }],
  "fatos_sem_fonte": ["afirmação tratada como fato sem sustentação"],
  "diferenciacao_ia": "resposta à pergunta §50"
}

Pontue todas as 11 categorias. Categoria omitida é tratada como 0.
Produza uma correção para cada categoria abaixo de 8. Não produza correção para categoria aprovada.
Você NÃO reescreve o artigo: devolva apenas o diagnóstico.`

export async function runRevisor(input: RevisorInput): Promise<QaReport> {
  const contexto = [
    renderPesquisaParaPrompt(input.pesquisa),
    `# BRIEFING\n${JSON.stringify(input.briefing)}`,
    input.seo ? `# CAMADA SEO ENTREGUE PELO EDITOR\n${JSON.stringify(input.seo)}` : '',
    `# ARTIGO A AUDITAR\n\n${input.conteudoMd}`,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')

  const output = await chatJson<Record<string, unknown>>({
    apiKey: input.apiKey,
    model: input.model,
    // Auditoria pede consistência, não criatividade
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: `${buildSystemPrompt('revisor', renderPerfilParaPrompt(input.perfil))}\n\n---\n\n${FORMATO}`,
      },
      { role: 'user', content: contexto },
    ],
    referer: 'https://publisher.p12.digital',
    title: 'Publisher P12 Revisor',
  })

  // O veredito é recalculado a partir do score: o modelo não decide se passa
  return normalizeQa(output, input.rodada)
}
