import Link from 'next/link'
import { buttonClass } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Publisher P12</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Do briefing ao post agendado no WordPress — com revisão humana obrigatória. Artigos são
          criados a partir do perfil de cada cliente.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/clients" className={buttonClass()}>
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
