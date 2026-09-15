import { describe, expect, it, vi } from 'vitest'
import {
  base64ToBytes,
  buildImagePrompt,
  generateImage,
  MAX_IMAGE_BYTES,
  WORKERS_AI_IMAGE_MODEL,
  type ImageTransformerLike,
  type WorkersAiLike,
} from './generate.js'

const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])
const JPEG_B64 = btoa(String.fromCharCode(...JPEG_BYTES))

function fakeAi(image = JPEG_B64): WorkersAiLike & { run: ReturnType<typeof vi.fn> } {
  return { run: vi.fn(async () => ({ image })) }
}

/** Transformer falso: registra as operações e devolve bytes do tamanho pedido. */
function fakeTransformer(tamanhos: number[] = [1000]) {
  const chamadas: Array<{ transforms: Record<string, unknown>[]; output: Record<string, unknown> }> = []
  let saida = 0
  const transformer: ImageTransformerLike = {
    input() {
      const transforms: Record<string, unknown>[] = []
      const chain = {
        transform(t: Record<string, unknown>) {
          transforms.push(t)
          return chain
        },
        async output(o: { format: string; quality?: number }) {
          chamadas.push({ transforms: [...transforms], output: o })
          const size = tamanhos[Math.min(saida++, tamanhos.length - 1)]
          return { response: () => new Response(new Uint8Array(size)) }
        },
      }
      return chain
    },
  }
  return { transformer, chamadas }
}

const BASE = {
  prompt: 'network operations center with fiber cables',
  diretrizVisual: 'fotografia corporativa, tons de azul',
  alt: 'Centro de operações de rede',
}

describe('buildImagePrompt', () => {
  it('combina prompt, diretriz visual e trava contra texto na imagem', () => {
    const prompt = buildImagePrompt(BASE.prompt, BASE.diretrizVisual)
    expect(prompt).toContain(BASE.prompt)
    expect(prompt).toContain(BASE.diretrizVisual)
    expect(prompt).toMatch(/no text/i)
  })

  it('respeita o limite de 2048 caracteres do modelo', () => {
    expect(buildImagePrompt('x'.repeat(3000), 'y'.repeat(500)).length).toBeLessThanOrEqual(2048)
  })
})

describe('base64ToBytes', () => {
  it('decodifica base64 em bytes', () => {
    expect(base64ToBytes(JPEG_B64)).toEqual(JPEG_BYTES)
  })

  it('aceita data URI', () => {
    expect(base64ToBytes(`data:image/jpeg;base64,${JPEG_B64}`)).toEqual(JPEG_BYTES)
  })
})

describe('generateImage (workers_ai)', () => {
  it('gera com FLUX e converte para WebP no tamanho pedido', async () => {
    const ai = fakeAi()
    const { transformer, chamadas } = fakeTransformer([2048])

    const result = await generateImage({
      ...BASE,
      provider: 'workers_ai',
      ai,
      transformer,
      width: 1200,
      height: 630,
    })

    expect(ai.run).toHaveBeenCalledWith(
      WORKERS_AI_IMAGE_MODEL,
      expect.objectContaining({ prompt: expect.stringContaining(BASE.prompt) }),
    )
    expect(chamadas[0].transforms).toEqual([{ width: 1200, height: 630, fit: 'cover' }])
    expect(chamadas[0].output).toEqual({ format: 'image/webp', quality: 80 })
    expect(result).toMatchObject({ contentType: 'image/webp', convertido: true, alt: BASE.alt })
    expect(result.bytes.byteLength).toBe(2048)
  })

  it('recomprime quando o WebP passa de 300 KB', async () => {
    const { transformer, chamadas } = fakeTransformer([MAX_IMAGE_BYTES + 1, 150_000])

    const result = await generateImage({ ...BASE, provider: 'workers_ai', ai: fakeAi(), transformer })

    expect(chamadas.map((c) => c.output.quality)).toEqual([80, 60])
    expect(result.bytes.byteLength).toBe(150_000)
  })

  it('cai para o JPEG original se o binding de Images falhar', async () => {
    const transformer: ImageTransformerLike = {
      input() {
        throw new Error('Images binding indisponível')
      },
    }

    const result = await generateImage({ ...BASE, provider: 'workers_ai', ai: fakeAi(), transformer })

    expect(result).toMatchObject({ contentType: 'image/jpeg', convertido: false })
    expect(result.bytes).toEqual(JPEG_BYTES)
  })

  it('sem transformer entrega o JPEG original', async () => {
    const result = await generateImage({ ...BASE, provider: 'workers_ai', ai: fakeAi() })
    expect(result.contentType).toBe('image/jpeg')
  })

  it('falha com mensagem clara sem o binding AI', async () => {
    await expect(generateImage({ ...BASE, provider: 'workers_ai' })).rejects.toThrow(/binding AI/)
  })

  it('falha com mensagem clara quando o modelo não devolve imagem', async () => {
    const ai: WorkersAiLike = { run: async () => ({}) }
    await expect(generateImage({ ...BASE, provider: 'workers_ai', ai })).rejects.toThrow(/sem imagem/)
  })

  it('exige ALT não vazio', async () => {
    await expect(
      generateImage({ ...BASE, alt: '  ', provider: 'workers_ai', ai: fakeAi() }),
    ).rejects.toThrow(/ALT/)
  })
})

describe('generateImage (openrouter)', () => {
  it('recusa provider ainda não implementado em vez de gerar placeholder', async () => {
    await expect(generateImage({ ...BASE, provider: 'openrouter' })).rejects.toThrow(/workers_ai/)
  })
})
