import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0'

const variants: Record<ButtonVariant, string> = {
  // Tinta preta com um fio de ciano embaixo — o "registro" da ação principal
  default:
    'bg-ink text-white shadow-[inset_0_-2px_0_rgb(var(--cyan)),0_1px_2px_rgb(27_31_42/0.25)] hover:bg-night-soft',
  outline:
    'border border-ink/20 bg-surface text-ink hover:border-ink hover:bg-surface',
  ghost: 'text-muted hover:bg-ink/[0.06] hover:text-ink',
  danger: 'border border-spot/30 bg-surface text-[#B42318] hover:border-spot hover:bg-spot/[0.06]',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingText?: string
}

export function Button({
  className,
  variant = 'default',
  size = 'md',
  loading = false,
  loadingText,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, sizes[size], variants[variant], loading && 'cursor-wait', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="sm" className="shrink-0 opacity-90" />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}

/** Mesmo visual do Button para `<Link>` e `<a>`. */
export function buttonClass(
  variant: ButtonVariant = 'default',
  className?: string,
  size: ButtonSize = 'md',
) {
  return cn(base, sizes[size], variants[variant], className)
}
