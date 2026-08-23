import type { EvolutionConfig } from '../settings/store.js'

export interface PublishNotification {
  clientName: string
  articleTitle: string
  wpUrl: string
  agendadoPara: string
}

export async function sendEvolutionGroupMessage(
  config: EvolutionConfig,
  message: string,
): Promise<void> {
  const base = config.apiUrl.replace(/\/$/, '')
  const url = `${base}/message/sendText/${encodeURIComponent(config.instance)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.apiKey,
    },
    body: JSON.stringify({
      number: config.groupId,
      text: message,
      delay: 500,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Evolution API ${res.status}: ${err}`)
  }
}

export function formatPublishNotification(data: PublishNotification): string {
  const quando = new Date(data.agendadoPara).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
  })
  return [
    '📰 *Publisher P12 — Publicação agendada*',
    '',
    `*Cliente:* ${data.clientName}`,
    `*Artigo:* ${data.articleTitle}`,
    `*Agendado para:* ${quando}`,
    `*URL:* ${data.wpUrl}`,
  ].join('\n')
}

export async function notifyPublishScheduled(
  config: EvolutionConfig,
  data: PublishNotification,
): Promise<void> {
  const message = formatPublishNotification(data)
  await sendEvolutionGroupMessage(config, message)
}

export async function testEvolutionConnection(config: EvolutionConfig): Promise<boolean> {
  const base = config.apiUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/instance/connectionState/${encodeURIComponent(config.instance)}`, {
    headers: { apikey: config.apiKey },
  })
  return res.ok
}
