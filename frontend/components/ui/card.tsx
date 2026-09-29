import { cn } from '@/lib/utils'

/** Folha: superfície com padding para formulários e blocos de conteúdo. */
export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface p-5 shadow-[0_1px_0_rgb(27_31_42/0.05)] sm:p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2 className={cn('font-display text-[19px] font-bold leading-tight text-ink', className)}>
      {children}
    </h2>
  )
}

export function CardDescription({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <p className={cn('mt-1 text-sm text-muted', className)}>{children}</p>
}

/**
 * Painel com cabeçalho (título, descrição, ação) e corpo sem padding —
 * para tabelas e listas que encostam na borda.
 */
export function Panel({
  title,
  description,
  icon,
  action,
  footer,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  action?: React.ReactNode
  footer?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_0_rgb(27_31_42/0.05)]',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon && <span className="mt-0.5 text-muted [&_svg]:size-4">{icon}</span>}
          <div className="min-w-0">
            <h2 className="font-display text-[19px] font-bold leading-tight text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={cn('overflow-x-auto', bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-line px-5 py-3 text-sm">{footer}</footer>}
    </section>
  )
}
