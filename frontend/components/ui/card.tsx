import { cn } from '@/lib/utils'

/** Superfície com padding para formulários e blocos de conteúdo. */
export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border border-line bg-surface p-5 sm:p-6', className)}>
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
    <h2 className={cn('text-base font-semibold tracking-tight text-ink', className)}>{children}</h2>
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
    <section className={cn('overflow-hidden rounded-xl border border-line bg-surface', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <span className="text-muted [&_svg]:size-4">{icon}</span>}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
            {description && <p className="text-[13px] leading-snug text-muted">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className={cn('overflow-x-auto', bodyClassName)}>{children}</div>
      {footer && <footer className="border-t border-line px-5 py-3 text-sm">{footer}</footer>}
    </section>
  )
}
