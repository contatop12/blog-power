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
  /** Amostra de tinta à esquerda do texto. */
  dot?: boolean
  /** Anima a amostra — algo está acontecendo agora. */
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
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2 py-0.5 text-xs font-medium',
        t.soft,
        className,
      )}
    >
      {dot && (
        <StatusDot
          tone={tone}
          pulse={pulse}
          // Na tinta preta (fundo sólido) a amostra vira branca
          className={cn('size-1.5', tone === 'key' && '[&>span]:bg-white')}
        />
      )}
      {children}
    </span>
  )
}

/**
 * Amostra de cor. `square` (padrão) = tinta de etapa; `round` = sinal de estado
 * (conexão, pendência).
 */
export function StatusDot({
  tone,
  pulse = false,
  shape = 'square',
  className,
  label,
}: {
  tone: Tone
  pulse?: boolean
  shape?: 'square' | 'round'
  className?: string
  /** Quando informado, a amostra vira imagem acessível com esse rótulo. */
  label?: string
}) {
  const color = TONE_CLASSES[tone].dot
  const radius = shape === 'round' ? 'rounded-full' : 'rounded-[2px]'
  return (
    <span
      className={cn('relative inline-flex size-2 shrink-0', radius, className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={label}
    >
      {pulse && <span className={cn('absolute inset-0 animate-stage-pulse', radius, color)} />}
      <span className={cn('relative inline-flex size-full', radius, color)} />
    </span>
  )
}

/** Status do artigo com a tinta da etapa do pipeline. "Gerando" pulsa. */
export function ArticleStatusBadge({
  status,
  className,
}: {
  status: ArticleStatus
  className?: string
}) {
  const meta = ARTICLE_STATUS[status] ?? { label: status, stage: 'producao' as const }
  return (
    <Badge tone={STAGES[meta.stage].tone} dot pulse={status === 'gerando'} className={className}>
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
    <Badge tone={meta.tone} title={meta.title} className={cn('gap-1.5', className)}>
      <StatusDot tone={meta.tone} shape="round" className="size-1.5" />
      {meta.label}
    </Badge>
  )
}
