import type { D1Database, Queue, R2Bucket } from '@cloudflare/workers-types'

export interface ApiBindings {
  DB: D1Database
  IMAGES: R2Bucket
  ARTICLE_QUEUE: Queue
  ENVIRONMENT: string
  DASHBOARD_USER: string
  DASHBOARD_PASS: string
  ENCRYPTION_KEY: string
  OPENROUTER_API_KEY: string
  OPENROUTER_MODEL_REDATOR: string
  OPENROUTER_MODEL_EDITOR: string
  OPENROUTER_MODEL_IMAGEM: string
  IMAGE_PROVIDER: string
  ALLOWED_ORIGINS: string
  /** Conta contato (contato@p12digital.com.br): Ads, GBP e Search Console da ABX. */
  GOOGLE_ADS_CLIENT_ID?: string
  GOOGLE_ADS_CLIENT_SECRET?: string
  GOOGLE_ADS_REFRESH_TOKEN?: string
  GOOGLE_ADS_DEVELOPER_TOKEN?: string
  /** MCC da agência (var, não secret). */
  GOOGLE_ADS_LOGIN_CUSTOMER_ID?: string
  /** Conta ryan (ryansantiago@p12digital.com.br): Search Console e GA4. */
  GOOGLE_DATA_CLIENT_ID?: string
  GOOGLE_DATA_CLIENT_SECRET?: string
  GOOGLE_DATA_REFRESH_TOKEN?: string
}
