import type { PublishArticleInput, SeoJson, SeoPlugin } from '@publisher-p12/types'
import {
  buildSeoMetaFields,
  wpFetch,
  wpFetchBinary,
  type WordPressCredentials,
} from './client.js'

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
  publish: PublishArticleInput
}

export interface PublishResult {
  wp_post_id: number
  wp_url: string
}

function toDateGmt(isoLocal: string, timezone: string): string {
  const date = new Date(isoLocal)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data de agendamento inválida: ${isoLocal}`)
  }
  void timezone
  return date.toISOString().replace(/\.\d{3}Z$/, '')
}

export async function publishToWordPress(input: PublishInput): Promise<PublishResult> {
  let featuredMediaId: number | undefined

  if (input.imageBytes && input.imageAlt) {
    const media = await wpFetchBinary(
      input.creds,
      '/wp/v2/media',
      input.imageBytes,
      'image/webp',
      `${input.slug}.webp`,
    )
    featuredMediaId = media.id
    await wpFetch(input.creds, `/wp/v2/media/${media.id}`, {
      method: 'POST',
      body: { alt_text: input.imageAlt },
    })
  }

  const schemaStr = input.schemaJsonld ? JSON.stringify(input.schemaJsonld) : undefined
  const meta = buildSeoMetaFields(
    input.seoPlugin,
    input.seo.titulo_seo,
    input.seo.meta_description,
    input.seo.kw_principal,
    schemaStr,
  )

  const dateGmt = toDateGmt(input.publish.agendado_para, 'America/Sao_Paulo')

  const post = await wpFetch<{ id: number; link: string }>(input.creds, '/wp/v2/posts', {
    method: 'POST',
    body: {
      status: 'future',
      date_gmt: dateGmt,
      title: input.title,
      slug: input.slug,
      content: input.contentHtml,
      featured_media: featuredMediaId,
      categories: input.publish.categoria_ids,
      tags: input.publish.tag_ids,
      author: input.publish.autor_id,
      meta,
    },
  })

  return {
    wp_post_id: post.id,
    wp_url: post.link,
  }
}
