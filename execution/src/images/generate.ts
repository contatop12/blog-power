export const WORKERS_AI_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell'

/** Critério do PRD: imagem publicada abaixo de 300 KB. */
export const MAX_IMAGE_BYTES = 300 * 1024

const MAX_PROMPT_CHARS = 2048
const QUALIDADES_WEBP = [80, 60]

export type ImageProvider = 'openrouter' | 'workers_ai'
export type ImageContentType = 'image/webp' | 'image/jpeg'

/** Subconjunto do binding Workers AI (`env.AI`) usado aqui. */
export interface WorkersAiLike {
  run(model: string, input: Record<string, unknown>): Promise<unknown>
}

interface ImageChainLike {
  transform(options: Record<string, unknown>): ImageChainLike
  output(options: { format: string; quality?: number }): Promise<{ response(): Response }>
}

/** Subconjunto do binding Cloudflare Images (`env.IMAGE_TRANSFORM`). */
export interface ImageTransformerLike {
  input(stream: ReadableStream<Uint8Array>): ImageChainLike
}

export interface ImageGenerateInput {
  prompt: string
  diretrizVisual: string
  alt: string
  provider: ImageProvider
  ai?: WorkersAiLike
  transformer?: ImageTransformerLike
  /** Padrão 1200×630 (imagem destacada / Open Graph). */
  width?: number
  height?: number
}

export interface ImageGenerateResult {
  bytes: Uint8Array
  alt: string
  contentType: ImageContentType
  /** false = WebP indisponível, entregou o JPEG original do modelo. */
  convertido: boolean
}

/** FLUX é fraco com texto: pedir "sem texto" evita letras deformadas na imagem. */
export function buildImagePrompt(prompt: string, diretrizVisual: string): string {
  const guarda = 'No text, no letters, no logos, no watermarks.'
  const partes = [prompt.trim(), diretrizVisual?.trim() ? `Visual style: ${diretrizVisual.trim()}` : '']
    .filter(Boolean)
    .join('. ')

  const espaco = MAX_PROMPT_CHARS - guarda.length - 2
  return `${partes.slice(0, espaco)}. ${guarda}`
}

export function base64ToBytes(base64: string): Uint8Array {
  const limpo = base64.replace(/^data:[^,]*,/, '')
  const binario = atob(limpo)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i)
  return bytes
}

function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new Response(bytes as BodyInit).body as ReadableStream<Uint8Array>
}

async function gerarComWorkersAi(ai: WorkersAiLike | undefined, prompt: string): Promise<Uint8Array> {
  if (!ai) {
    throw new Error('Workers AI indisponível: configure o binding AI no worker do pipeline')
  }

  const resposta = (await ai.run(WORKERS_AI_IMAGE_MODEL, { prompt, steps: 6 })) as { image?: string }
  if (!resposta?.image) {
    throw new Error(`Workers AI respondeu sem imagem (${WORKERS_AI_IMAGE_MODEL})`)
  }
  return base64ToBytes(resposta.image)
}

/** Recorta no tamanho final e converte para WebP; recomprime se passar de 300 KB. */
async function converterParaWebp(
  transformer: ImageTransformerLike,
  original: Uint8Array,
  width: number,
  height: number,
): Promise<Uint8Array> {
  let ultimo: Uint8Array | null = null

  for (const quality of QUALIDADES_WEBP) {
    const resultado = await transformer
      .input(bytesToStream(original))
      .transform({ width, height, fit: 'cover' })
      .output({ format: 'image/webp', quality })

    ultimo = new Uint8Array(await resultado.response().arrayBuffer())
    if (ultimo.byteLength <= MAX_IMAGE_BYTES) return ultimo
  }

  return ultimo as Uint8Array
}

export async function generateImage(input: ImageGenerateInput): Promise<ImageGenerateResult> {
  const alt = input.alt?.trim()
  if (!alt) throw new Error('ALT da imagem vazio — o Editor precisa informar o texto alternativo')

  if (input.provider !== 'workers_ai') {
    throw new Error(
      `Provider de imagem "${input.provider}" não implementado — use IMAGE_PROVIDER=workers_ai`,
    )
  }

  const original = await gerarComWorkersAi(input.ai, buildImagePrompt(input.prompt, input.diretrizVisual))

  if (!input.transformer) {
    return { bytes: original, alt, contentType: 'image/jpeg', convertido: false }
  }

  try {
    const webp = await converterParaWebp(
      input.transformer,
      original,
      input.width ?? 1200,
      input.height ?? 630,
    )
    return { bytes: webp, alt, contentType: 'image/webp', convertido: true }
  } catch {
    // Images binding ausente/sem cota: publica o JPEG do modelo em vez de falhar o artigo
    return { bytes: original, alt, contentType: 'image/jpeg', convertido: false }
  }
}
