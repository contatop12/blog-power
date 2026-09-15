import type { PublishArticleInput, SeoJson, SeoPlugin, WpPostType } from '@publisher-p12/types'
import {
  buildSeoMetaFields,
  wpFetch,
  wpFetchBinary,
  type WordPressCredentials,
} from './client.js'
import { isScheduledInFuture, localDatetimeToDateGmt } from './datetime.js'

export interface PublishInput {
  creds: WordPressCredentials
  seoPlugin: SeoPlugin
  title: string
  slug: string
  contentHtml: string
  seo: SeoJson
  schemaJsonld?: Record<string, unknown>
  imageBytes?: Uint8Array
  imageAlt?: string
  /** Padrão image/webp; image/jpeg quando a conversão não estava disponível. */
  imageContentType?: string
  publish: PublishArticleInput
  timezone: string
}

export interface UploadedMedia {
  id: number
  url: string
}

function extensaoPorTipo(contentType: string): string {
  if (contentType === 'image/jpeg') return 'jpg'
  if (contentType === 'image/png') return 'png'
  return 'webp'
}

/** Envia uma imagem à biblioteca de mídia do WordPress já com o texto alternativo. */
export async function uploadWpMedia(
  creds: WordPressCredentials,
  bytes: Uint8Array,
  contentType: string,
  nomeBase: string,
  alt: string,
): Promise<UploadedMedia> {
  const media = await wpFetchBinary(
    creds,
    '/wp/v2/media',
    bytes,
    contentType,
    `${nomeBase}.${extensaoPorTipo(contentType)}`,
  )

  const atualizada = await wpFetch<{ source_url?: string }>(creds, `/wp/v2/media/${media.id}`, {
    method: 'POST',
    body: { alt_text: alt },
  })

  const url = atualizada?.source_url ?? media.source_url
  if (!url) throw new Error(`WordPress não devolveu a URL da mídia ${media.id}`)
  return { id: media.id, url }
}

export interface PublishResult {
  wp_post_id: number
  wp_url: string
  scheduled: boolean
  date_gmt?: string
}

export function wpRestCollection(postType: WpPostType): string {
  return postType === 'page' ? '/wp/v2/pages' : '/wp/v2/posts'
}

export async function publishToWordPress(input: PublishInput): Promise<PublishResult> {
  let featuredMediaId: number | undefined

  if (input.imageBytes && input.imageAlt) {
    const media = await uploadWpMedia(
      input.creds,
      input.imageBytes,
      input.imageContentType ?? 'image/webp',
      input.slug,
      input.imageAlt,
    )
    featuredMediaId = media.id
  }

  const schemaStr = input.schemaJsonld ? JSON.stringify(input.schemaJsonld) : undefined
  const meta = buildSeoMetaFields(
    input.seoPlugin,
    input.seo.titulo_seo,
    input.seo.meta_description,
    input.seo.kw_principal,
    schemaStr,
  )

  const dateGmt = localDatetimeToDateGmt(input.publish.agendado_para, input.timezone)
  const scheduled = isScheduledInFuture(dateGmt)

  const postType: WpPostType = input.publish.wp_post_type ?? 'post'
  const endpoint = wpRestCollection(postType)

  const postBody: Record<string, unknown> = {
    status: scheduled ? 'future' : 'publish',
    title: input.title,
    slug: input.slug,
    content: input.contentHtml,
    featured_media: featuredMediaId,
    meta,
  }

  if (postType === 'post') {
    postBody.categories = input.publish.categoria_ids
    postBody.tags = input.publish.tag_ids
  }

  if (scheduled) {
    postBody.date_gmt = dateGmt
  }

  if (input.publish.autor_id) {
    postBody.author = input.publish.autor_id
  }

  const post = await wpFetch<{ id: number; link: string }>(input.creds, endpoint, {
    method: 'POST',
    body: postBody,
  })

  return {
    wp_post_id: post.id,
    wp_url: post.link,
    scheduled,
    date_gmt: scheduled ? dateGmt : undefined,
  }
}
