/**
 * Quick wins: buscas em que o site já aparece entre as posições 4 e 20.
 * Funções puras — nada de rede ou banco aqui.
 */
import type { GscRow } from '../google/searchConsole.js'
import { normalizeKeyword, type KeywordVolume } from '../google/keywordPlanner.js'

export interface QueryAgg {
  query: string
  queryNorm: string
  page: string | null
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export function aggregateByQuery(rows: GscRow[]): QueryAgg[] {
  const grupos = new Map<
    string,
    { clicks: number; impressions: number; posPeso: number; porPagina: Map<string, number>; porTexto: Map<string, number> }
  >()

  for (const row of rows) {
    const [query = '', page = ''] = row.keys
    const norm = normalizeKeyword(query)
    if (!norm) continue
    const g = grupos.get(norm) ?? { clicks: 0, impressions: 0, posPeso: 0, porPagina: new Map(), porTexto: new Map() }
    g.clicks += row.clicks
    g.impressions += row.impressions
    g.posPeso += row.position * row.impressions
    if (page) g.porPagina.set(page, (g.porPagina.get(page) ?? 0) + row.impressions)
    g.porTexto.set(query.trim(), (g.porTexto.get(query.trim()) ?? 0) + row.impressions)
    grupos.set(norm, g)
  }

  const maior = (m: Map<string, number>): string | null =>
    [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return [...grupos.entries()].map(([norm, g]) => ({
    query: maior(g.porTexto) ?? norm,
    queryNorm: norm,
    page: maior(g.porPagina),
    clicks: g.clicks,
    impressions: g.impressions,
    ctr: g.impressions ? g.clicks / g.impressions : 0,
    position: g.impressions ? g.posPeso / g.impressions : 0,
  }))
}

const compacto = (s: string) => normalizeKeyword(s).replace(/[^a-z0-9]/g, '')

/** Sufixos que não identificam a marca (com.br, adv.br, net, ...). */
const SUFIXOS = new Set(['br', 'com', 'net', 'org', 'adv', 'gov', 'edu', 'ind', 'eng', 'med', 'odo', 'arq', 'app', 'io', 'co', 'dev', 'site', 'online', 'info', 'biz', 'us', 'pt', 'ai'])

/** Rótulo registrável do domínio: audicao.vitaaudio.com.br → vitaaudio (subdomínio não é marca). */
function rotuloDaMarca(dominio: string): string {
  try {
    const host = new URL(dominio.startsWith('http') ? dominio : `https://${dominio}`).hostname
    const labels = host.split('.')
    while (labels.length > 1 && SUFIXOS.has(labels[labels.length - 1] ?? '')) labels.pop()
    return labels[labels.length - 1] ?? ''
  } catch {
    return ''
  }
}

/** Termos de marca: nome do cliente compactado + rótulo registrável do domínio. */
export function marcaTermos(nome: string, dominio: string): string[] {
  const termos = [compacto(nome), compacto(rotuloDaMarca(dominio))]
  return [...new Set(termos.filter((t) => t.length >= 4))]
}

export function isMarca(query: string, termos: string[]): boolean {
  const q = compacto(query)
  return termos.some((t) => q.includes(t))
}

export interface QuickWinOptions {
  posMin?: number
  posMax?: number
  minImpressoes?: number
  limite?: number
  marca?: string[]
}

export function selectQuickWins(aggs: QueryAgg[], opts: QuickWinOptions = {}): QueryAgg[] {
  const { posMin = 4, posMax = 20, minImpressoes = 20, limite = 100, marca = [] } = opts
  return aggs
    .filter((a) => a.position >= posMin && a.position <= posMax)
    .filter((a) => a.impressions >= minImpressoes)
    .filter((a) => !isMarca(a.query, marca))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limite)
}

/** CTR que a página teria na posição 3 — referência do "ganho possível". */
const CTR_ALVO = 0.1
const log = (x: number, base: number) => Math.log10(x + 1) / Math.log10(base + 1)
const clamp = (x: number) => Math.max(0, Math.min(1, x))

/**
 * Score 0–100 = 40% demanda + 35% ganho de cliques + 25% proximidade do top 3.
 * Demanda: volume mensal do Keyword Planner ou, sem ele, as impressões dos 28 dias.
 * Heurística documentada em directives/oportunidades_google.md; pesos configuráveis ficam para depois.
 */
export function scoreQuickWin(agg: QueryAgg, volumeMensal: number | null): number {
  const demanda = volumeMensal ?? agg.impressions
  const demandaScore = clamp(log(demanda, 10_000))
  const cliquesExtras = Math.max(0, demanda * (CTR_ALVO - agg.ctr))
  const ganhoScore = clamp(log(cliquesExtras, 1_000))
  const proximidade = clamp((20 - agg.position) / 16)
  return Math.round(100 * (0.4 * demandaScore + 0.35 * ganhoScore + 0.25 * proximidade))
}

export interface OportunidadeCalculada {
  query: string
  query_norm: string
  page_url: string | null
  posicao: number
  impressoes: number
  cliques: number
  ctr: number
  volume_mensal: number | null
  concorrencia: string | null
  score: number
}

export function buildOportunidades(
  candidatos: QueryAgg[],
  volumes: Map<string, KeywordVolume>,
): OportunidadeCalculada[] {
  return candidatos
    .map((a) => {
      const v = volumes.get(a.queryNorm) ?? null
      return {
        query: a.query,
        query_norm: a.queryNorm,
        page_url: a.page,
        posicao: Math.round(a.position * 10) / 10,
        impressoes: a.impressions,
        cliques: a.clicks,
        ctr: a.ctr,
        volume_mensal: v?.volumeMensal ?? null,
        concorrencia: v?.concorrencia ?? null,
        score: scoreQuickWin(a, v?.volumeMensal ?? null),
      }
    })
    .sort((x, y) => y.score - x.score || y.impressoes - x.impressoes)
}
