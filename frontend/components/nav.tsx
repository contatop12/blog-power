'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { clearStoredAuth, isAuthenticated } from '@/lib/auth'

const links = [
  { href: '/', label: 'Início' },
  { href: '/clients', label: 'Clientes' },
  { href: '/articles', label: 'Artigos' },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/login') return null

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-slate-900">
          Publisher <span className="text-blue-700">P12</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/')
            return (
              <Link
                key={l.href}
                href={l.href}
                className={active ? 'font-medium text-blue-700' : 'text-slate-600 hover:text-blue-700'}
              >
                {l.label}
              </Link>
            )
          })}
          {isAuthenticated() && (
            <button
              type="button"
              className="text-xs text-slate-500 underline hover:text-blue-700"
              onClick={() => {
                clearStoredAuth()
                router.push('/login')
              }}
            >
              Sair
            </button>
          )}
        </nav>
      </div>
    </header>
  )
}
