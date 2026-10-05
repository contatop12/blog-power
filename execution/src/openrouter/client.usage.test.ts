import { afterEach, describe, expect, it, vi } from 'vitest'
import { chatCompletion, type LlmUsage } from './client.js'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chatCompletion — uso e custo', () => {
  it('pede usage ao OpenRouter e repassa tokens e custo', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        model: 'anthropic/claude-sonnet-4-5',
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1200, completion_tokens: 300, cost: 0.0081 },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const recebidos: LlmUsage[] = []

    const out = await chatCompletion({ apiKey: 'k', messages: [{ role: 'user', content: 'oi' }], onUsage: (u) => { recebidos.push(u) } })

    expect(out).toBe('ok')
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(init.body)).usage).toEqual({ include: true })
    expect(recebidos).toEqual([{ modelo: 'anthropic/claude-sonnet-4-5', tokensIn: 1200, tokensOut: 300, custoUsd: 0.0081 }])
  })

  it('sem custo na resposta grava null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 10, completion_tokens: 2 } })))
    const recebidos: LlmUsage[] = []
    await chatCompletion({ apiKey: 'k', model: 'x/y', messages: [{ role: 'user', content: 'oi' }], onUsage: (u) => { recebidos.push(u) } })
    expect(recebidos[0]).toEqual({ modelo: 'x/y', tokensIn: 10, tokensOut: 2, custoUsd: null })
  })

  it('falha ao registrar o uso não derruba o agente', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } })))
    const out = await chatCompletion({
      apiKey: 'k',
      messages: [{ role: 'user', content: 'oi' }],
      onUsage: async () => { throw new Error('D1 fora do ar') },
    })
    expect(out).toBe('ok')
  })
})
