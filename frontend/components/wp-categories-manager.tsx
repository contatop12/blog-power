'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { WpCategoryFormDialog } from '@/components/wp-category-form-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import type { WpCategoryOption } from '@publisher-p12/types'

interface WpCategoriesManagerProps {
  clientId: string
}

export function WpCategoriesManager({ clientId }: WpCategoriesManagerProps) {
  const [categories, setCategories] = useState<WpCategoryOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WpCategoryOption | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.clients.wpCategories(clientId)
      setCategories(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar categorias')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  async function handleDelete(category: WpCategoryOption) {
    const posts = category.count ?? 0
    const msg =
      posts > 0
        ? `A categoria "${category.name}" tem ${posts} post(s). Excluir mesmo assim?`
        : `Excluir a categoria "${category.name}"?`
    if (!window.confirm(msg)) return

    setDeletingId(category.id)
    setError(null)
    try {
      await api.clients.deleteWpCategory(clientId, category.id)
      setCategories((prev) => prev.filter((c) => c.id !== category.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao excluir categoria')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Categorias WordPress</CardTitle>
            <p className="mt-2 text-sm text-slate-600">
              Gerencie as categorias editoriais do blog. Alterações são aplicadas diretamente no
              WordPress do cliente.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 px-2 text-slate-600"
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="h-4 w-4" />
            Nova categoria
          </Button>
        </div>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Spinner size="sm" className="text-blue-700" />
            Carregando categorias...
          </div>
        ) : categories.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">Nenhuma categoria encontrada no WordPress.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {cat.parent ? '↳ ' : ''}
                    {cat.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    /{cat.slug}
                    {typeof cat.count === 'number' ? ` · ${cat.count} post(s)` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 hover:text-blue-700"
                    title="Editar"
                    aria-label={`Editar ${cat.name}`}
                    onClick={() => {
                      setEditing(cat)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    title="Excluir"
                    aria-label={`Excluir ${cat.name}`}
                    disabled={deletingId === cat.id}
                    onClick={() => handleDelete(cat)}
                  >
                    {deletingId === cat.id ? (
                      <Spinner size="sm" className="text-red-600" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <WpCategoryFormDialog
        clientId={clientId}
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditing(null)
        }}
        editing={editing}
        onSaved={async () => {
          await loadCategories()
        }}
      />
    </>
  )
}
