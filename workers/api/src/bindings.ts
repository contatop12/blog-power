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
}
