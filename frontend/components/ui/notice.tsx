import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type NoticeTone = 'info' | 'success' | 'warning' | 'danger'

const tones: Record<NoticeTone, { box: string; icon: React.ReactNode }> = {
  info: {
    box: 'border-brand/20 bg-brand-soft/70 text-ink [&_[data-icon]]:text-brand',
    icon: <Info />,
  },
  success: {
    box: 'border-emerald-200 bg-emerald-50 text-emerald-900 [&_[data-icon]]:text-emerald-600',
    icon: <CheckCircle2 />,
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-950 [&_[data-icon]]:text-amber-600',
    icon: <AlertTriangle />,
  },
  danger: {
    box: 'border-red-200 bg-red-50 text-red-900 [&_[data-icon]]:text-red-600',
    icon: <XCircle />,
  },
}

/** Mensagem em bloco: erro, aviso, sucesso ou informação — com ação opcional. */
export function Notice({
  tone = 'info',
  title,
  action,
  className,
  children,
}: {
  tone?: NoticeTone
  title?: React.ReactNode
  action?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  const t = tones[tone]
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-xl border px-4 py-3 text-sm', t.box, className)}
    >
      <span data-icon className="mt-0.5 shrink-0 [&_svg]:size-4" aria-hidden>
        {t.icon}
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5 opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
