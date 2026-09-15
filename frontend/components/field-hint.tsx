'use client'

import { MousePointer2 } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

interface FieldHintProps {
  text: string
}

/** Ícone "!" azul — tooltip curto no hover. */
export function FieldHint({ text }: FieldHintProps) {
  const id = useId()
  const [open, setOpen] = useState(false)

  return (
    <span className="relative ml-1.5 inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold leading-none text-white outline-none transition-transform duration-150 hover:scale-110 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-400 active:scale-95"
        aria-describedby={open ? id : undefined}
        aria-label="Ajuda do campo"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        !
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 animate-pop-in rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-slate-700 shadow-lg sm:w-72"
        >
          {text}
        </span>
      )}
    </span>
  )
}

interface FieldGuideProps {
  title: string
  children: React.ReactNode
}

/** Ícone "!" verde + cursor — abre popup ao clicar (textos longos). */
export function FieldGuide({ title, children }: FieldGuideProps) {
  const [open, setOpen] = useState(false)
  const dialogId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        className="ml-1.5 inline-flex cursor-pointer items-center gap-0.5 rounded-full bg-emerald-600 px-1 py-0.5 text-white outline-none transition-transform duration-150 hover:scale-110 hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-400 active:scale-95"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={`Abrir guia: ${title}`}
        title="Clique para ver o guia"
        onClick={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
      >
        <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[10px] font-bold leading-none">
          !
        </span>
        <MousePointer2 className="h-3 w-3" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40 transition-opacity"
            aria-label="Fechar guia"
            onClick={() => setOpen(false)}
          />
          <div
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            className="relative z-10 max-h-[85vh] w-full max-w-lg animate-pop-in overflow-y-auto rounded-xl border border-emerald-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id={`${dialogId}-title`} className="text-base font-semibold text-emerald-900">
                {title}
              </h3>
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                onClick={() => setOpen(false)}
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">{children}</div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-emerald-800">
              <MousePointer2 className="h-3.5 w-3.5" aria-hidden />
              Clique fora ou em Fechar para voltar ao formulário.
            </p>
          </div>
        </div>
      )}
    </>
  )
}

interface FieldLabelProps {
  label: string
  hint?: string
  guide?: { title: string; content: React.ReactNode }
  className?: string
  children: React.ReactNode
}

export function FieldLabel({ label, hint, guide, className, children }: FieldLabelProps) {
  return (
    <label className={className ?? 'block text-sm text-slate-700'}>
      <span className="inline-flex items-start gap-0.5 font-medium">
        {label}
        {guide ? (
          <FieldGuide title={guide.title}>{guide.content}</FieldGuide>
        ) : hint ? (
          <FieldHint text={hint} />
        ) : null}
      </span>
      {children}
    </label>
  )
}
