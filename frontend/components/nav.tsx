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
    <header
      className="border-b"
      style={{ borderColor: 'var(--mist)', background: 'var(--paper-elevated)' }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-lg font-semibold" style={{ color: 'var(--ink)' }}>
          Publisher <span style={{ color: 'var(--copper)' }}>P12</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors"
              style={{
                color: pathname === l.href || pathname.startsWith(l.href + '/')
                  ? 'var(--copper)'
                  : 'var(--text-muted)',
              }}
            >
              {l.label}
            </Link>
          ))}
          {isAuthenticated() && (
            <button
              type="button"
              className="text-xs underline"
              style={{ color: 'var(--text-muted)' }}
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
