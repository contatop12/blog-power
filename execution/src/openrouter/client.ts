export const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions'

export const DEFAULT_OPENROUTER_MODEL = 'anthropic/claude-sonnet-4-5'

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Uso de uma chamada, para o registro de custo (llm_usage). */
export interface LlmUsage {
  modelo: string
  tokensIn: number
  tokensOut: number
  /** USD informado pelo OpenRouter; null quando a resposta não traz custo. */
  custoUsd: number | null
}

export interface OpenRouterOptions {
  apiKey: string
  model?: string
  messages: OpenRouterMessage[]
  temperature?: number
  responseFormat?: 'text' | 'json'
  /** Teto de tokens da resposta; sem ele vale o padrão do provedor. */
  maxTokens?: number
  referer?: string
  title?: string
  /** Recebe tokens e custo de cada chamada. Erros aqui são ignorados — nunca derrubam o agente. */
  onUsage?: (usage: LlmUsage) => void | Promise<void>
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
  if (options.maxTokens) body.max_tokens = options.maxTokens
  // OpenRouter devolve tokens e custo (USD) quando pedimos usage accounting
  body.usage = { include: true }

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
    model?: string
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }
  }

  const content = data.choices?.[0]?.message?.content

  if (options.onUsage) {
    try {
      await options.onUsage({
        modelo: data.model ?? resolveOpenRouterModel(options.model),
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
        custoUsd: typeof data.usage?.cost === 'number' ? data.usage.cost : null,
      })
    } catch {
      // registro de custo é best-effort
    }
  }
  if (!content) throw new Error('OpenRouter: resposta vazia')
  return content
}

function skipSpaces(json: string, from: number): number {
  let i = from
  while (i < json.length && /\s/.test(json[i])) i += 1
  return i
}

/** Começo de um valor JSON na posição: string, objeto, array, número, true/false/null. */
function startsJsonValue(json: string, at: number): boolean {
  const ch = json[at]
  if (ch === undefined) return true
  if (ch === '"' || ch === '{' || ch === '[') return true
  if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(json[at + 1] ?? ''))) return true
  return json.startsWith('true', at) || json.startsWith('false', at) || json.startsWith('null', at)
}

/** Uma aspa dentro de string só fecha se o que vem depois tiver cara de estrutura JSON. */
function quoteClosesString(json: string, quoteAt: number): boolean {
  const j = skipSpaces(json, quoteAt + 1)
  const next = json[j]
  if (next === undefined || next === '}' || next === ']') return true
  if (next === ',' || next === ':') return startsJsonValue(json, skipSpaces(json, j + 1))
  return false
}

const CONTROL_ESCAPES: Record<string, string> = { '\n': '\\n', '\r': '\\r', '\t': '\\t' }

/**
 * Conserta o que modelos costumam errar dentro de strings JSON longas:
 * aspas retas soltas no texto (`rede "plana"`, `o "Wi-Fi 7", que…`) e quebras de linha
 * literais. Heurística: a aspa só fecha a string quando é seguida de `}`/`]`, ou de `,`/`:`
 * seguidos de um valor JSON; senão vira `\"`.
 */
export function repairUnescapedQuotes(json: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < json.length; i += 1) {
    const ch = json[i]
    if (!inString) {
      if (ch === '"') inString = true
      out += ch
      continue
    }
    if (ch === '\\') {
      out += ch + (json[i + 1] ?? '')
      i += 1
      continue
    }
    if (ch === '"') {
      if (quoteClosesString(json, i)) {
        inString = false
        out += ch
      } else {
        out += '\\"'
      }
      continue
    }
    if (ch < ' ') {
      out += CONTROL_ESCAPES[ch] ?? `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`
      continue
    }
    out += ch
  }
  return out
}

function tryParse<T>(text: string): { ok: true; value: T } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) as T }
  } catch {
    return { ok: false }
  }
}

/**
 * Alguns modelos ignoram `response_format: json_object`: embrulham a resposta em ```json
 * ou deixam aspas sem escape dentro do texto. Tenta, em ordem: texto puro, conteúdo do bloco
 * de código, recorte do primeiro `{` ao último `}` — cada um também com reparo de aspas.
 */
export function parseJsonContent<T = unknown>(raw: string): T {
  const text = raw.trim()
  const candidates = [text]
  const fenced = /```(?:json)?\s*\n?([\s\S]*?)\n?```/i.exec(text)
  if (fenced) candidates.push(fenced[1].trim())
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1))

  for (const candidate of candidates) {
    const direct = tryParse<T>(candidate)
    if (direct.ok) return direct.value
  }
  for (const candidate of candidates) {
    const repaired = tryParse<T>(repairUnescapedQuotes(candidate))
    if (repaired.ok) return repaired.value
  }
  // Nenhuma estratégia funcionou: o erro do candidato mais limpo (já reparado) aponta onde o
  // JSON quebra de verdade, com um trecho em volta para diagnóstico
  const best = repairUnescapedQuotes(candidates[candidates.length - 1])
  try {
    return JSON.parse(best) as T
  } catch (err) {
    const pos = Number(/position (\d+)/.exec(err instanceof Error ? err.message : '')?.[1])
    const trecho = Number.isFinite(pos) ? ` perto de: ${JSON.stringify(best.slice(Math.max(0, pos - 60), pos + 60))}` : ''
    throw new Error(`${err instanceof Error ? err.message : String(err)}${trecho}`)
  }
}

/** Erro legível para JSON inválido: tamanho da resposta e se ela parece ter sido cortada. */
export function jsonFailureMessage(raw: string, err: unknown): string {
  const text = raw.trim().replace(/```\s*$/, '').trim()
  const cortada = !/[}\]]$/.test(text)
  const motivo = err instanceof Error ? err.message : String(err)
  return `Resposta do modelo não é JSON válido (${raw.length} chars${
    cortada ? ', parece cortada' : ''
  }): ${motivo.slice(0, 200)}`
}

/** Saída longa (artigo inteiro dentro do JSON) precisa de teto explícito para não ser cortada. */
const JSON_MAX_TOKENS = 16000
/** A saída do modelo varia: uma segunda chamada costuma vir válida quando a primeira não veio. */
const JSON_ATTEMPTS = 2

export async function chatJson<T>(options: OpenRouterOptions): Promise<T> {
  let lastError = ''
  for (let attempt = 1; attempt <= JSON_ATTEMPTS; attempt += 1) {
    const raw = await chatCompletion({
      ...options,
      responseFormat: 'json',
      maxTokens: options.maxTokens ?? JSON_MAX_TOKENS,
    })
    try {
      return parseJsonContent<T>(raw)
    } catch (err) {
      lastError = jsonFailureMessage(raw, err)
    }
  }
  throw new Error(lastError)
}
