import type { Briefing, GeoJson, PerfilMarca, SeoJson } from '@publisher-p12/types'
import { chatJson } from './client.js'

export interface EditorInput {
  conteudoMd: string
  briefing: Briefing
  perfilMarca: PerfilMarca
  clientUrls: Array<{ url: string; titulo: string | null }>
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

const SYSTEM_PROMPT = `Você é editor SEO/GEO sênior (padrão gerador-crítico).
Links internos SOMENTE das URLs fornecidas no inventário.
URLs não publicadas vão em links_internos_futuros.
Title 50-60 chars; meta 140-160 chars. Sem promessas de visibilidade em IA.
Retorne JSON com: conteudo_md, seo, geo, schema_jsonld.`

export async function runEditor(input: EditorInput): Promise<EditorOutput> {
  const userContent = JSON.stringify({
    conteudo_md: input.conteudoMd,
    briefing: input.briefing,
    perfil_marca: input.perfilMarca,
    client_urls: input.clientUrls,
    seo_plugin: input.seoPlugin,
  })

  return chatJson<EditorOutput>({
    apiKey: input.apiKey,
    model: input.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    referer: 'https://publisher.p12.digital',
    title: 'Publisher P12 Editor',
  })
}
