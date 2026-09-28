'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CornerDownRight, Folder, Pencil, Plus, Tags, Trash2 } from 'lucide-react'
import { WpCategoryFormDialog } from '@/components/wp-category-form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { WpCategoryOption } from '@publisher-p12/types'

interface WpCategoriesManagerProps {
  clientId: string
}

interface CategoryRow {
  category: WpCategoryOption
  depth: number
}

function postsLabel(count: number): string {
  if (count === 0) return 'Sem posts'
  return `${count.toLocaleString('pt-BR')} ${count === 1 ? 'post' : 'posts'}`
}

/** Ordena como árvore (mãe seguida das filhas), mantendo a ordem do WordPress entre irmãs. */
function asTree(categories: WpCategoryOption[]): CategoryRow[] {
  const ids = new Set(categories.map((c) => c.id))
  const byParent = new Map<number, WpCategoryOption[]>()
  for (const c of categories) {
    const parent = c.parent && ids.has(c.parent) ? c.parent : 0
    byParent.set(parent, [...(byParent.get(parent) ?? []), c])
  }

  const rows: CategoryRow[] = []
  const seen = new Set<number>()
  const walk = (parent: number, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      if (seen.has(c.id)) continue
      seen.add(c.id)
      rows.push({ category: c, depth })
      walk(c.id, depth + 1)
    }
  }
  walk(0, 0)
  // Hierarquia circular não deveria existir no WP, mas nenhuma categoria some da lista
  for (const c of categories) if (!seen.has(c.id)) rows.push({ category: c, depth: 0 })
  return rows
}

function CategoriesSkeleton() {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Carregando categorias">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  )
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

  const rows = useMemo(() => asTree(categories), [categories])

  async function handleDelete(category: WpCategoryOption) {
    const posts = category.count ?? 0
    const msg =
      posts > 0
        ? `Excluir a categoria "${category.name}" do WordPress?\n\nEla tem ${postsLabel(posts).toLowerCase()}. Os posts não são apagados; os que ficarem sem categoria vão para a categoria padrão do site.`
        : `Excluir a categoria "${category.name}" do WordPress?`
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

  function openCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  const firstLoad = loading && categories.length === 0
  const loadFailed = Boolean(error) && !loading && categories.length === 0

  return (
    <>
      <Panel
        icon={<Tags />}
        title={
          <span className="flex items-center gap-2">
            Categorias do blog
            {!firstLoad && categories.length > 0 && (
              <Badge className="tabular-nums">{categories.length}</Badge>
            )}
          </span>
        }
        description="As categorias do WordPress do cliente. Cada artigo publicado entra em uma delas, e o que você muda aqui vale direto no site."
        action={
          <div className="flex items-center gap-3">
            {loading && !firstLoad && (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <Spinner size="sm" />
                Atualizando
              </span>
            )}
            <Button size="sm" onClick={openCreate}>
              <Plus aria-hidden />
              Nova categoria
            </Button>
          </div>
        }
      >
        {error && !loadFailed && (
          <div className="border-b border-line px-5 py-4">
            <Notice tone="danger" className="animate-fade-in">
              {error}
            </Notice>
          </div>
        )}

        {firstLoad ? (
          <CategoriesSkeleton />
        ) : loadFailed ? (
          <div className="p-5">
            <Notice
              tone="danger"
              title="Não foi possível carregar as categorias"
              action={
                <Button variant="outline" size="sm" onClick={() => loadCategories()}>
                  Tentar de novo
                </Button>
              }
            >
              <p>{error}</p>
              <p className="mt-1">Teste a conexão com o WordPress deste cliente e tente de novo.</p>
            </Notice>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            compact
            icon={<Tags />}
            title="Nenhuma categoria no WordPress"
            description="Crie a primeira para organizar os artigos do blog. Ela aparece no site na hora."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus aria-hidden />
                Nova categoria
              </Button>
            }
          />
        ) : (
          <ul
            className={cn('divide-y divide-line transition-opacity', loading && 'opacity-60')}
            aria-busy={loading || undefined}
          >
            {rows.map(({ category: cat, depth }) => (
              <li
                key={cat.id}
                className="flex items-center gap-3 py-3 pr-5"
                style={{ paddingLeft: `${1.25 + Math.min(depth, 4) * 1.5}rem` }}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4',
                    depth > 0 ? 'bg-ink/[0.05] text-subtle' : 'bg-brand-soft text-brand',
                  )}
                  aria-hidden
                >
                  {depth > 0 ? <CornerDownRight /> : <Folder />}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink" title={cat.name}>
                    {cat.name}
                  </p>
                  <p className="mt-0.5 flex min-w-0 gap-2 text-xs text-muted">
                    <span className="truncate">/{cat.slug}</span>
                    {typeof cat.count === 'number' && (
                      <span className="shrink-0 tabular-nums sm:hidden">{postsLabel(cat.count)}</span>
                    )}
                  </p>
                </div>

                {typeof cat.count === 'number' && (
                  <Badge className="hidden tabular-nums sm:inline-flex">{postsLabel(cat.count)}</Badge>
                )}

                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="max-sm:px-2"
                    aria-label={`Editar ${cat.name}`}
                    title="Editar nome"
                    onClick={() => {
                      setEditing(cat)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil aria-hidden />
                    <span className="max-sm:sr-only">Editar</span>
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="max-sm:px-2"
                    aria-label={`Excluir ${cat.name}`}
                    title="Excluir do WordPress"
                    loading={deletingId === cat.id}
                    loadingText="Excluindo…"
                    onClick={() => handleDelete(cat)}
                  >
                    <Trash2 aria-hidden />
                    <span className="max-sm:sr-only">Excluir</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

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
