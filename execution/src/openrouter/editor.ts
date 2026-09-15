import type { Briefing, GeoJson, PerfilMarca, SeoJson } from '@publisher-p12/types'
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
  perfilMarca: PerfilMarca
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

const SYSTEM_PROMPT = `Você é editor SEO/GEO sênior (padrão gerador-crítico).
Title 50-60 chars; meta 140-160 chars. Sem promessas de visibilidade em IA.

Links internos:
- Use SOMENTE URLs de links_candidatos ou client_urls. Nunca invente, altere ou encurte URL.
- Priorize links_candidatos: são artigos já publicados sobre temas próximos. Leia o trecho
  de cada um para entender o que ele cobre antes de decidir onde linkar.
- Insira de 3 a 6 links internos no corpo, em Markdown [âncora](url), dentro de uma frase
  que já trata do assunto do artigo linkado. Se preciso, reescreva levemente a frase.
- Âncora descritiva de 2 a 6 palavras, com o termo que o artigo linkado cobre.
  PROIBIDO: "clique aqui", "saiba mais", "neste artigo", URL nua como âncora.
- No máximo 1 link por URL. Nenhum link em títulos (#, ##, ###) nem no FAQ.
- Distribua os links ao longo do texto, não concentre na introdução ou conclusão.
- Liste cada link inserido em seo.links_internos com { url, ancora, posicao }.
- URLs que ainda não existem vão em links_internos_futuros, nunca no corpo.

Imagens:
- seo.imagem = imagem destacada { prompt, alt }.
- seo.imagens_corpo = exatamente 2 imagens de apoio { secao, prompt, alt } para as seções H2
  que mais ganham com apoio visual. secao = texto EXATO do H2. Nunca FAQ nem conclusão.
- prompt em inglês, descrevendo cena/objeto concreto (foto editorial ou ilustração),
  sem pedir texto, números, logotipos ou marcas dentro da imagem.
- alt em português, descrevendo o que a imagem mostra (não repita a KW de forma forçada).
- NÃO insira imagens no conteudo_md: o pipeline posiciona as imagens.

Retorne JSON com: conteudo_md, seo, geo, schema_jsonld.`

export async function runEditor(input: EditorInput): Promise<EditorOutput> {
  const userContent = JSON.stringify({
    conteudo_md: input.conteudoMd,
    briefing: input.briefing,
    perfil_marca: input.perfilMarca,
    links_candidatos: input.linksCandidatos ?? [],
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
