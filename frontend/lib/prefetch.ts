'use client'

import { queries } from './api'
import { prefetchQuery } from './query'

/**
 * Começa a buscar os dados da tela para onde um link aponta. Chamado no hover/foco,
 * deixa a API trabalhando em paralelo com o carregamento da rota.
 */
export function prefetchForHref(href: string): void {
  const path = href.split(/[?#]/)[0]

  if (path === '/') return prefetchQuery(queries.dashboard())
  if (path === '/clients') return prefetchQuery(queries.clients())
  if (path === '/articles') {
    prefetchQuery(queries.articles())
    prefetchQuery(queries.clients())
    return
  }

  if (path === '/articles/new') {
    const clientId = new URLSearchParams(href.split('?')[1] ?? '').get('client_id')
    if (clientId) prefetchQuery(queries.client(clientId))
    return
  }

  const client = path.match(/^\/clients\/([^/]+)$/)
  if (client && client[1] !== 'new') return prefetchQuery(queries.client(client[1]))

  const article = path.match(/^\/articles\/([^/]+)\/review$/)
  if (article) return prefetchQuery(queries.article(article[1]))
}
