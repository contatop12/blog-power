import type { Briefing } from '@publisher-p12/types'

/** Post do corpus/inventário candidato a receber link interno. */
export interface LinkCandidateSource {
  titulo: string
  url: string
  categorias: string[]
  tags: string[]
  excerpt: string
}

export interface RankedPost<T extends LinkCandidateSource> {
  post: T
  score: number
  /** Termos do briefing que casaram (já normalizados) — usados no extractTrecho. */
  termos: string[]
}

export interface RankOptions {
  limit?: number
  /** URLs que nunca podem aparecer (ex.: o próprio artigo). */
  excludeUrls?: string[]
  /** URLs indicadas pela pauta/briefing — entram mesmo com pouco casamento lexical. */
  boostUrls?: string[]
  minScore?: number
}

export interface BriefingTerms {
  pesos: Map<string, number>
  /** KW principal e secundárias normalizadas, para bônus de frase exata. */
  frasePrincipal: string
  frasesSecundarias: string[]
}

const STOPWORDS = new Set([
  'para', 'com', 'sem', 'por', 'pelo', 'pela', 'pelos', 'pelas', 'dos', 'das', 'nos', 'nas',
  'uma', 'umas', 'uns', 'que', 'qual', 'quais', 'como', 'mais', 'menos', 'muito', 'sua',
  'seu', 'suas', 'seus', 'ele', 'ela', 'eles', 'elas', 'isso', 'esse', 'essa', 'este',
  'esta', 'aos', 'entre', 'sobre', 'quando', 'onde', 'porque', 'pois', 'tambem', 'ser',
  'ter', 'sao', 'foi', 'vai', 'voce', 'voces', 'nao', 'sim', 'ate', 'apos', 'desde', 'cada',
  'todo', 'toda', 'todos', 'todas', 'outro', 'outra', 'guia', 'dicas', 'dica', 'saiba',
  'entenda', 'veja', 'descubra', 'completo', 'completa', 'melhor', 'melhores', 'the', 'and',
])

const PESO_KW_PRINCIPAL = 3
const PESO_KW_SECUNDARIA = 2
const PESO_TEMA = 1.5
const PESO_ANGULO = 1
const BONUS_FRASE_PRINCIPAL = 5
const BONUS_FRASE_SECUNDARIA = 3
const BONUS_PAUTA = 6

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Stemming leve pt-BR: só plurais regulares, para casar "links" com "link". */
function stem(token: string): string {
  if (token.length <= 4) return token
  if (token.endsWith('oes') || token.endsWith('aes')) return `${token.slice(0, -3)}ao`
  if (token.endsWith('ais')) return `${token.slice(0, -3)}al`
  if (token.endsWith('eis')) return `${token.slice(0, -3)}el`
  if (token.endsWith('s')) return token.slice(0, -1)
  return token
}

export function tokenize(text: string): string[] {
  if (!text) return []
  return normalizeText(text)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .map(stem)
}

/** Chave de comparação de URL: host sem www + caminho sem barra final. */
export function normalizeUrlKey(url: string): string {
  const raw = url.trim()
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const path = parsed.pathname.replace(/\/+$/, '')
    return `${host}${path}`
  } catch {
    return raw.toLowerCase().replace(/\/+$/, '')
  }
}

function setPeso(pesos: Map<string, number>, texto: string, peso: number): void {
  for (const token of tokenize(texto)) {
    pesos.set(token, Math.max(pesos.get(token) ?? 0, peso))
  }
}

export function briefingTerms(briefing: Briefing): BriefingTerms {
  const pesos = new Map<string, number>()
  setPeso(pesos, briefing.angulo ?? '', PESO_ANGULO)
  setPeso(pesos, briefing.tema ?? '', PESO_TEMA)
  for (const kw of briefing.kws_secundarias ?? []) setPeso(pesos, kw, PESO_KW_SECUNDARIA)
  setPeso(pesos, briefing.kw_principal ?? '', PESO_KW_PRINCIPAL)

  return {
    pesos,
    frasePrincipal: tokenize(briefing.kw_principal ?? '').join(' '),
    frasesSecundarias: (briefing.kws_secundarias ?? [])
      .map((kw) => tokenize(kw).join(' '))
      .filter((f) => f.includes(' ')),
  }
}

function contemFrase(tokens: string[], frase: string): boolean {
  if (!frase) return false
  return ` ${tokens.join(' ')} `.includes(` ${frase} `)
}

function scorePost(post: LinkCandidateSource, terms: BriefingTerms): { score: number; termos: string[] } {
  const tituloTokens = tokenize(post.titulo)
  const titulo = new Set(tituloTokens)
  const taxonomias = new Set(tokenize([...post.categorias, ...post.tags].join(' ')))
  const excerpt = new Set(tokenize(post.excerpt))

  let score = 0
  const termos: string[] = []

  for (const [termo, peso] of terms.pesos) {
    if (titulo.has(termo)) {
      score += peso * 3
      termos.push(termo)
    } else if (taxonomias.has(termo)) {
      score += peso * 2
      termos.push(termo)
    } else if (excerpt.has(termo)) {
      score += peso
      termos.push(termo)
    }
  }

  if (contemFrase(tituloTokens, terms.frasePrincipal)) score += BONUS_FRASE_PRINCIPAL
  for (const frase of terms.frasesSecundarias) {
    if (contemFrase(tituloTokens, frase)) score += BONUS_FRASE_SECUNDARIA
  }

  return { score, termos }
}

/**
 * Lê todos os títulos/taxonomias/resumos do corpus e devolve os mais próximos do
 * briefing. Determinístico e sem custo de LLM — o conteúdo completo só é lido
 * depois, para os escolhidos.
 */
export function rankRelatedPosts<T extends LinkCandidateSource>(
  briefing: Briefing,
  posts: T[],
  options: RankOptions = {},
): Array<RankedPost<T>> {
  const limit = options.limit ?? 8
  const minScore = options.minScore ?? 2
  const excluidas = new Set((options.excludeUrls ?? []).filter(Boolean).map(normalizeUrlKey))
  const promovidas = new Set(
    (options.boostUrls ?? []).filter((u) => /^https?:\/\//i.test(u)).map(normalizeUrlKey),
  )
  const terms = briefingTerms(briefing)
  const vistos = new Set<string>()

  const ranked: Array<RankedPost<T>> = []
  for (const post of posts) {
    const key = normalizeUrlKey(post.url)
    if (excluidas.has(key) || vistos.has(key)) continue
    vistos.add(key)

    const { score, termos } = scorePost(post, terms)
    const total = score + (promovidas.has(key) ? BONUS_PAUTA : 0)
    if (total >= minScore) ranked.push({ post, score: total, termos })
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit)
}

function cortarNaPalavra(texto: string, max: number): string {
  if (texto.length <= max) return texto
  const cortado = texto.slice(0, max)
  const ultimoEspaco = cortado.lastIndexOf(' ')
  return (ultimoEspaco > max * 0.6 ? cortado.slice(0, ultimoEspaco) : cortado).trim()
}

/** Parágrafos do artigo relacionado que mais falam dos termos, na ordem original. */
export function extractTrecho(conteudo: string, termos: string[], maxChars = 600): string {
  const paragrafos = (conteudo ?? '')
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean)
  if (paragrafos.length === 0) return ''

  const alvo = new Set(termos)
  const pontuados = paragrafos.map((texto, indice) => {
    const tokens = new Set(tokenize(texto))
    let hits = 0
    for (const termo of alvo) if (tokens.has(termo)) hits += 1
    return { texto, indice, hits }
  })

  const relevantes = pontuados
    .filter((p) => p.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.indice - b.indice)

  const fonte = relevantes.length > 0 ? relevantes : pontuados
  const escolhidos: typeof pontuados = []
  let usados = 0

  for (const p of fonte) {
    const custo = p.texto.length + (escolhidos.length > 0 ? 1 : 0)
    if (usados + custo > maxChars) {
      if (escolhidos.length === 0) return cortarNaPalavra(p.texto, maxChars)
      if (relevantes.length === 0) break
      continue
    }
    escolhidos.push(p)
    usados += custo
  }

  return escolhidos
    .sort((a, b) => a.indice - b.indice)
    .map((p) => p.texto)
    .join('\n')
}
