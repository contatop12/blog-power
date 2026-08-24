'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { buttonClass } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Article } from '@publisher-p12/types'

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.articles.list().then(setArticles).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Artigos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Para criar um artigo, abra o perfil do cliente.
          </p>
        </div>
        <Link href="/clients" className={buttonClass('outline')}>
          Ir para clientes
        </Link>
      </div>

      {loading && <p className="text-zinc-500">Carregando...</p>}

      <div className="grid gap-4">
        {articles.map((a) => (
          <Card key={a.id}>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{a.briefing?.tema ?? 'Sem título'}</CardTitle>
                <p className="mt-1 text-sm text-zinc-600">Status: {a.status}</p>
              </div>
              <Link href={`/articles/${a.id}/review`} className={buttonClass('outline', 'h-8 px-3 text-sm')}>
                Revisar
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
