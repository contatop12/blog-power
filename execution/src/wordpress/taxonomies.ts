import { wpFetch, type WordPressCredentials } from './client.js'

export interface WpCategory {
  id: number
  name: string
  slug: string
  parent: number
  count: number
}

export interface WpTag {
  id: number
  name: string
  slug: string
}

export interface WpAuthor {
  id: number
  name: string
  slug: string
}

interface WpPaged<T> extends Array<T> {
  length: number
}

export async function listWpCategories(creds: WordPressCredentials): Promise<WpCategory[]> {
  const items: WpCategory[] = []
  let page = 1
  while (page <= 10) {
    const batch = await wpFetch<WpPaged<WpCategory>>(
      creds,
      `/wp/v2/categories?per_page=100&page=${page}&orderby=name&order=asc`,
    )
    if (!batch.length) break
    items.push(...batch)
    if (batch.length < 100) break
    page += 1
  }
  return items
}

export async function listWpTags(creds: WordPressCredentials): Promise<WpTag[]> {
  const items: WpTag[] = []
  let page = 1
  while (page <= 5) {
    const batch = await wpFetch<WpPaged<WpTag>>(
      creds,
      `/wp/v2/tags?per_page=100&page=${page}&orderby=name&order=asc`,
    )
    if (!batch.length) break
    items.push(...batch)
    if (batch.length < 100) break
    page += 1
  }
  return items
}

export async function listWpAuthors(creds: WordPressCredentials): Promise<WpAuthor[]> {
  const batch = await wpFetch<WpPaged<WpAuthor>>(
    creds,
    '/wp/v2/users?per_page=100&who=authors&orderby=name&order=asc',
  )
  return [...batch]
}

export interface CreateWpCategoryBody {
  name: string
  parent?: number
}

export interface UpdateWpCategoryBody {
  name?: string
  slug?: string
  parent?: number
}

export async function createWpCategory(
  creds: WordPressCredentials,
  body: CreateWpCategoryBody,
): Promise<WpCategory> {
  return wpFetch<WpCategory>(creds, '/wp/v2/categories', {
    method: 'POST',
    body: {
      name: body.name.trim(),
      parent: body.parent ?? 0,
    },
  })
}

export async function updateWpCategory(
  creds: WordPressCredentials,
  categoryId: number,
  body: UpdateWpCategoryBody,
): Promise<WpCategory> {
  const payload: Record<string, unknown> = {}
  if (body.name !== undefined) payload.name = body.name.trim()
  if (body.slug !== undefined) payload.slug = body.slug.trim()
  if (body.parent !== undefined) payload.parent = body.parent

  return wpFetch<WpCategory>(creds, `/wp/v2/categories/${categoryId}`, {
    method: 'POST',
    body: payload,
  })
}

export async function deleteWpCategory(
  creds: WordPressCredentials,
  categoryId: number,
): Promise<void> {
  await wpFetch<void>(creds, `/wp/v2/categories/${categoryId}?force=true`, {
    method: 'DELETE',
  })
}
