'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Building2, FileText, LayoutDashboard, LogOut, Menu, X } from 'lucide-react'
import { clearStoredAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Painel', icon: LayoutDashboard },
  { href: '/clients', label: 'Clientes', icon: Building2 },
  { href: '/articles', label: 'Artigos', icon: FileText },
]

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export function BrandMark({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg">
      <span className="grid size-9 place-items-center rounded-[10px] bg-brand text-[13px] font-extrabold tracking-tight text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]">
        P12
      </span>
      <span className="leading-tight">
        <span
          className={cn(
            'block text-[15px] font-bold tracking-tight',
            tone === 'dark' ? 'text-white' : 'text-ink',
          )}
        >
          Publisher
        </span>
        <span className={cn('block text-xs', tone === 'dark' ? 'text-white/50' : 'text-muted')}>
          Conteúdo para WordPress
        </span>
      </span>
    </Link>
  )
}

function SidebarContent() {
  const pathname = usePathname()
  const router = useRouter()

  return (
    <div className="flex h-full flex-col px-4 py-5">
      <div className="px-1">
        <BrandMark />
      </div>

      <nav aria-label="Principal" className="mt-9 flex flex-col gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150',
                active
                  ? 'bg-white/[0.08] text-white before:absolute before:-left-4 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-brand'
                  : 'text-white/60 hover:bg-white/[0.05] hover:text-white',
              )}
            >
              <Icon
                className={cn(
                  'size-[18px] shrink-0 transition-colors',
                  active ? 'text-[#8FA8FF]' : 'text-white/40 group-hover:text-white/70',
                )}
                aria-hidden
              />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-white/[0.08] pt-4">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white"
          onClick={() => {
            clearStoredAuth()
            router.push('/login')
          }}
        >
          <LogOut className="size-[18px] text-white/40" aria-hidden />
          Sair
        </button>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Fecha o menu mobile ao navegar
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!drawerOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  if (pathname === '/login') return <>{children}</>

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-night lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <BrandMark tone="light" />
        <button
          type="button"
          className="grid size-10 place-items-center rounded-lg text-ink hover:bg-ink/[0.06]"
          aria-label="Abrir menu"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 animate-fade-in bg-night/50"
            aria-label="Fechar menu"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] animate-drawer-in bg-night shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-5 grid size-9 place-items-center rounded-lg text-white/60 hover:bg-white/[0.08] hover:text-white"
              aria-label="Fechar menu"
              onClick={() => setDrawerOpen(false)}
            >
              <X className="size-5" aria-hidden />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        {children}
      </main>
    </div>
  )
}
