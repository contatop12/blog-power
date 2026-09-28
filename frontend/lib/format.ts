/** Data e hora curtas em pt-BR: 28/09/2026 14:30. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
]

/** "há 2 horas", "em 3 dias", "agora". Use com `title={formatDateTime(v)}` para a data exata. */
export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return '—'
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return value
  const diff = (time - now) / 1000
  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diff) >= seconds) return relative.format(Math.round(diff / seconds), unit)
  }
  return 'agora'
}
