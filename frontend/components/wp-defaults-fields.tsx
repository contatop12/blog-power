'use client'

import { useEffect, useId, useState } from 'react'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
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

/** Seção "Padrões de publicação": categoria e autor que cada artigo novo já traz marcados. */
export function WpDefaultsFields({
  clientId,
  categoriaPadraoId,
  autorPadraoId,
  onCategoriaChange,
  onAutorChange,
}: WpDefaultsFieldsProps) {
  const authorSelectId = useId()
  const [authors, setAuthors] = useState<WpAuthorOption[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.clients
      .wpAuthors(clientId)
      .then(setAuthors)
      .catch((e: Error) => setError(e.message))
  }, [clientId])

  return (
    <Card>
      <CardTitle>Padrões de publicação</CardTitle>
      <CardDescription>
        Vêm do WordPress do cliente e já chegam marcados em cada artigo novo. Para criar ou renomear
        categorias, use a aba Categorias.
      </CardDescription>

      {error && (
        <Notice tone="warning" title="Não foi possível carregar os autores do WordPress" className="mt-5">
          <p>{error}</p>
          <p className="mt-1">Confira a conexão em Ações WordPress, nesta mesma aba.</p>
        </Notice>
      )}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <WpCategorySelect
          clientId={clientId}
          value={categoriaPadraoId}
          onChange={onCategoriaChange}
          label="Categoria padrão"
          hint="Usada ao criar novos artigos para este cliente."
        />

        <div>
          <label htmlFor={authorSelectId} className="field-label">
            Autor padrão
          </label>
          <select
            id={authorSelectId}
            className="field-input"
            value={autorPadraoId ?? ''}
            onChange={(e) => onAutorChange(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Padrão do WordPress</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
          <span className="field-help">Quem aparece como autor do post no site.</span>
        </div>
      </div>
    </Card>
  )
}
