'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { WpCategoryFormDialog } from '@/components/wp-category-form-dialog'
import { api } from '@/lib/api'
import type { WpCategoryOption } from '@publisher-p12/types'

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
  const [categories, setCategories] = useState<WpCategoryOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const loadCategories = useCallback(() => {
    setLoadError(null)
    return api.clients
      .wpCategories(clientId)
      .then(setCategories)
      .catch((e: Error) => setLoadError(e.message))
  }, [clientId])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

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
