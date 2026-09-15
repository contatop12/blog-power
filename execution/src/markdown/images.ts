import type { ImagemCorpo } from '@publisher-p12/types'
import { normalizeText } from '../links/related.js'

/** Imagem gerada e ainda guardada no R2 — vira mídia do WordPress na publicação. */
export const R2_IMAGE_SCHEME = 'r2://'

const SECOES_SEM_IMAGEM = /^(faq|perguntas frequentes|duvidas frequentes|conclusao|consideracoes finais|referencias|fontes)/

const IMAGEM_GERADA_LINHA = /^\s*!\[[^\]]*\]\(r2:\/\/[^)\s]+\)\s*$/
const IMAGEM_R2 = /!\[([^\]]*)\]\((r2:\/\/[^)\s]+)\)/g

export interface ImagemParaInserir {
  secao: string
  src: string
  alt: string
}

export interface InsertImagesResult {
  markdown: string
  inseridas: string[]
  naoEncontradas: string[]
}

export interface R2ImageRef {
  src: string
  key: string
  alt: string
}

function h2s(markdown: string): Array<{ texto: string; linha: number }> {
  return markdown
    .split('\n')
    .map((linha, indice) => ({ match: /^##\s+(.+?)\s*#*\s*$/.exec(linha), indice }))
    .filter((l): l is { match: RegExpExecArray; indice: number } => l.match !== null)
    .map((l) => ({ texto: l.match[1].trim(), linha: l.indice }))
}

/** Seções H2 que podem receber imagem de apoio (sem FAQ, conclusão, referências). */
function secoesElegiveis(markdown: string): string[] {
  return h2s(markdown)
    .map((h) => h.texto)
    .filter((texto) => !SECOES_SEM_IMAGEM.test(normalizeText(texto)))
}

/** Distribui N imagens ao longo do artigo, sem repetir seção. */
export function pickImageSections(markdown: string, quantidade = 2): string[] {
  const secoes = secoesElegiveis(markdown)
  if (secoes.length === 0 || quantidade <= 0) return []

  const usados = new Set<number>()
  for (let i = 0; i < Math.min(quantidade, secoes.length); i += 1) {
    let indice = Math.min(Math.round(((i + 1) * secoes.length) / (quantidade + 1)), secoes.length - 1)
    if (usados.has(indice)) {
      const livre =
        [...Array(secoes.length).keys()].find((k) => k > indice && !usados.has(k)) ??
        [...Array(secoes.length).keys()].reverse().find((k) => !usados.has(k))
      if (livre === undefined) break
      indice = livre
    }
    usados.add(indice)
  }

  return [...usados].sort((a, b) => a - b).map((i) => secoes[i])
}

/**
 * Combina as seções sugeridas pelo Editor (quando existem de verdade no texto)
 * com a escolha automática, até a quantidade pedida.
 */
export function resolveImageSlots(
  markdown: string,
  doEditor: ImagemCorpo[] | undefined,
  contexto: { tema: string },
  quantidade = 2,
): ImagemCorpo[] {
  const porNome = new Map(secoesElegiveis(markdown).map((s) => [normalizeText(s), s]))
  const slots: ImagemCorpo[] = []
  const usadas = new Set<string>()

  for (const sugestao of doEditor ?? []) {
    if (slots.length >= quantidade) break
    const chave = normalizeText(sugestao?.secao ?? '')
    const secao = porNome.get(chave)
    if (!secao || usadas.has(chave) || !sugestao.prompt?.trim()) continue

    usadas.add(chave)
    slots.push({
      secao,
      prompt: sugestao.prompt.trim(),
      alt: sugestao.alt?.trim() || secao,
    })
  }

  for (const secao of pickImageSections(markdown, quantidade)) {
    if (slots.length >= quantidade) break
    const chave = normalizeText(secao)
    if (usadas.has(chave)) continue

    usadas.add(chave)
    slots.push({
      secao,
      prompt: `Editorial illustration for a B2B blog section titled "${secao}". Topic: ${contexto.tema}`,
      alt: `Ilustração: ${secao}`,
    })
  }

  return slots
}

function limparAlt(alt: string): string {
  return alt.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim()
}

/** Insere cada imagem logo após o primeiro parágrafo da seção indicada. */
export function insertImagesIntoMarkdown(
  markdown: string,
  imagens: ImagemParaInserir[],
): InsertImagesResult {
  const linhas = markdown.split('\n')
  const titulos = h2s(markdown)
  const inseridas: string[] = []
  const naoEncontradas: string[] = []
  const insercoes: Array<{ posicao: number; linha: string }> = []

  for (const imagem of imagens) {
    const alvo = titulos.find((t) => normalizeText(t.texto) === normalizeText(imagem.secao))
    if (!alvo) {
      naoEncontradas.push(imagem.secao)
      continue
    }

    let j = alvo.linha + 1
    while (j < linhas.length && linhas[j].trim() === '') j += 1

    let posicao = alvo.linha + 1
    if (j < linhas.length && !/^#{1,6}\s/.test(linhas[j])) {
      while (j < linhas.length && linhas[j].trim() !== '') j += 1
      posicao = j
    }

    insercoes.push({ posicao, linha: `![${limparAlt(imagem.alt)}](${imagem.src})` })
    inseridas.push(imagem.secao)
  }

  // De baixo para cima: inserir não desloca as posições ainda pendentes
  for (const { posicao, linha } of insercoes.sort((a, b) => b.posicao - a.posicao)) {
    linhas.splice(posicao, 0, '', linha)
  }

  return { markdown: linhas.join('\n'), inseridas, naoEncontradas }
}

/** Remove imagens geradas (r2://) — usado antes de regerar, para não duplicar. */
export function stripGeneratedImages(markdown: string): string {
  const saida: string[] = []
  for (const linha of markdown.split('\n')) {
    if (IMAGEM_GERADA_LINHA.test(linha)) {
      if (saida.length > 0 && saida[saida.length - 1].trim() === '') saida.pop()
      continue
    }
    saida.push(linha)
  }
  return saida.join('\n')
}

export function extractR2ImageRefs(markdown: string): R2ImageRef[] {
  return [...(markdown ?? '').matchAll(IMAGEM_R2)].map((m) => ({
    src: m[2],
    key: m[2].slice(R2_IMAGE_SCHEME.length),
    alt: m[1],
  }))
}
