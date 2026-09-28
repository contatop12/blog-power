'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FolderPlus, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
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
  const titleId = useId()
  const descriptionId = useId()
  const inputId = useId()
  const helpId = useId()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // onClose muda a cada render do pai; a ref evita religar o listener de teclado
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setError(null)
    }
  }, [open, editing])

  // Foco no campo ao abrir, Escape fecha e, ao fechar, o foco volta para quem abriu o dialog
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    inputRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // O dialog pode estar dentro de outro <form> (novo artigo, dados do cliente):
    // o submit não pode subir pela árvore React e disparar o formulário de fora.
    e.stopPropagation()
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

  // Portal no body: um ancestral com transform (animação da aba) prenderia o `fixed` ao painel
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-night/40" onClick={onClose} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md animate-pop-in rounded-xl bg-surface shadow-xl"
      >
        <header className="flex items-start gap-3 px-5 pb-4 pt-5">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand [&_svg]:size-4"
            aria-hidden
          >
            {editing ? <Pencil /> : <FolderPlus />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold tracking-tight text-ink">
              {editing ? 'Editar categoria' : 'Nova categoria'}
            </h2>
            <p id={descriptionId} className="mt-0.5 text-sm text-muted">
              {editing
                ? 'O novo nome vale na hora no WordPress do cliente.'
                : 'Ela é criada direto no WordPress do cliente e já pode receber artigos.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="-mr-1.5 -mt-1 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink [&_svg]:size-4"
          >
            <X aria-hidden />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 px-5 pb-5">
            <div>
              <label htmlFor={inputId} className="field-label">
                Nome da categoria
              </label>
              <input
                ref={inputRef}
                id={inputId}
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Cibersegurança"
                aria-describedby={helpId}
                required
              />
              <span id={helpId} className="field-help">
                É o nome que os leitores veem no blog.
              </span>
            </div>

            {error && (
              <Notice tone="danger" className="animate-fade-in">
                {error}
              </Notice>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 rounded-b-xl border-t border-line bg-canvas/60 px-5 py-4 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving} loadingText="Salvando…">
              {editing ? 'Salvar alterações' : 'Criar categoria'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
