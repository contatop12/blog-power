'use client'

import { useCallback, useEffect, useState } from 'react'
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

  const inputClass =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-500'

  return (
    <>
      <div className="block text-sm text-slate-700">
        <div className="flex items-center justify-between gap-2">
          <span>{label}</span>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-700 disabled:pointer-events-none disabled:opacity-40"
            onClick={() => setDialogOpen(true)}
            disabled={disabled}
            title="Adicionar categoria"
            aria-label="Adicionar categoria"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <select
          className={`${inputClass} mt-1`}
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
        {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
        {loadError && (
          <span className="mt-1 block text-xs text-amber-800">
            Não foi possível carregar categorias: {loadError}
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
