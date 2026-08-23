import type { SeoPlugin } from '@publisher-p12/types'

export interface WordPressCredentials {
  wpApiUrl: string
  wpUser: string
  wpAppPassword: string
}

export interface WordPressFetchOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

function buildAuthHeader(user: string, password: string): string {
  return `Basic ${btoa(`${user}:${password}`)}`
}

export function normalizeWpApiUrl(url: string): string {
  return url.replace(/\/$/, '')
}

export async function wpFetch<T>(
  creds: WordPressCredentials,
  path: string,
  options: WordPressFetchOptions = {},
): Promise<T> {
  const base = normalizeWpApiUrl(creds.wpApiUrl)
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`

  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(creds.wpUser, creds.wpAppPassword),
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`WordPress ${res.status}: ${errText}`)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export async function wpFetchBinary(
  creds: WordPressCredentials,
  path: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
  filename: string,
): Promise<{ id: number }> {
  const base = normalizeWpApiUrl(creds.wpApiUrl)
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: buildAuthHeader(creds.wpUser, creds.wpAppPassword),
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
    body: body as BodyInit,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`WordPress media upload ${res.status}: ${errText}`)
  }

  return (await res.json()) as { id: number }
}

export function buildSeoMetaFields(
  seoPlugin: SeoPlugin,
  tituloSeo: string,
  metaDescription: string,
  focusKw: string,
  schemaJsonld?: string,
): Record<string, string> {
  const meta: Record<string, string> = {}

  if (seoPlugin === 'yoast') {
    meta._yoast_wpseo_title = tituloSeo
    meta._yoast_wpseo_metadesc = metaDescription
    meta._yoast_wpseo_focuskw = focusKw
  } else if (seoPlugin === 'rankmath') {
    meta.rank_math_title = tituloSeo
    meta.rank_math_description = metaDescription
    meta.rank_math_focus_keyword = focusKw
  }

  if (schemaJsonld) {
    meta.p12_schema_jsonld = schemaJsonld
  }

  return meta
}
