/** Google Search Console API v3 (webmasters): propriedades e Search Analytics. */
import { googleFetch, type GoogleCredentials } from './auth.js'

const GSC_BASE = 'https://www.googleapis.com/webmasters/v3'
/** Máximo de linhas por requisição aceito pela API. */
export const GSC_PAGE_SIZE = 25_000
const DEFAULT_MAX_ROWS = 50_000

export interface GscSite {
  siteUrl: string
  permissionLevel: string
}

export interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export type GscDimension = 'query' | 'page' | 'date' | 'device' | 'country'

export interface GscQuery {
  startDate: string
  endDate: string
  dimensions: GscDimension[]
  /** Teto de linhas somando as páginas. Padrão 50 000. */
  maxRows?: number
}

export async function listGscSites(creds: GoogleCredentials): Promise<GscSite[]> {
  const data = await googleFetch<{ siteEntry?: GscSite[] }>(creds, `${GSC_BASE}/sites`, { method: 'GET' }, 'Search Console')
  return (data.siteEntry ?? []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
}

export async function queryGscSearchAnalytics(
  creds: GoogleCredentials,
  siteUrl: string,
  q: GscQuery,
): Promise<GscRow[]> {
  const maxRows = q.maxRows ?? DEFAULT_MAX_ROWS
  const url = `${GSC_BASE}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const rows: GscRow[] = []

  for (let startRow = 0; rows.length < maxRows; startRow += GSC_PAGE_SIZE) {
    const rowLimit = Math.min(GSC_PAGE_SIZE, maxRows - rows.length)
    const data = await googleFetch<{ rows?: GscRow[] }>(
      creds,
      url,
      {
        method: 'POST',
        body: JSON.stringify({
          startDate: q.startDate,
          endDate: q.endDate,
          dimensions: q.dimensions,
          rowLimit,
          startRow,
        }),
      },
      'Search Console',
    )
    const page = data.rows ?? []
    rows.push(...page)
    if (page.length < rowLimit) break
  }
  return rows.slice(0, maxRows)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Janela padrão: os dados do Search Console chegam com ~3 dias de atraso. */
export function gscWindow(today: Date, days = 28, lagDays = 3): { startDate: string; endDate: string } {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - lagDays))
  const start = new Date(end.getTime() - (days - 1) * 86_400_000)
  return { startDate: isoDate(start), endDate: isoDate(end) }
}
