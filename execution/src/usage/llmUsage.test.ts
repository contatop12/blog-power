import { describe, expect, it } from 'vitest'
import { FakeD1 } from '../test-support/fakeD1.js'
import { llmUsageRecorder } from './llmUsage.js'

describe('llmUsageRecorder', () => {
  it('grava uma linha por chamada com o contexto do job', async () => {
    const db = new FakeD1()
    const gravar = llmUsageRecorder(db, { clientId: 'cli', articleId: 'art', jobId: 'job', agente: 'redigir' })
    await gravar({ modelo: 'anthropic/claude-sonnet-4-5', tokensIn: 1200, tokensOut: 300, custoUsd: 0.0081 })

    const insert = db.executed[0]
    expect(insert.sql).toContain('INSERT INTO llm_usage')
    expect(insert.binds.slice(1)).toEqual(['cli', 'art', 'job', 'redigir', 'anthropic/claude-sonnet-4-5', 1200, 300, 0.0081, insert.binds[9]])
    expect(String(insert.binds[9])).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/)
  })
})
