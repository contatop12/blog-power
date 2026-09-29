import { cn } from '@/lib/utils'

/** Estado vazio: diz o que aparece aqui e como começar. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  /** Versão menor para dentro de painéis e tabelas. */
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'px-5 py-8' : 'rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-14',
        className,
      )}
    >
      {icon && (
        <span
          className={cn(
            'mb-3 inline-flex items-center justify-center rounded-lg border border-ink/15 bg-canvas text-ink',
            compact ? 'size-9 [&_svg]:size-4' : 'size-11 [&_svg]:size-5',
          )}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <p className={cn('font-display font-bold text-ink', compact ? 'text-base' : 'text-xl')}>{title}</p>
      {description && (
        <p className={cn('mt-1 max-w-sm text-muted', compact ? 'text-[13px]' : 'text-sm')}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
