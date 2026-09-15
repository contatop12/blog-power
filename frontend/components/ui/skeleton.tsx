import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-200/80', className)}
      aria-hidden
    />
  )
}

export function ClientPageSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy="true" aria-label="Carregando cliente">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="flex gap-2 border-b border-zinc-200 pb-0">
        <Skeleton className="mb-2 h-8 w-36" />
        <Skeleton className="mb-2 h-8 w-24" />
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm space-y-5">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-5 sm:grid-cols-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}
