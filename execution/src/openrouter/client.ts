export const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4-5'

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenRouterOptions {
  apiKey: string
  model?: string
  messages: OpenRouterMessage[]
  temperature?: number
  responseFormat?: 'text' | 'json'
  referer?: string
  title?: string
}

export function resolveOpenRouterModel(model?: string): string {
  const trimmed = model?.trim()
  return trimmed || DEFAULT_OPENROUTER_MODEL
}

export async function chatCompletion(options: OpenRouterOptions): Promise<string> {
  const body: Record<string, unknown> = {
    model: resolveOpenRouterModel(options.model),
    messages: options.messages,
    temperature: options.temperature ?? 0.3,
  }

  if (options.responseFormat === 'json') {
    body.response_format = { type: 'json_object' }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
    'Content-Type': 'application/json',
  }

  if (options.referer) headers['HTTP-Referer'] = options.referer
  if (options.title) headers['X-Title'] = options.title

  const res = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenRouter ${res.status}: ${errText}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('OpenRouter: resposta vazia')
  return content
}

export async function chatJson<T>(options: OpenRouterOptions): Promise<T> {
  const raw = await chatCompletion({ ...options, responseFormat: 'json' })
  return JSON.parse(raw) as T
}
