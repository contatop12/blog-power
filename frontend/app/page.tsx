import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Publisher P12</h1>
        <p className="mt-2 text-zinc-600">
          Do briefing ao post agendado no WordPress — com revisão humana obrigatória.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/articles/new" className={buttonClass()}>
          Novo artigo
        </Link>
        <Link href="/clients" className={buttonClass('outline')}>
          Clientes
        </Link>
        <Link href="/clients/new" className={buttonClass('outline')}>
          Novo cliente
        </Link>
        <Link href="/articles" className={buttonClass('outline')}>
          Artigos
        </Link>
      </div>
    </div>
  )
}
