export interface SitemapUrl {
  loc: string
  lastmod?: string
}

export interface SyncSitemapResult {
  urls: SitemapUrl[]
  count: number
}

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

export async function fetchSitemap(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): Promise<SyncSitemapResult> {
  const normalized = baseUrl.replace(/\/$/, '')
  const sitemapUrl = `${normalized}/sitemap.xml`
  const res = await fetchFn(sitemapUrl)
  if (!res.ok) {
    throw new Error(`Sitemap não encontrado: ${sitemapUrl} (${res.status})`)
  }
  const xml = await res.text()
  const allUrls: SitemapUrl[] = []

  if (isSitemapIndex(xml)) {
    const childSitemaps = extractSitemapUrls(xml)
    for (const childUrl of childSitemaps) {
      const childRes = await fetchFn(childUrl)
      if (!childRes.ok) continue
      const childXml = await childRes.text()
      allUrls.push(...parseSitemapXml(childXml))
    }
  } else {
    allUrls.push(...parseSitemapXml(xml))
  }

  const unique = [...new Map(allUrls.map((u) => [u.loc, u])).values()]
  return { urls: unique, count: unique.length }
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
