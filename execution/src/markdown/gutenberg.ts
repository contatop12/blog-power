/**
 * Conversor Markdown → blocos Gutenberg (PRD §8.4)
 * Suporta: heading, paragraph, list, list-item, quote, separator
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapBlock(blockName: string, attrs: Record<string, unknown> | null, innerHtml: string): string {
  const attrJson = attrs ? ` ${JSON.stringify(attrs)}` : ''
  return `<!-- wp:${blockName}${attrJson} -->\n${innerHtml}\n<!-- /wp:${blockName} -->`
}

function parseInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

function headingBlock(level: number, text: string): string {
  const tag = `h${level}`
  return wrapBlock('heading', { level }, `<${tag}>${parseInline(text)}</${tag}>`)
}

function paragraphBlock(text: string): string {
  return wrapBlock('paragraph', null, `<p>${parseInline(text)}</p>`)
}

function listBlock(items: string[], ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul'
  const listItems = items
    .map((item) =>
      wrapBlock('list-item', null, `<li>${parseInline(item)}</li>`),
    )
    .join('\n')
  return wrapBlock('list', ordered ? { ordered: true } : null, `<${tag}>\n${listItems}\n</${tag}>`)
}

function quoteBlock(text: string): string {
  return wrapBlock('quote', null, `<blockquote class="wp-block-quote"><p>${parseInline(text)}</p></blockquote>`)
}

function separatorBlock(): string {
  return wrapBlock('separator', null, '<hr class="wp-block-separator has-alpha-channel-opacity"/>')
}

export function markdownToGutenberg(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i++
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (headingMatch) {
      const level = headingMatch[1].length
      blocks.push(headingBlock(level, headingMatch[2]))
      i++
      continue
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      blocks.push(separatorBlock())
      i++
      continue
    }

    if (trimmed.startsWith('> ')) {
      blocks.push(quoteBlock(trimmed.slice(2)))
      i++
      continue
    }

    const ulMatch = /^[-*]\s+(.+)$/.exec(trimmed)
    if (ulMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const m = /^[-*]\s+(.+)$/.exec(lines[i].trim())
        if (!m) break
        items.push(m[1])
        i++
      }
      blocks.push(listBlock(items, false))
      continue
    }

    const olMatch = /^\d+\.\s+(.+)$/.exec(trimmed)
    if (olMatch) {
      const items: string[] = []
      while (i < lines.length) {
        const m = /^\d+\.\s+(.+)$/.exec(lines[i].trim())
        if (!m) break
        items.push(m[1])
        i++
      }
      blocks.push(listBlock(items, true))
      continue
    }

    const paraLines: string[] = [trimmed]
    i++
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|[-*]\s|\d+\.\s|>|---|\*\*\*)/.test(lines[i].trim())) {
      paraLines.push(lines[i].trim())
      i++
    }
    blocks.push(paragraphBlock(paraLines.join(' ')))
  }

  return blocks.join('\n\n')
}
