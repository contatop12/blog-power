'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'
import { isAuthenticated } from '@/lib/auth'

const PUBLIC = ['/login']

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const isPublic = PUBLIC.some((p) => pathname.startsWith(p))
    if (!isPublic && !isAuthenticated()) {
      router.replace('/login')
      return
    }
    if (isPublic && isAuthenticated() && pathname === '/login') {
      router.replace('/')
      return
    }
    setReady(true)
  }, [pathname, router])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center gap-2.5 text-sm text-muted">
        <Spinner className="text-brand" />
        Carregando…
      </div>
    )
  }

  return <>{children}</>
}
