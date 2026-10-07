'use client'

import { useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { WpCategoryFormDialog } from '@/components/wp-category-form-dialog'
import { queries } from '@/lib/api'
import { useQuery } from '@/lib/query'

interface WpCategorySelectProps {
  clientId: string
  value: number | null
  onChange: (id: number | null) => void
  disabled?: boolean
  label?: string
  hint?: string
}

export function WpCategorySelect({
  clientId,
  value,
  onChange,
  disabled = false,
  label = 'Categorias',
  hint,
}: WpCategorySelectProps) {
  const selectId = useId()
  const categoriesQuery = useQuery(queries.wpCategories(clientId))
  const categories = categoriesQuery.data ?? []
  const loadError = categoriesQuery.data ? null : (categoriesQuery.error?.message ?? null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadCategories = () => categoriesQuery.reload().catch(() => undefined)

  return (
    <>
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={selectId} className="text-sm font-medium text-ink">
            {label}
          </label>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-brand transition-colors hover:bg-brand-soft disabled:pointer-events-none disabled:opacity-40"
            onClick={() => setDialogOpen(true)}
            disabled={disabled}
          >
            <Plus className="size-3.5" aria-hidden />
            Nova categoria
          </button>
        </div>
        <select
          id={selectId}
          className="field-input"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
          disabled={disabled}
        >
          <option value="">Selecione uma categoria</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.parent ? '↳ ' : ''}
              {cat.name}
            </option>
          ))}
        </select>
        {hint && <span className="field-help">{hint}</span>}
        {loadError && (
          <span className="field-help text-amber-700">
            Não foi possível carregar as categorias do WordPress: {loadError}
          </span>
        )}
      </div>

      <WpCategoryFormDialog
        clientId={clientId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={async (category) => {
          await loadCategories()
          onChange(category.id)
        }}
      />
    </>
  )
}
