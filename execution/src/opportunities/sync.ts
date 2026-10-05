/** Search Console → quick wins → Keyword Planner. Dependências injetadas para testar sem rede. */
import { gscWindow, type GscQuery, type GscRow } from '../google/searchConsole.js'
import type { KeywordVolume } from '../google/keywordPlanner.js'
import { aggregateByQuery, buildOportunidades, selectQuickWins, type OportunidadeCalculada } from './quickWins.js'

export interface SyncDeps {
  queryGsc: (siteUrl: string, q: GscQuery) => Promise<GscRow[]>
  /** null = Keyword Planner não configurado. */
  getVolumes: ((keywords: string[]) => Promise<Map<string, KeywordVolume>>) | null
  today?: Date
}

export interface QuickWinsCalculados {
  janela: { inicio: string; fim: string }
  oportunidades: OportunidadeCalculada[]
  queriesAnalisadas: number
  kpErro: string | null
}

export async function calcularQuickWins(
  siteUrl: string,
  deps: SyncDeps,
  opts: { marca?: string[]; limite?: number } = {},
): Promise<QuickWinsCalculados> {
  const { startDate, endDate } = gscWindow(deps.today ?? new Date())
  const rows = await deps.queryGsc(siteUrl, { startDate, endDate, dimensions: ['query', 'page'], maxRows: 50_000 })

  const aggs = aggregateByQuery(rows)
  const candidatos = selectQuickWins(aggs, { marca: opts.marca, limite: opts.limite ?? 100 })

  let volumes = new Map<string, KeywordVolume>()
  let kpErro: string | null = null
  if (!deps.getVolumes) {
    kpErro = 'Keyword Planner não configurado'
  } else if (candidatos.length > 0) {
    try {
      volumes = await deps.getVolumes(candidatos.map((c) => c.query))
    } catch (e) {
      kpErro = e instanceof Error ? e.message : 'Falha no Keyword Planner'
    }
  }

  return {
    janela: { inicio: startDate, fim: endDate },
    oportunidades: buildOportunidades(candidatos, volumes),
    queriesAnalisadas: aggs.length,
    kpErro,
  }
}
