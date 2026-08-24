'use client'

import { useId, useState } from 'react'

interface FieldHintProps {
  text: string
}

/** Ícone "!" com tooltip de ajuda ao passar o mouse / focar. */
export function FieldHint({ text }: FieldHintProps) {
  const id = useId()
  const [open, setOpen] = useState(false)

  return (
    <span className="relative ml-1.5 inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-700 text-[10px] font-bold leading-none text-white outline-none ring-offset-1 hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-400"
        aria-describedby={open ? id : undefined}
        aria-label="Ajuda do campo"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.preventDefault()
          setOpen((v) => !v)
        }}
      >
        !
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-slate-700 shadow-lg sm:w-72"
        >
          {text}
          <span
            className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-blue-200"
            aria-hidden
          />
        </span>
      )}
    </span>
  )
}

interface FieldLabelProps {
  label: string
  hint: string
  className?: string
  children: React.ReactNode
}

export function FieldLabel({ label, hint, className, children }: FieldLabelProps) {
  return (
    <label className={className ?? 'block text-sm text-slate-700'}>
      <span className="inline-flex items-start gap-0.5 font-medium">
        {label}
        <FieldHint text={hint} />
      </span>
      {children}
    </label>
  )
}
