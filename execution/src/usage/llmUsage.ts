/** Grava o uso de cada chamada de LLM em llm_usage (custo por cliente/artigo/agente). */
import type { LlmUsage } from '../openrouter/client.js'
import type { D1Database } from '../types/d1.js'

export interface LlmUsageContexto {
  clientId: string | null
  articleId: string | null
  jobId: string | null
  agente: string
}

export function llmUsageRecorder(db: D1Database, ctx: LlmUsageContexto): (u: LlmUsage) => Promise<void> {
  return async (u) => {
    await db
      .prepare(
        `INSERT INTO llm_usage (id, client_id, article_id, job_id, agente, modelo, tokens_in, tokens_out, custo_usd)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), ctx.clientId, ctx.articleId, ctx.jobId, ctx.agente, u.modelo, u.tokensIn, u.tokensOut, u.custoUsd)
      .run()
  }
}
