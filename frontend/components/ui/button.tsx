import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

type ButtonVariant = 'default' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md'

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0'

const variants: Record<ButtonVariant, string> = {
  default:
    'bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(14_27_61/0.25)] hover:bg-brand-strong',
  outline:
    'border border-line-strong bg-surface text-ink shadow-[0_1px_0_rgb(14_27_61/0.04)] hover:border-brand/40 hover:bg-brand-soft hover:text-brand-strong',
  ghost: 'text-muted hover:bg-ink/[0.06] hover:text-ink',
  danger: 'border border-red-200 bg-surface text-red-700 hover:border-red-300 hover:bg-red-50',
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
