import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-ink/[0.07]', className)} aria-hidden />
}

export function ClientPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando cliente">
      <div className="flex items-end justify-between">
        <div className="space-y-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="flex gap-2 border-b border-line pb-2">
        {['w-28', 'w-20', 'w-24', 'w-24', 'w-20'].map((w, i) => (
          <Skeleton key={i} className={cn('h-7', w)} />
        ))}
      </div>
      <div className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

/** Linhas genéricas para listas e tabelas em carregamento. */
export function ListSkeleton({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div
      className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export function ReviewPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando artigo">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-80" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-[560px] rounded-xl" />
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
