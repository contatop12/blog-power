'use client'

import { useEffect, useState } from 'react'
import { WpCategorySelect } from '@/components/wp-category-select'
import { api } from '@/lib/api'
import type { WpAuthorOption } from '@publisher-p12/types'

interface WpDefaultsFieldsProps {
  clientId: string
  categoriaPadraoId: number | null
  autorPadraoId: number | null
  onCategoriaChange: (id: number | null) => void
  onAutorChange: (id: number | null) => void
}

export function WpDefaultsFields({
  clientId,
  categoriaPadraoId,
  autorPadraoId,
  onCategoriaChange,
  onAutorChange,
}: WpDefaultsFieldsProps) {
  const [authors, setAuthors] = useState<WpAuthorOption[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.clients
      .wpAuthors(clientId)
      .then(setAuthors)
      .catch((e: Error) => setError(e.message))
  }, [clientId])

  const inputClass =
    'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200'

  return (
    <div className="mt-4 grid gap-5 border-t border-slate-200 pt-5 sm:grid-cols-2">
      <p className="text-sm text-slate-600 sm:col-span-2">
        Categorias e autores vêm do WordPress do cliente. Gerencie categorias na aba
        &quot;Categorias&quot; ou use o botão + ao lado do campo.
      </p>

      {error && <p className="text-sm text-amber-800 sm:col-span-2">WP: {error}</p>}

      <WpCategorySelect
        clientId={clientId}
        value={categoriaPadraoId}
        onChange={onCategoriaChange}
        label="Categoria padrão"
        hint="Usada ao criar novos artigos para este cliente."
      />

      <label className="block text-sm text-slate-700">
        Autor padrão
        <select
          className={inputClass}
          value={autorPadraoId ?? ''}
          onChange={(e) => onAutorChange(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Padrão do WP</option>
          {authors.map((author) => (
            <option key={author.id} value={author.id}>
              {author.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
