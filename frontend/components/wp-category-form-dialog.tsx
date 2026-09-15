'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { WpCategoryOption } from '@publisher-p12/types'

interface WpCategoryFormDialogProps {
  clientId: string
  open: boolean
  onClose: () => void
  onSaved: (category: WpCategoryOption) => void
  editing?: WpCategoryOption | null
}

export function WpCategoryFormDialog({
  clientId,
  open,
  onClose,
  onSaved,
  editing = null,
}: WpCategoryFormDialogProps) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setError(null)
    }
  }, [open, editing])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Informe o nome da categoria')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const category = editing
        ? await api.clients.updateWpCategory(clientId, editing.id, { name: trimmed })
        : await api.clients.createWpCategory(clientId, { name: trimmed })
      onSaved(category)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar categoria')
    } finally {
      setSaving(false)
    }
  }

  const inputClass =
    'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wp-category-dialog-title"
      >
        <h2 id="wp-category-dialog-title" className="text-lg font-semibold text-slate-900">
          {editing ? 'Editar categoria' : 'Nova categoria'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          A categoria será criada no WordPress do cliente.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm text-slate-700">
            Nome
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Cibersegurança"
              autoFocus
              required
            />
          </label>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} loadingText="Salvando...">
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
