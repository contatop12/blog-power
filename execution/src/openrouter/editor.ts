import type { Briefing, GeoJson, PesquisaDossie, SeoJson } from '@publisher-p12/types'
import { renderPesquisaParaPrompt } from '../skill/dossie.js'
import { renderPerfilParaPrompt } from '../skill/perfil.js'
import { buildSystemPrompt } from '../skill/skill.js'
import { chatJson } from './client.js'

/** Artigo já publicado, próximo do tema, com o trecho que justifica o link. */
export interface LinkCandidato {
  url: string
  titulo: string
  /** Parágrafos do artigo relacionado que tratam dos mesmos termos. */
  trecho: string
}

export interface EditorInput {
  conteudoMd: string
  briefing: Briefing
  /** PerfilCliente cru; a renderização acontece aqui dentro. */
  perfil: unknown
  /** Diagnóstico do Pesquisador (cluster, entidades, freshness). */
  pesquisa?: PesquisaDossie | null
  clientUrls: Array<{ url: string; titulo: string | null }>
  /** Artigos relacionados do corpus, ranqueados (links contextuais prioritários). */
  linksCandidatos?: LinkCandidato[]
  seoPlugin: 'yoast' | 'rankmath' | 'nenhum'
  apiKey: string
  model?: string
}

export interface EditorOutput {
  conteudo_md: string
  seo: SeoJson
  geo: GeoJson
  schema_jsonld: Record<string, unknown>
}

const FORMATO = `Retorne JSON com exatamente estas chaves:
{
  "conteudo_md": "artigo revisado, já com os links internos inseridos",
  "seo": {
    "titulo_seo": "", "meta_description": "", "slug": "", "kw_principal": "",
    "kws_secundarias": [], "intencao": "", "etapa_funil": "",
    "links_internos": [{ "url": "", "ancora": "", "posicao": "" }],
    "links_internos_futuros": [],
    "link_externo": { "url": "", "fonte": "", "justificativa": "" },
    "links_externos": [{ "url": "", "fonte": "", "justificativa": "" }],
    "schema_recomendado": [], "og": { "title": "", "description": "" },
    "imagem": { "prompt": "", "alt": "" },
    "imagens_corpo": [{ "secao": "", "prompt": "", "alt": "" }],
    "canonical": "", "categoria_sugerida": "", "tags_sugeridas": [], "breadcrumb": "",
    "freshness": "evergreen|semi_evergreen|alta_volatilidade"
  },
  "geo": { "estrategia": "", "blocos_autocontidos": [], "canibalizacao": [], "oportunidades": [] },
  "schema_jsonld": {}
}

geo.oportunidades = de 3 a 10 conteúdos que fortalecem o cluster (Skill §62.11).`

export async function runEditor(input: EditorInput): Promise<EditorOutput> {
  const contexto = [
    renderPesquisaParaPrompt(input.pesquisa ?? null),
    `# BRIEFING\n${JSON.stringify(input.briefing)}`,
    `# PLUGIN SEO DO SITE: ${input.seoPlugin}`,
    `# LINKS CANDIDATOS (artigos publicados, com o trecho que justifica o link)\n${JSON.stringify(input.linksCandidatos ?? [])}`,
    `# INVENTÁRIO DE URLs DO CLIENTE (única origem permitida de link interno)\n${JSON.stringify(input.clientUrls)}`,
    `# ARTIGO A EDITAR\n\n${input.conteudoMd}`,
  ]
    .filter(Boolean)
    .join('\n\n---\n\n')

  return chatJson<EditorOutput>({
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      {
        role: 'system',
        content: `${buildSystemPrompt('editor', renderPerfilParaPrompt(input.perfil))}\n\n---\n\n${FORMATO}`,
      },
      { role: 'user', content: contexto },
    ],
    referer: 'https://publisher.p12.digital',
    title: 'Publisher P12 Editor',
  })
}
