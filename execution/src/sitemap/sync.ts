export interface SitemapUrl {
  loc: string
  lastmod?: string
}

export interface SyncSitemapResult {
  urls: SitemapUrl[]
  count: number
  /** Quantidade de sub-sitemaps baixados (útil para diagnóstico). */
  sitemaps_fetched: number
}

const SKIP_SITEMAP_HINT =
  /image[-_]?sitemap|video[-_]?sitemap|news[-_]?sitemap|attachment|author[-_]?sitemap|tag[-_]?sitemap/i

export function parseSitemapXml(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = []
  const locRegex = /<loc>\s*([^<]+)\s*<\/loc>/gi
  let match: RegExpExecArray | null
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push({ loc: match[1].trim() })
  }
  return urls
}

export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml)
}

export function extractSitemapUrls(xml: string): string[] {
  return parseSitemapXml(xml).map((u) => u.loc)
}

/** Sitemaps de mídia/autores/tags raramente servem para links internos. */
export function shouldFetchChildSitemap(url: string): boolean {
  return !SKIP_SITEMAP_HINT.test(url)
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index])
    }
  }

  const agents = Array.from({ length: Math.min(concurrency, items.length) }, () => run())
  await Promise.all(agents)
  return results
}

export async function fetchSitemap(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<SyncSitemapResult> {
  const normalized = baseUrl.replace(/\/$/, '')
  const candidates = [
    `${normalized}/sitemap.xml`,
    `${normalized}/sitemap_index.xml`,
    `${normalized}/wp-sitemap.xml`,
  ]

  let xml: string | null = null
  let sitemapsFetched = 0

  for (const sitemapUrl of candidates) {
    const res = await fetchFn(sitemapUrl, {
      redirect: 'follow',
      headers: { Accept: 'application/xml,text/xml,*/*' },
    })
    if (!res.ok) continue
    xml = await res.text()
    sitemapsFetched += 1
    break
  }

  if (!xml) {
    throw new Error(`Sitemap não encontrado em ${normalized} (tentou sitemap.xml, sitemap_index.xml, wp-sitemap.xml)`)
  }

  const allUrls: SitemapUrl[] = []

  if (isSitemapIndex(xml)) {
    const childSitemaps = extractSitemapUrls(xml).filter(shouldFetchChildSitemap)
    const children = await mapPool(childSitemaps, 6, async (childUrl) => {
      try {
        const childRes = await fetchFn(childUrl, {
          redirect: 'follow',
          headers: { Accept: 'application/xml,text/xml,*/*' },
        })
        if (!childRes.ok) return [] as SitemapUrl[]
        const childXml = await childRes.text()
        return parseSitemapXml(childXml)
      } catch {
        return [] as SitemapUrl[]
      }
    })
    sitemapsFetched += childSitemaps.length
    for (const batch of children) {
      allUrls.push(...batch)
    }
  } else {
    allUrls.push(...parseSitemapXml(xml))
  }

  // Links internos: prioriza páginas/posts; remove URLs de feed, query e anexos comuns
  const filtered = allUrls.filter((u) => {
    try {
      const parsed = new URL(u.loc)
      if (parsed.search) return false
      if (/\.(jpg|jpeg|png|gif|webp|pdf|xml)$/i.test(parsed.pathname)) return false
      if (/\/feed\/?$/i.test(parsed.pathname)) return false
      return true
    } catch {
      return false
    }
  })

  const unique = [...new Map(filtered.map((u) => [u.loc, u])).values()]
  return { urls: unique, count: unique.length, sitemaps_fetched: sitemapsFetched }
}

export function urlToSlug(url: string): string | null {
  try {
    const pathname = new URL(url).pathname
    const parts = pathname.split('/').filter(Boolean)
    return parts.length > 0 ? parts[parts.length - 1] : null
  } catch {
    return null
  }
}
