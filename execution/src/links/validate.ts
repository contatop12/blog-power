import type { LinkInterno } from '@publisher-p12/types'

export interface LinkValidationResult {
  links: LinkInterno[]
  invalid: LinkInterno[]
  allValid: boolean
}

export interface ValidateLinksOptions {
  links: LinkInterno[]
  fetchFn?: typeof fetch
  timeoutMs?: number
}

async function checkUrl(
  url: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<number> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let res = await fetchFn(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' })
    if (res.status === 405 || res.status === 501) {
      res = await fetchFn(url, { method: 'GET', signal: controller.signal, redirect: 'follow' })
    }
    return res.status
  } catch {
    return 0
  } finally {
    clearTimeout(timer)
  }
}

export async function validateInternalLinks(
  options: ValidateLinksOptions,
): Promise<LinkValidationResult> {
  const fetchFn = options.fetchFn ?? fetch
  const timeoutMs = options.timeoutMs ?? 10_000
  const validated: LinkInterno[] = []
  const invalid: LinkInterno[] = []

  for (const link of options.links) {
    const status = await checkUrl(link.url, fetchFn, timeoutMs)
    const updated = { ...link, status_validacao: status }
    if (status === 200) {
      validated.push(updated)
    } else {
      invalid.push(updated)
    }
  }

  return {
    links: validated,
    invalid,
    allValid: invalid.length === 0,
  }
}

export function removeInvalidLinksFromMarkdown(
  markdown: string,
  invalidUrls: string[],
): string {
  if (invalidUrls.length === 0) return markdown
  let result = markdown
  for (const url of invalidUrls) {
    const mdLink = new RegExp(`\\[([^\\]]+)\\]\\(${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`, 'g')
    result = result.replace(mdLink, '$1')
    const htmlLink = new RegExp(`<a[^>]+href=["']${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([^<]*)</a>`, 'gi')
    result = result.replace(htmlLink, '$1')
  }
  return result
}
