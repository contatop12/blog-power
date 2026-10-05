/** Google Ads API: volume mensal das buscas (Keyword Planner, métricas históricas). */
import { googleFetch, type GoogleCredentials } from './auth.js'

export const GOOGLE_ADS_API_VERSION = 'v25'
export const GEO_BRASIL = 'geoTargetConstants/2076'
export const IDIOMA_PORTUGUES = 'languageConstants/1014'
/** Palavras por requisição (a API aceita mais; lote menor reduz o impacto de um erro). */
export const KP_CHUNK = 1000

export interface KeywordPlannerConfig {
  creds: GoogleCredentials
  developerToken: string
  /** MCC da agência, com ou sem hífens. */
  loginCustomerId: string
  /** Conta consultada; padrão = a própria MCC. */
  customerId?: string
}

export interface KeywordVolume {
  keyword: string
  volumeMensal: number | null
  concorrencia: string | null
}

interface HistoricalMetricsResponse {
  results?: Array<{
    text: string
    closeVariants?: string[]
    keywordMetrics?: { avgMonthlySearches?: string | number; competition?: string }
  }>
}

export function normalizeKeyword(k: string): string {
  return k
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const soDigitos = (id: string) => id.replace(/\D/g, '')

export async function getKeywordVolumes(
  cfg: KeywordPlannerConfig,
  keywords: string[],
  opts: { geo?: string; idioma?: string } = {},
): Promise<Map<string, KeywordVolume>> {
  const volumes = new Map<string, KeywordVolume>()

  const unicas: string[] = []
  const vistas = new Set<string>()
  for (const k of keywords) {
    const norm = normalizeKeyword(k)
    if (!norm || vistas.has(norm)) continue
    vistas.add(norm)
    unicas.push(k.trim())
  }
  if (unicas.length === 0) return volumes

  const login = soDigitos(cfg.loginCustomerId)
  const customer = soDigitos(cfg.customerId ?? cfg.loginCustomerId)
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customer}:generateKeywordHistoricalMetrics`

  for (let i = 0; i < unicas.length; i += KP_CHUNK) {
    const lote = unicas.slice(i, i + KP_CHUNK)
    const data = await googleFetch<HistoricalMetricsResponse>(
      cfg.creds,
      url,
      {
        method: 'POST',
        headers: { 'developer-token': cfg.developerToken, 'login-customer-id': login },
        body: JSON.stringify({
          keywords: lote,
          language: opts.idioma ?? IDIOMA_PORTUGUES,
          geoTargetConstants: [opts.geo ?? GEO_BRASIL],
          keywordPlanNetwork: 'GOOGLE_SEARCH',
        }),
      },
      'Keyword Planner',
    )
    for (const r of data.results ?? []) {
      const bruto = r.keywordMetrics?.avgMonthlySearches
      const volume: KeywordVolume = {
        keyword: r.text,
        volumeMensal: bruto === undefined || bruto === null ? null : Number(bruto),
        concorrencia: r.keywordMetrics?.competition ?? null,
      }
      volumes.set(normalizeKeyword(r.text), volume)
      for (const variante of r.closeVariants ?? []) {
        const chave = normalizeKeyword(variante)
        if (!volumes.has(chave)) volumes.set(chave, volume)
      }
    }
  }
  return volumes
}
