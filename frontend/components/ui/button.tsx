import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

type ButtonVariant = 'default' | 'outline' | 'ghost'

const variants: Record<ButtonVariant, string> = {
  default: 'bg-blue-700 text-white hover:bg-blue-800',
  outline: 'border border-blue-200 bg-white text-blue-800 hover:bg-blue-50',
  ghost: 'text-blue-800 hover:bg-blue-50',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
  loadingText?: string
}

export function Button({
  className,
  variant = 'default',
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        loading && 'cursor-wait',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner size="sm" className="shrink-0 opacity-90" />}
      {loading && loadingText ? loadingText : children}
    </button>
  )
}

export function buttonClass(variant: ButtonVariant = 'default', className?: string) {
  return cn(
    'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-all duration-150 active:scale-[0.98]',
    variants[variant],
    className,
  )
}
