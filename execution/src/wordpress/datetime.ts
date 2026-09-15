/** Converte datetime-local (sem fuso) para date_gmt UTC exigido pelo WordPress. */
export function localDatetimeToDateGmt(localDatetime: string, timezone: string): string {
  const trimmed = localDatetime.trim()
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const date = new Date(trimmed)
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Data de agendamento inválida: ${localDatetime}`)
    }
    return date.toISOString().replace(/\.\d{3}Z$/, '')
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) {
    throw new Error(`Formato de data inválido (use YYYY-MM-DDTHH:mm): ${localDatetime}`)
  }

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

  return new Date(utcMs).toISOString().replace(/\.\d{3}Z$/, '')
}

export function isScheduledInFuture(dateGmt: string, bufferMs = 120_000): boolean {
  const ms = new Date(`${dateGmt}Z`).getTime()
  return ms > Date.now() + bufferMs
}
