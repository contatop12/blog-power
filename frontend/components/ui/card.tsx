import { cn } from '@/lib/utils'

export function Card({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-lg border border-zinc-200 bg-white p-6 shadow-sm', className)}>
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
  return <h2 className={cn('text-lg font-semibold', className)}>{children}</h2>
}
