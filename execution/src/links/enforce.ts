import type { LinkInterno } from '@publisher-p12/types'
import { normalizeUrlKey } from './related.js'

export type MotivoRemocaoLink =
  | 'fora_do_inventario'
  | 'duplicado'
  | 'autolink'
  | 'excesso'
  | 'titulo'

export interface EnforceLinksOptions {
  /** Inventário permitido (client_urls). */
  allowedUrls: string[]
  /** Domínio do cliente — define o que é link interno. */
  dominio: string
  /** URL do próprio artigo, quando já publicado. */
  selfUrl?: string | null
  maxLinks?: number
}

export interface LinkMantido {
  url: string
  ancora: string
}

export interface LinkRemovido extends LinkMantido {
  motivo: MotivoRemocaoLink
}

export interface EnforceLinksResult {
  markdown: string
  mantidos: LinkMantido[]
  removidos: LinkRemovido[]
}

const MAX_LINKS_PADRAO = 8

/** [âncora](url "título opcional") — o `!` inicial identifica imagem. */
const MD_LINK = /(!?)\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

function hostDoDominio(dominio: string): string {
  const raw = dominio.trim()
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    return url.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return raw.toLowerCase().replace(/^www\./, '').replace(/\/.*$/, '')
  }
}

function hostDaUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Trava determinística pós-LLM para links internos: só sobrevivem links do
 * inventário, uma vez por URL, fora de títulos, sem autolink e até o máximo.
 * Links externos e imagens passam intactos.
 */
export function enforceInternalLinks(
  markdown: string,
  options: EnforceLinksOptions,
): EnforceLinksResult {
  const host = hostDoDominio(options.dominio)
  const permitidas = new Set(options.allowedUrls.map(normalizeUrlKey))
  const selfKey = options.selfUrl ? normalizeUrlKey(options.selfUrl) : null
  const maxLinks = options.maxLinks ?? MAX_LINKS_PADRAO

  const usadas = new Set<string>()
  const mantidos: LinkMantido[] = []
  const removidos: LinkRemovido[] = []

  const linhas = markdown.split('\n').map((linha) => {
    const ehTitulo = /^\s*#{1,6}\s/.test(linha)

    return linha.replace(MD_LINK, (original, bang: string, ancora: string, href: string) => {
      if (bang) return original

      const absoluta = href.startsWith('/') && !href.startsWith('//') ? `https://${host}${href}` : href
      if (!/^https?:\/\//i.test(absoluta) || hostDaUrl(absoluta) !== host) return original

      const key = normalizeUrlKey(absoluta)
      const remover = (motivo: MotivoRemocaoLink) => {
        removidos.push({ url: absoluta, ancora, motivo })
        return ancora
      }

      if (ehTitulo) return remover('titulo')
      if (!permitidas.has(key)) return remover('fora_do_inventario')
      if (selfKey && key === selfKey) return remover('autolink')
      if (usadas.has(key)) return remover('duplicado')
      if (mantidos.length >= maxLinks) return remover('excesso')

      usadas.add(key)
      mantidos.push({ url: absoluta, ancora })
      return absoluta === href ? original : `[${ancora}](${absoluta})`
    })
  })

  return { markdown: linhas.join('\n'), mantidos, removidos }
}

/** Alinha `seo.links_internos` ao que de fato ficou no corpo do artigo. */
export function reconcileLinksInternos(
  doEditor: LinkInterno[],
  mantidos: LinkMantido[],
): LinkInterno[] {
  const porUrl = new Map((doEditor ?? []).map((l) => [normalizeUrlKey(l.url), l]))

  return mantidos.map((m) => {
    const original = porUrl.get(normalizeUrlKey(m.url))
    const link: LinkInterno = { url: m.url, ancora: m.ancora }
    if (original?.posicao) link.posicao = original.posicao
    return link
  })
}
