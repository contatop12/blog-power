import { describe, expect, it } from 'vitest'
import { markdownToGutenberg } from './gutenberg.js'

describe('markdownToGutenberg', () => {
  it('converte heading e parágrafo', () => {
    const md = `# Wi-Fi 7 para empresas

O Wi-Fi 7 é baseado no padrão IEEE 802.11be.`
    const html = markdownToGutenberg(md)
    expect(html).toContain('<!-- wp:heading')
    expect(html).toContain('<h1>Wi-Fi 7 para empresas</h1>')
    expect(html).toContain('<!-- wp:paragraph')
    expect(html).toContain('IEEE 802.11be')
  })

  it('converte lista não ordenada com list-item', () => {
    const md = `- Multi-Link Operation (MLO)
- Latência reduzida`
    const html = markdownToGutenberg(md)
    expect(html).toContain('<!-- wp:list')
    expect(html).toContain('<!-- wp:list-item')
    expect(html).toContain('Multi-Link Operation')
  })

  it('converte H2 e blockquote', () => {
    const md = `## O que muda com o Wi-Fi 7?

> Quando vale migrar depende da operação, não do hype.`
    const html = markdownToGutenberg(md)
    expect(html).toContain('"level":2')
    expect(html).toContain('<!-- wp:quote')
  })

  it('converte separador', () => {
    const md = `Intro

---

Conclusão`
    const html = markdownToGutenberg(md)
    expect(html).toContain('<!-- wp:separator')
  })
})
