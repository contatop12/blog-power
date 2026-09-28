import type { ArticleStatus, ConnectionStatus } from '@publisher-p12/types'
import { cn } from '@/lib/utils'
import {
  ARTICLE_STATUS,
  CONNECTION_STATUS,
  STAGES,
  TONE_CLASSES,
  type Tone,
} from '@/lib/status'

export function Badge({
  tone = 'neutral',
  dot = false,
  pulse = false,
  className,
  title,
  children,
}: {
  tone?: Tone
  /** Ponto colorido à esquerda do texto. */
  dot?: boolean
  /** Anima o ponto — algo está acontecendo agora. */
  pulse?: boolean
  className?: string
  title?: string
  children: React.ReactNode
}) {
  const t = TONE_CLASSES[tone]
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        t.soft,
        className,
      )}
    >
      {dot && <StatusDot tone={tone} pulse={pulse} className="size-1.5" />}
      {children}
    </span>
  )
}

export function StatusDot({
  tone,
  pulse = false,
  className,
  label,
}: {
  tone: Tone
  pulse?: boolean
  className?: string
  /** Quando informado, o ponto vira imagem acessível com esse rótulo. */
  label?: string
}) {
  const color = TONE_CLASSES[tone].dot
  return (
    <span
      className={cn('relative inline-flex size-2 shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
    >
      {pulse && (
        <span className={cn('absolute inset-0 animate-stage-pulse rounded-full', color)} />
      )}
      <span className={cn('relative inline-flex size-full rounded-full', color)} />
    </span>
  )
}

/** Status do artigo com a cor da etapa do pipeline. "Gerando" pulsa. */
export function ArticleStatusBadge({
  status,
  className,
}: {
  status: ArticleStatus
  className?: string
}) {
  const meta = ARTICLE_STATUS[status] ?? { label: status, stage: 'producao' as const }
  return (
    <Badge
      tone={STAGES[meta.stage].tone}
      dot
      pulse={status === 'gerando'}
      className={className}
    >
      {meta.label}
    </Badge>
  )
}

export function ConnectionBadge({
  status,
  className,
}: {
  status: ConnectionStatus
  className?: string
}) {
  const meta = CONNECTION_STATUS[status]
  return (
    <Badge tone={meta.tone} dot title={meta.title} className={className}>
      {meta.label}
    </Badge>
  )
}
