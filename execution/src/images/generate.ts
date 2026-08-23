export interface ImageGenerateInput {
  prompt: string
  diretrizVisual: string
  alt: string
  provider: 'openrouter' | 'workers_ai'
  apiKey?: string
}

export interface ImageGenerateResult {
  bytes: Uint8Array
  alt: string
  contentType: 'image/webp'
}

/**
 * Stub: gera placeholder WebP mínimo até provider real ser configurado.
 */
export async function generateFeaturedImage(
  input: ImageGenerateInput,
): Promise<ImageGenerateResult> {
  void input.prompt
  void input.diretrizVisual
  void input.provider
  void input.apiKey

  // Placeholder 1x1 WebP (RIFF....WEBP)
  const placeholder = Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    0x56, 0x50, 0x38, 0x20, 0x18, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d,
    0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x34, 0x25, 0xa4, 0x00,
    0x03, 0x70, 0x00, 0xfe, 0xfb, 0xfd, 0x50, 0x00,
  ])

  return {
    bytes: placeholder,
    alt: input.alt,
    contentType: 'image/webp',
  }
}
