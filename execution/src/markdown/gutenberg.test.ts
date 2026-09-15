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

  it('converte link markdown em âncora HTML', () => {
    const html = markdownToGutenberg('Contrate um [link dedicado](https://abx.com.br/link-dedicado/) hoje.')
    expect(html).toContain('<a href="https://abx.com.br/link-dedicado/">link dedicado</a>')
    expect(html).not.toContain('](')
  })

  it('converte links dentro de itens de lista e com negrito na âncora', () => {
    const html = markdownToGutenberg('- Veja o [**SLA**](https://abx.com.br/sla/)')
    expect(html).toContain('<li>Veja o <a href="https://abx.com.br/sla/"><strong>SLA</strong></a></li>')
  })

  it('escapa & na URL do link', () => {
    const html = markdownToGutenberg('[busca](https://abx.com.br/?s=a&b=c)')
    expect(html).toContain('href="https://abx.com.br/?s=a&amp;b=c"')
  })

  it('não gera âncora para esquemas perigosos', () => {
    const html = markdownToGutenberg('[clique](javascript:alert(1))')
    expect(html).not.toContain('<a ')
  })

  it('converte imagem r2 em bloco wp:image com id da mídia do WordPress', () => {
    const md = 'Parágrafo antes.\n\n![Diagrama de rede](r2://articles/a1/corpo-1)\n\nParágrafo depois.'
    const html = markdownToGutenberg(md, {
      resolveImage: (src) =>
        src === 'r2://articles/a1/corpo-1'
          ? { id: 321, url: 'https://abx.com.br/wp-content/uploads/corpo-1.webp' }
          : null,
    })

    expect(html).toContain('<!-- wp:image {"id":321,"sizeSlug":"large","linkDestination":"none"} -->')
    expect(html).toContain(
      '<figure class="wp-block-image size-large"><img src="https://abx.com.br/wp-content/uploads/corpo-1.webp" alt="Diagrama de rede" class="wp-image-321"/></figure>',
    )
    expect(html).toContain('<p>Parágrafo antes.</p>')
    expect(html).toContain('<p>Parágrafo depois.</p>')
  })

  it('omite imagem r2 ainda não enviada ao WordPress', () => {
    const html = markdownToGutenberg('Texto.\n\n![Diagrama](r2://articles/a1/corpo-1)')
    expect(html).not.toContain('wp:image')
    expect(html).not.toContain('r2://')
  })

  it('converte imagem com URL http sem id', () => {
    const html = markdownToGutenberg('![Foto "externa"](https://abx.com.br/foto.webp)')
    expect(html).toContain('<!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->')
    expect(html).toContain('<img src="https://abx.com.br/foto.webp" alt="Foto &quot;externa&quot;"/>')
  })

  it('não engole a linha da imagem dentro do parágrafo anterior', () => {
    const html = markdownToGutenberg('Linha de texto\n![Foto](https://abx.com.br/foto.webp)')
    expect(html).toContain('<p>Linha de texto</p>')
    expect(html).toContain('wp:image')
  })
})
