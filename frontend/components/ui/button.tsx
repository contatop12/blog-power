import { cn } from '@/lib/utils'

type ButtonVariant = 'default' | 'outline' | 'ghost'

const variants: Record<ButtonVariant, string> = {
  default: 'bg-blue-700 text-white hover:bg-blue-800',
  outline: 'border border-blue-200 bg-white text-blue-800 hover:bg-blue-50',
  ghost: 'text-blue-800 hover:bg-blue-50',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

export function Button({ className, variant = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}

export function buttonClass(variant: ButtonVariant = 'default', className?: string) {
  return cn(
    'inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors',
    variants[variant],
    className,
  )
}
