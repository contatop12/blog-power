'use client'

import { BookOpen, Info, X } from 'lucide-react'
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

interface FieldHintProps {
  text: string
}

/** Ícone de informação: dica curta no hover ou no foco. */
export function FieldHint({ text }: FieldHintProps) {
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tipRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Fica acima do ícone (abaixo, se não couber) e nunca vaza pelas laterais da tela
  useLayoutEffect(() => {
    if (!open) return
    const button = buttonRef.current
    const tip = tipRef.current
    if (!button || !tip) return
    const rect = button.getBoundingClientRect()
    const margin = 8
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - tip.offsetWidth / 2, margin),
      window.innerWidth - tip.offsetWidth - margin,
    )
    const above = rect.top - tip.offsetHeight - margin
    setPos({ left, top: above >= margin ? above : rect.bottom + margin })
  }, [open, text])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-subtle transition-colors duration-150 hover:text-brand focus-visible:text-brand"
        aria-describedby={open ? id : undefined}
        aria-label="Ajuda do campo"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            id={id}
            role="tooltip"
            style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
            className="pointer-events-none fixed z-[70] w-max max-w-[min(18rem,calc(100vw-1rem))] animate-pop-in rounded-lg bg-night px-3 py-2 text-left text-xs font-normal leading-relaxed text-white shadow-lg"
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  )
}

interface GuideDialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** Ícone no cabeçalho. Padrão: livro aberto. */
  icon?: React.ReactNode
  /** Ações no rodapé (links, botões). */
  footer?: React.ReactNode
  /** Id do painel, para `aria-controls` no botão que abre. */
  id?: string
  children: React.ReactNode
}

/**
 * Diálogo de leitura (guias passo a passo). Renderiza no <body> para não ficar preso
 * a painéis com transform/overflow; fecha com Escape, no X ou clicando fora.
 */
export function GuideDialog({ open, onClose, title, icon, footer, id, children }: GuideDialogProps) {
  const autoId = useId()
  const dialogId = id ?? autoId
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      // Mantém o Tab dentro do diálogo
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, summary, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-fade-in bg-night/40" aria-hidden onClick={onClose} />
      <div
        ref={panelRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        className="relative flex max-h-[85vh] w-full max-w-lg animate-pop-in flex-col overflow-hidden rounded-xl bg-surface shadow-xl"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand [&_svg]:size-4"
            aria-hidden
          >
            {icon ?? <BookOpen />}
          </span>
          <h2
            id={`${dialogId}-title`}
            className="min-w-0 flex-1 pt-1 text-base font-semibold leading-snug tracking-tight text-ink"
          >
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="-mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm leading-relaxed text-ink">
          {children}
        </div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-canvas/50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

interface FieldGuideProps {
  title: string
  children: React.ReactNode
}

/** Botão "Guia": abre um passo a passo em diálogo (textos longos). */
export function FieldGuide({ title, children }: FieldGuideProps) {
  const [open, setOpen] = useState(false)
  const dialogId = useId()

  return (
    <>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-xs font-medium text-muted transition-colors duration-150 hover:bg-brand-soft hover:text-brand focus-visible:text-brand"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={`Abrir guia: ${title}`}
        onClick={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
      >
        <BookOpen className="size-3.5" aria-hidden />
        Guia
      </button>
      <GuideDialog id={dialogId} open={open} onClose={() => setOpen(false)} title={title}>
        {children}
      </GuideDialog>
    </>
  )
}

interface FieldLabelProps {
  label: string
  hint?: string
  guide?: { title: string; content: React.ReactNode }
  /** Marca ao lado do rótulo — ex.: "Obrigatório". */
  badge?: React.ReactNode
  /** Texto de ajuda abaixo do campo. */
  help?: React.ReactNode
  className?: string
  children: React.ReactNode
}

const FORM_CONTROLS = new Set(['input', 'select', 'textarea'])

/**
 * Rótulo com dica (tooltip) ou guia (diálogo). Os botões de ajuda ficam fora do
 * <label>, então clicar no texto foca o campo — e não abre a ajuda por engano.
 */
export function FieldLabel({ label, hint, guide, badge, help, className, children }: FieldLabelProps) {
  const autoId = useId()
  const helpId = help ? `${autoId}-help` : undefined

  const assist = guide ? (
    <FieldGuide title={guide.title}>{guide.content}</FieldGuide>
  ) : hint ? (
    <FieldHint text={hint} />
  ) : null

  const helpText = help ? (
    <span id={helpId} className="field-help">
      {help}
    </span>
  ) : null

  // Campo único: associa o rótulo por id
  if (
    isValidElement<{ id?: string; 'aria-describedby'?: string }>(children) &&
    typeof children.type === 'string' &&
    FORM_CONTROLS.has(children.type)
  ) {
    const controlId = children.props.id ?? `${autoId}-control`
    return (
      <div className={className}>
        <div className="field-label flex flex-wrap items-center gap-x-1 gap-y-1">
          <label htmlFor={controlId}>{label}</label>
          {assist}
          {badge && <span className="ml-1 inline-flex">{badge}</span>}
        </div>
        {cloneElement(children, {
          id: controlId,
          'aria-describedby':
            [children.props['aria-describedby'], helpId].filter(Boolean).join(' ') || undefined,
        })}
        {helpText}
      </div>
    )
  }

  // Vários controles (listas): o rótulo nomeia o grupo
  const labelId = `${autoId}-label`
  return (
    <div role="group" aria-labelledby={labelId} aria-describedby={helpId} className={className}>
      <div className="field-label flex flex-wrap items-center gap-x-1 gap-y-1">
        <span id={labelId}>{label}</span>
        {assist}
        {badge && <span className="ml-1 inline-flex">{badge}</span>}
      </div>
      {children}
      {helpText}
    </div>
  )
}
