/** Converte datetime-local para ISO UTC usando o fuso IANA do cliente. */
export function localDatetimeToUtcIso(localDatetime: string, timezone: string): string {
  const trimmed = localDatetime.trim()
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed).toISOString()
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) throw new Error('Data/hora inválida')

  const target = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  }

  let utcMs = Date.UTC(target.year, target.month - 1, target.day, target.hour, target.minute)

  for (let i = 0; i < 6; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date(utcMs))

    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
    let hour = get('hour')
    if (hour === 24) hour = 0

    const diffMinutes =
      (target.year - get('year')) * 525_600 +
      (target.month - get('month')) * 43_200 +
      (target.day - get('day')) * 1_440 +
      (target.hour - hour) * 60 +
      (target.minute - get('minute'))

    if (diffMinutes === 0) break
    utcMs += diffMinutes * 60_000
  }

  return new Date(utcMs).toISOString()
}

/** Converte ISO UTC para valor de input datetime-local no fuso do cliente. */
export function utcIsoToLocalDatetime(isoUtc: string, timezone: string): string {
  const date = new Date(isoUtc)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  let hour = get('hour')
  if (hour === '24') hour = '00'

  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}

/** Valor padrão para datetime-local: amanhã às 09:00 no fuso do cliente. */
export function defaultScheduleLocal(timezone: string): string {
  const tomorrow = new Date(Date.now() + 86_400_000)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(tomorrow)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '01'
  return `${get('year')}-${get('month')}-${get('day')}T09:00`
}

export function formatSchedulePreview(localDatetime: string, timezone: string): string {
  try {
    const utc = localDatetimeToUtcIso(localDatetime, timezone)
    return new Date(utc).toLocaleString('pt-BR', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return '—'
  }
}
