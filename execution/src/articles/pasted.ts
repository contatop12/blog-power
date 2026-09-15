import type { Briefing } from '@publisher-p12/types'

export interface ParsedPastedArticle {
  conteudo_md: string
  briefing_patch: Partial<Briefing>
}

function cleanLine(value: string): string {
  return value.replace(/\r/g, '').trim()
}

function stripMarkdownEmphasis(value: string): string {
  return value.replace(/[*_`#]+/g, '').trim()
}

function normalizeSlug(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '')
}

function collectBulletValues(lines: string[], startIndex: number): { values: string[]; nextIndex: number } {
  const values: string[] = []
  let index = startIndex

  while (index < lines.length) {
    const raw = cleanLine(lines[index])
    if (!raw) {
      index += 1
      continue
    }
    if (!/^[-*]\s+/.test(raw)) break
    values.push(raw.replace(/^[-*]\s+/, '').trim())
    index += 1
  }

  return { values, nextIndex: index }
}

export function parsePastedArticle(input: string): ParsedPastedArticle {
  const normalized = input.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return { conteudo_md: '', briefing_patch: {} }
  }

  const marker = /\n---\n+#{2,3}\s*\**SEO do artigo\**/i
  const match = normalized.match(marker)
  const body = (match ? normalized.slice(0, match.index) : normalized).trim()
  const appendix = match ? normalized.slice((match.index ?? 0) + 5).trim() : ''

  const briefingPatch: Partial<Briefing> = {}

  if (!appendix) {
    return { conteudo_md: body, briefing_patch: briefingPatch }
  }

  const lines = appendix.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = cleanLine(lines[i])
    if (!line) continue

    const tema = line.match(/^\*\*Título SEO:\*\*\s*(.+)$/i)
    if (tema && !briefingPatch.tema) {
      briefingPatch.tema = stripMarkdownEmphasis(tema[1])
      continue
    }

    const kw = line.match(/^\*\*Palavra-chave principal:\*\*\s*(.+)$/i)
    if (kw && !briefingPatch.kw_principal) {
      briefingPatch.kw_principal = stripMarkdownEmphasis(kw[1])
      continue
    }

    const kws = line.match(/^\*\*Palavras-chave secundárias:\*\*\s*(.+)$/i)
    if (kws && !briefingPatch.kws_secundarias) {
      briefingPatch.kws_secundarias = stripMarkdownEmphasis(kws[1])
        .split(/[;,]/)
        .map((item) => item.trim())
        .filter(Boolean)
      continue
    }

    const intencao = line.match(/^\*\*Intenção de busca:\*\*\s*(.+)$/i)
    if (intencao && !briefingPatch.intencao) {
      briefingPatch.intencao = stripMarkdownEmphasis(intencao[1])
      continue
    }

    const slug = line.match(/^\*\*Slug recomendado:\*\*\s*(.+)$/i)
    if (slug) {
      const current = briefingPatch.observacoes ? `${briefingPatch.observacoes}\n` : ''
      briefingPatch.observacoes = `${current}Slug sugerido: /${normalizeSlug(stripMarkdownEmphasis(slug[1]))}`
      continue
    }

    const observacoes = line.match(/^\*\*Meta description:\*\*\s*(.+)$/i)
    if (observacoes) {
      const current = briefingPatch.observacoes ? `${briefingPatch.observacoes}\n` : ''
      briefingPatch.observacoes = `${current}Meta description sugerida: ${stripMarkdownEmphasis(observacoes[1])}`
      continue
    }

    if (/^\*\*Links internos recomendados:\*\*/i.test(line)) {
      const text = stripMarkdownEmphasis(line.replace(/^\*\*Links internos recomendados:\*\*/i, ''))
      const current = briefingPatch.observacoes ? `${briefingPatch.observacoes}\n` : ''
      briefingPatch.observacoes = `${current}Links internos sugeridos: ${text}`
      continue
    }

    if (/^\*\*Schema recomendado:\*\*/i.test(line)) {
      const text = stripMarkdownEmphasis(line.replace(/^\*\*Schema recomendado:\*\*/i, ''))
      const current = briefingPatch.observacoes ? `${briefingPatch.observacoes}\n` : ''
      briefingPatch.observacoes = `${current}Schema sugerido: ${text}`
      continue
    }

    if (/^\*\*Estratégia de conteúdo\*\*/i.test(line)) {
      const { values, nextIndex } = collectBulletValues(lines, i + 1)
      if (values.length > 0) {
        const current = briefingPatch.observacoes ? `${briefingPatch.observacoes}\n` : ''
        briefingPatch.observacoes = `${current}Estratégia: ${values.join(' ')}`
      }
      i = nextIndex - 1
    }
  }

  return { conteudo_md: body, briefing_patch: briefingPatch }
}
