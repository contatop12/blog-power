import { describe, expect, it } from 'vitest'
import { enforceInternalLinks, reconcileLinksInternos } from './enforce.js'

const INVENTARIO = [
  'https://abx.com.br/link-dedicado/',
  'https://abx.com.br/sla/',
  'https://abx.com.br/servicos/',
  'https://abx.com.br/firewall/',
]

function enforce(markdown: string, extra: Partial<Parameters<typeof enforceInternalLinks>[1]> = {}) {
  return enforceInternalLinks(markdown, {
    allowedUrls: INVENTARIO,
    dominio: 'abx.com.br',
    ...extra,
  })
}

describe('enforceInternalLinks', () => {
  it('mantém link interno do inventário, tolerando www e barra final', () => {
    const md = 'Contrate um [link dedicado](https://www.abx.com.br/link-dedicado) hoje.'
    const result = enforce(md)

    expect(result.markdown).toBe(md)
    expect(result.mantidos).toEqual([
      { url: 'https://www.abx.com.br/link-dedicado', ancora: 'link dedicado' },
    ])
    expect(result.removidos).toEqual([])
  })

  it('remove link interno inventado e preserva a âncora como texto', () => {
    const result = enforce('Leia o [guia de VPN](https://abx.com.br/vpn-inventada/).')

    expect(result.markdown).toBe('Leia o guia de VPN.')
    expect(result.removidos).toEqual([
      { url: 'https://abx.com.br/vpn-inventada/', ancora: 'guia de VPN', motivo: 'fora_do_inventario' },
    ])
  })

  it('não mexe em links externos nem em imagens', () => {
    const md = [
      'Fonte: [Anatel](https://www.gov.br/anatel/).',
      '![Diagrama de rede](https://abx.com.br/wp-content/uploads/rede.webp)',
    ].join('\n')

    const result = enforce(md)
    expect(result.markdown).toBe(md)
    expect(result.mantidos).toEqual([])
    expect(result.removidos).toEqual([])
  })

  it('mantém só a primeira ocorrência de cada URL', () => {
    const result = enforce(
      'Veja [SLA](https://abx.com.br/sla/) e depois [acordo de nível](https://abx.com.br/sla).',
    )

    expect(result.markdown).toBe('Veja [SLA](https://abx.com.br/sla/) e depois acordo de nível.')
    expect(result.removidos[0].motivo).toBe('duplicado')
  })

  it('remove link para o próprio artigo', () => {
    const result = enforce('Este [artigo](https://abx.com.br/firewall/) fala de firewall.', {
      selfUrl: 'https://abx.com.br/firewall',
    })

    expect(result.markdown).toBe('Este artigo fala de firewall.')
    expect(result.removidos[0].motivo).toBe('autolink')
  })

  it('corta links além do máximo, mantendo os primeiros', () => {
    const result = enforce(
      '[A](https://abx.com.br/sla/) [B](https://abx.com.br/servicos/) [C](https://abx.com.br/firewall/)',
      { maxLinks: 2 },
    )

    expect(result.markdown).toBe('[A](https://abx.com.br/sla/) [B](https://abx.com.br/servicos/) C')
    expect(result.removidos).toEqual([
      { url: 'https://abx.com.br/firewall/', ancora: 'C', motivo: 'excesso' },
    ])
  })

  it('resolve link relativo contra o domínio e grava a URL absoluta', () => {
    const result = enforce('Conheça nossos [serviços](/servicos/).')

    expect(result.markdown).toBe('Conheça nossos [serviços](https://abx.com.br/servicos/).')
    expect(result.mantidos[0].url).toBe('https://abx.com.br/servicos/')
  })

  it('remove links dentro de títulos', () => {
    const result = enforce('## Por que contratar [link dedicado](https://abx.com.br/link-dedicado/)')

    expect(result.markdown).toBe('## Por que contratar link dedicado')
    expect(result.removidos[0].motivo).toBe('titulo')
  })

  it('aceita domínio informado com protocolo e www', () => {
    const result = enforceInternalLinks('[SLA](https://abx.com.br/sla/)', {
      allowedUrls: INVENTARIO,
      dominio: 'https://www.abx.com.br/',
    })
    expect(result.mantidos).toHaveLength(1)
  })
})

describe('reconcileLinksInternos', () => {
  it('mantém a posição informada pelo Editor e descarta links removidos', () => {
    const result = reconcileLinksInternos(
      [
        { url: 'https://abx.com.br/sla/', ancora: 'SLA', posicao: 'H2 Garantias' },
        { url: 'https://abx.com.br/vpn-inventada/', ancora: 'VPN' },
      ],
      [
        { url: 'https://abx.com.br/sla', ancora: 'acordo de SLA' },
        { url: 'https://abx.com.br/servicos/', ancora: 'serviços' },
      ],
    )

    expect(result).toEqual([
      { url: 'https://abx.com.br/sla', ancora: 'acordo de SLA', posicao: 'H2 Garantias' },
      { url: 'https://abx.com.br/servicos/', ancora: 'serviços' },
    ])
  })
})
