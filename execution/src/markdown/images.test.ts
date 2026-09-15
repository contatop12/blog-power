import { describe, expect, it } from 'vitest'
import {
  extractR2ImageRefs,
  insertImagesIntoMarkdown,
  pickImageSections,
  resolveImageSlots,
  stripGeneratedImages,
} from './images.js'

const ARTIGO = `# Link dedicado para empresas

Introdução do artigo.

## O que é link dedicado

Link dedicado é uma conexão exclusiva.
Segunda linha do mesmo parágrafo.

Outro parágrafo da seção.

## Vantagens para a operação

Banda simétrica e SLA.

## Como escolher o fornecedor

Critérios de escolha.

## Custos envolvidos

Fatores de preço.

## Perguntas frequentes

### Link dedicado cai?

Raramente.

## Conclusão

Resumo final.`

describe('pickImageSections', () => {
  it('distribui as imagens pelas seções e ignora FAQ e conclusão', () => {
    expect(pickImageSections(ARTIGO, 2)).toEqual([
      'Vantagens para a operação',
      'Custos envolvidos',
    ])
  })

  it('não repete seção quando há menos seções que imagens', () => {
    expect(pickImageSections('## Única seção\n\nTexto.', 2)).toEqual(['Única seção'])
  })

  it('devolve vazio sem H2', () => {
    expect(pickImageSections('# Só título\n\nTexto.', 2)).toEqual([])
  })
})

describe('resolveImageSlots', () => {
  it('usa as seções do Editor que existem e completa com as automáticas', () => {
    const slots = resolveImageSlots(
      ARTIGO,
      [
        { secao: 'como escolher o FORNECEDOR', prompt: 'vendor comparison', alt: 'Comparação' },
        { secao: 'Seção inventada', prompt: 'x', alt: 'y' },
      ],
      { tema: 'Link dedicado' },
      2,
    )

    expect(slots).toHaveLength(2)
    expect(slots[0]).toEqual({
      secao: 'Como escolher o fornecedor',
      prompt: 'vendor comparison',
      alt: 'Comparação',
    })
    expect(slots[1].secao).toBe('Vantagens para a operação')
    expect(slots[1].alt).toBeTruthy()
    expect(slots[1].prompt).toContain('Vantagens para a operação')
  })

  it('não usa a mesma seção duas vezes', () => {
    const slots = resolveImageSlots(
      ARTIGO,
      [
        { secao: 'Custos envolvidos', prompt: 'a', alt: 'a' },
        { secao: 'Custos envolvidos', prompt: 'b', alt: 'b' },
      ],
      { tema: 'Link dedicado' },
      2,
    )
    expect(new Set(slots.map((s) => s.secao)).size).toBe(slots.length)
  })
})

describe('insertImagesIntoMarkdown', () => {
  it('insere a imagem depois do primeiro parágrafo da seção', () => {
    const { markdown, inseridas } = insertImagesIntoMarkdown(ARTIGO, [
      { secao: 'O que é link dedicado', src: 'r2://articles/a1/corpo-1', alt: 'Diagrama de conexão' },
    ])

    expect(inseridas).toEqual(['O que é link dedicado'])
    expect(markdown).toContain(
      'Segunda linha do mesmo parágrafo.\n\n![Diagrama de conexão](r2://articles/a1/corpo-1)\n\nOutro parágrafo da seção.',
    )
  })

  it('reporta seções não encontradas sem alterar o texto', () => {
    const { markdown, naoEncontradas } = insertImagesIntoMarkdown(ARTIGO, [
      { secao: 'Não existe', src: 'r2://x', alt: 'x' },
    ])
    expect(naoEncontradas).toEqual(['Não existe'])
    expect(markdown).toBe(ARTIGO)
  })

  it('limpa colchetes e quebras de linha do ALT', () => {
    const { markdown } = insertImagesIntoMarkdown(ARTIGO, [
      { secao: 'Custos envolvidos', src: 'r2://c', alt: 'Tabela [preços]\nmensais' },
    ])
    expect(markdown).toContain('![Tabela preços mensais](r2://c)')
  })

  it('insere várias imagens mantendo a ordem do texto', () => {
    const { markdown } = insertImagesIntoMarkdown(ARTIGO, [
      { secao: 'Custos envolvidos', src: 'r2://2', alt: 'Dois' },
      { secao: 'Vantagens para a operação', src: 'r2://1', alt: 'Um' },
    ])
    expect(markdown.indexOf('r2://1')).toBeLessThan(markdown.indexOf('r2://2'))
  })
})

describe('stripGeneratedImages / extractR2ImageRefs', () => {
  const comImagens = insertImagesIntoMarkdown(ARTIGO, [
    { secao: 'Vantagens para a operação', src: 'r2://articles/a1/corpo-1', alt: 'Um' },
    { secao: 'Custos envolvidos', src: 'r2://articles/a1/corpo-2', alt: 'Dois' },
  ]).markdown

  it('remove só as imagens geradas, voltando ao texto original', () => {
    const md = `${comImagens}\n\n![Externa](https://abx.com.br/foto.webp)`
    expect(stripGeneratedImages(md)).toBe(`${ARTIGO}\n\n![Externa](https://abx.com.br/foto.webp)`)
  })

  it('lista as referências r2 com chave e ALT', () => {
    expect(extractR2ImageRefs(comImagens)).toEqual([
      { src: 'r2://articles/a1/corpo-1', key: 'articles/a1/corpo-1', alt: 'Um' },
      { src: 'r2://articles/a1/corpo-2', key: 'articles/a1/corpo-2', alt: 'Dois' },
    ])
  })
})
