import { cn } from '@/lib/utils'

/** Marca de registro da gráfica — usada como símbolo do Publisher. */
export function RegistrationMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <circle cx="16" cy="16" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
      <path d="M16 1v30M1 16h30" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

/**
 * Marcas de corte nos cantos — sinalizam que o conteúdo é uma prova, ainda
 * não impressa. O container precisa de margem para as marcas não cortarem.
 */
export function CropMarks({
  children,
  label,
  className,
}: {
  children: React.ReactNode
  /** Texto pequeno acima da marca superior esquerda (ex.: "Prova da rodada 1"). */
  label?: string
  className?: string
}) {
  const h = 'absolute h-px w-3.5 bg-ink/35'
  const v = 'absolute h-3.5 w-px bg-ink/35'
  return (
    <div className={cn('relative', className)}>
      {label && (
        <span className="absolute -top-7 left-0 text-xs font-medium text-muted">{label}</span>
      )}
      {/* Escondidas no mobile: sem margem lateral, sairiam da tela */}
      <span aria-hidden className="pointer-events-none hidden sm:block">
        <span className={cn(h, '-left-5 top-0')} />
        <span className={cn(v, '-top-5 left-0')} />
        <span className={cn(h, '-right-5 top-0')} />
        <span className={cn(v, '-top-5 right-0')} />
        <span className={cn(h, '-left-5 bottom-0')} />
        <span className={cn(v, '-bottom-5 left-0')} />
        <span className={cn(h, '-right-5 bottom-0')} />
        <span className={cn(v, '-bottom-5 right-0')} />
      </span>
      {children}
    </div>
  )
}

/** Carimbo levemente torto — veredito que "bate" quando aparece. */
export function Stamp({
  tone,
  children,
  className,
}: {
  tone: 'key' | 'danger'
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex -rotate-[4deg] animate-stamp items-center gap-1.5 rounded-md border-[2.5px] px-2.5 py-1 font-display text-[17px] font-black uppercase leading-none tracking-[0.06em] [&_svg]:size-4',
        tone === 'key' ? 'border-ink text-ink' : 'border-spot text-spot',
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Barra de controle de cor: uma faixa por tinta, com largura proporcional ao volume.
 * Toda tinta aparece (mínimo visível) — como na tira de controle da gráfica.
 */
export function ColorBar({
  segments,
  className,
}: {
  segments: { key: string; value: number; color: string; label: string }[]
  className?: string
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <RegistrationMark className="size-3.5 shrink-0 text-ink/40" />
      <div className="flex h-2.5 flex-1 animate-press-pass gap-[3px]" role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}>
        {segments.map((s) => (
          <span
            key={s.key}
            className={cn('h-full rounded-[1px]', s.color)}
            style={{ flexGrow: Math.max(s.value / total, 0.03) }}
          />
        ))}
      </div>
      <RegistrationMark className="size-3.5 shrink-0 text-ink/40" />
    </div>
  )
}
