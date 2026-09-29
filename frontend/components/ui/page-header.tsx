import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  back,
  meta,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** Link de volta exibido acima do título. */
  back?: { href: string; label: string }
  /** Linha extra abaixo da descrição (badges, domínio, etc). */
  meta?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0 max-w-3xl">
        {back && (
          <Link
            href={back.href}
            className="group mb-3 inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="font-display text-[36px] font-extrabold leading-[0.95] tracking-[-0.02em] text-ink sm:text-[46px]">
          {title}
        </h1>
        {description && <p className="mt-3 text-[15px] leading-relaxed text-muted">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
