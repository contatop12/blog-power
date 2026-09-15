import { cn } from '@/lib/utils'

interface SpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'h-3.5 w-3.5 border-[1.5px]',
  md: 'h-4 w-4 border-2',
  lg: 'h-6 w-6 border-2',
} as const

export function Spinner({ className, size = 'md' }: SpinnerProps) {
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-current border-r-transparent',
        sizes[size],
        className,
      )}
      role="status"
      aria-label="Carregando"
    />
  )
}
