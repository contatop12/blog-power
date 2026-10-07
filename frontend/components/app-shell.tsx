'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Building2, FileText, LayoutDashboard, LogOut } from 'lucide-react'
import { RegistrationMark } from '@/components/ui/print'
import { queries } from '@/lib/api'
import { clearStoredAuth, isAuthenticated } from '@/lib/auth'
import { prefetchForHref } from '@/lib/prefetch'
import { prefetchQuery } from '@/lib/query'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Painel', icon: LayoutDashboard },
  { href: '/clients', label: 'Clientes', icon: Building2 },
  { href: '/articles', label: 'Artigos', icon: FileText },
]

/** As quatro tintas de processo, em ordem — assinatura visual do trilho. */
const INKS = ['bg-process-cyan', 'bg-process-magenta', 'bg-process-yellow', 'bg-white']

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

/** Símbolo + nome. `dark` para fundo escuro (trilho, login), `light` para papel. */
export function BrandMark({ tone = 'dark', compact = false }: { tone?: 'dark' | 'light'; compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg" aria-label="Publisher P12, ir para o painel">
      <RegistrationMark className={cn('size-8 shrink-0', tone === 'dark' ? 'text-white' : 'text-ink')} />
      {!compact && (
        <span
          className={cn(
            'font-display text-[22px] font-black leading-none tracking-[-0.01em]',
            tone === 'dark' ? 'text-white' : 'text-ink',
          )}
        >
          Publisher<span className="text-process-cyan">.</span>
        </span>
      )}
    </Link>
  )
}

function useLogout() {
  const router = useRouter()
  return () => {
    clearStoredAuth()
    router.push('/login')
  }
}

function Rail() {
  const pathname = usePathname()
  const logout = useLogout()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[92px] flex-col items-center bg-night py-5 lg:flex">
      <Link href="/" className="flex flex-col items-center gap-1.5 rounded-lg" aria-label="Publisher P12, ir para o painel">
        <RegistrationMark className="size-9 text-white" />
        <span className="font-display text-[13px] font-black tracking-wide text-white/80">P12</span>
      </Link>

      <nav aria-label="Principal" className="mt-10 flex w-full flex-col gap-1.5 px-3">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex flex-col items-center gap-1.5 rounded-lg py-2.5 text-[11.5px] font-semibold transition-colors duration-150',
                active ? 'bg-white text-ink' : 'text-white/55 hover:bg-white/[0.07] hover:text-white',
              )}
            >
              <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              {label}
              {active && (
                <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-process-cyan" aria-hidden />
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-5">
        {/* Tira de controle: as quatro tintas */}
        <span className="grid grid-cols-2 gap-1" aria-hidden>
          {INKS.map((c) => (
            <span key={c} className={cn('size-2.5 rounded-[2px]', c)} />
          ))}
        </span>
        <button
          type="button"
          onClick={logout}
          className="flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-[11.5px] font-semibold text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white"
        >
          <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
          Sair
        </button>
      </div>
    </aside>
  )
}

function MobileChrome() {
  const pathname = usePathname()
  const logout = useLogout()

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/90 px-4 backdrop-blur lg:hidden">
        <BrandMark tone="light" />
        <button
          type="button"
          onClick={logout}
          className="grid size-10 place-items-center rounded-lg text-muted hover:bg-ink/[0.06] hover:text-ink"
          aria-label="Sair"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </header>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11.5px] font-semibold transition-colors',
                active ? 'text-ink' : 'text-subtle',
              )}
            >
              {active && <span className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-ink" aria-hidden />}
              <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

/**
 * Hover ou foco em qualquer link interno já busca os dados da tela de destino,
 * e as listas do menu chegam logo depois da primeira tela.
 */
function IntentPrefetch() {
  useEffect(() => {
    if (!isAuthenticated()) return

    function onIntent(e: Event) {
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null
      const href = link?.getAttribute('href')
      if (href?.startsWith('/')) prefetchForHref(href)
    }
    document.addEventListener('pointerover', onIntent, { passive: true })
    document.addEventListener('focusin', onIntent)

    const idle = window.setTimeout(() => {
      prefetchQuery(queries.clients())
      prefetchQuery(queries.articles())
    }, 1500)

    return () => {
      document.removeEventListener('pointerover', onIntent)
      document.removeEventListener('focusin', onIntent)
      window.clearTimeout(idle)
    }
  }, [])

  return null
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === '/login') return <>{children}</>

  return (
    <div className="min-h-dvh lg:pl-[92px]">
      <IntentPrefetch />
      <Rail />
      <MobileChrome />
      <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-7 sm:px-6 lg:px-12 lg:pb-16 lg:pt-12">
        {children}
      </main>
    </div>
  )
}
