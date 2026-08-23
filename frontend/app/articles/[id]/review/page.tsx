'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import type { Article } from '@publisher-p12/types'

export default function ReviewPage() {
  const params = useParams()
  const id = params.id as string
  const [article, setArticle] = useState<Article | null>(null)
  const [md, setMd] = useState('')

  useEffect(() => {
    if (!id) return
    api.articles.get(id).then((a) => {
      setArticle(a)
      setMd(a.conteudo_md ?? '')
    })
  }, [id])

  if (!article) {
    return <p className="text-zinc-500">Carregando artigo...</p>
  }

  const seo = article.seo
  const titleLen = seo?.titulo_seo?.length ?? 0
  const metaLen = seo?.meta_description?.length ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Revisão</h1>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm">{article.status}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Conteúdo (Markdown)</CardTitle>
          <textarea
            className="mt-4 h-[480px] w-full rounded-md border border-zinc-300 p-3 font-mono text-sm"
            value={md}
            onChange={(e) => setMd(e.target.value)}
          />
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => api.articles.update(id, { conteudo_md: md })}
          >
            Salvar rascunho
          </Button>
        </Card>

        <Card>
          <CardTitle>Painel SEO</CardTitle>
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="font-medium">Title SEO ({titleLen} chars)</p>
              <p className={titleLen >= 50 && titleLen <= 60 ? 'text-green-700' : 'text-amber-700'}>
                {seo?.titulo_seo ?? '—'}
              </p>
            </div>
            <div>
              <p className="font-medium">Meta description ({metaLen} chars)</p>
              <p className={metaLen >= 140 && metaLen <= 160 ? 'text-green-700' : 'text-amber-700'}>
                {seo?.meta_description ?? '—'}
              </p>
            </div>
            <div>
              <p className="font-medium">Slug</p>
              <p>{seo?.slug ?? '—'}</p>
            </div>
            <div>
              <p className="font-medium">Links internos</p>
              <ul className="mt-1 space-y-1">
                {(seo?.links_internos ?? []).map((l) => (
                  <li key={l.url} className="text-xs">
                    {l.status_validacao === 200 ? '✅' : '❌'} {l.ancora} → {l.url}
                  </li>
                ))}
              </ul>
            </div>
            {article.imagem_url && (
              <div>
                <p className="font-medium">Imagem destacada</p>
                <p className="text-xs text-zinc-500">{article.imagem_alt}</p>
                <Button
                  className="mt-2"
                  variant="outline"
                  onClick={() => api.articles.regenerateImage(id)}
                >
                  Regerar imagem
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Publicação</CardTitle>
        <p className="mt-2 text-sm text-zinc-600">
          Publicar fica desabilitado enquanto houver link interno inválido (scaffold: validação na API).
        </p>
        <Button
          className="mt-4"
          disabled={
            (seo?.links_internos ?? []).some((l) => l.status_validacao !== 200 && l.status_validacao !== undefined)
          }
          onClick={() =>
            api.articles.publish(id, {
              categoria_ids: [],
              tag_ids: [],
              agendado_para: new Date(Date.now() + 86400000).toISOString(),
            })
          }
        >
          Publicar no WordPress
        </Button>
      </Card>
    </div>
  )
}
