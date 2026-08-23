import type { Briefing, PerfilMarca } from '@publisher-p12/types'
import { chatCompletion } from './client.js'

export interface RedatorInput {
  briefing: Briefing
  perfilMarca: PerfilMarca
  urlsRelevantes: Array<{ url: string; titulo: string | null; resumo: string | null }>
  artigosIrmaos: string[]
  apiKey: string
  model?: string
}

const SYSTEM_PROMPT = `Você é redator técnico-consultivo para blogs B2B.
Regras: um H1 com KW principal; H2/H3 sem pular níveis; answer capsule 50-100 palavras;
FAQ com mínimo 5 perguntas; blocos de decisão quando comparativo; CTA com E-E-A-T.
PROIBIDO: inventar números/estatísticas; inserir qualquer URL ou link.`

export async function runRedator(input: RedatorInput): Promise<string> {
  const userContent = JSON.stringify({
    briefing: input.briefing,
    perfil_marca: input.perfilMarca,
    urls_relevantes: input.urlsRelevantes,
    artigos_irmaos: input.artigosIrmaos,
  })

  return chatCompletion({
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Gere o artigo em Markdown:\n${userContent}` },
    ],
    referer: 'https://publisher.p12.digital',
    title: 'Publisher P12 Redator',
  })
}
