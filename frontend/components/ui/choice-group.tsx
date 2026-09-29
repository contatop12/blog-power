import { cn } from '@/lib/utils'

export interface ChoiceOption<T extends string> {
  value: T
  label: string
  description?: string
  icon?: React.ReactNode
}

/** Grupo de rádio em cartões — para escolhas mutuamente exclusivas com explicação curta. */
export function ChoiceGroup<T extends string>({
  name,
  legend,
  value,
  onChange,
  options,
  className,
}: {
  name: string
  legend: string
  value: T
  onChange: (value: T) => void
  options: ChoiceOption<T>[]
  className?: string
}) {
  return (
    <fieldset className={className}>
      <legend className="field-label">{legend}</legend>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {options.map((opt) => {
          const checked = opt.value === value
          return (
            <label
              key={opt.value}
              className={cn(
                'relative flex cursor-pointer gap-3 rounded-lg border bg-surface px-4 py-3 transition-[border-color,background-color,box-shadow] duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand/40',
                checked
                  ? 'border-ink bg-surface shadow-[0_0_0_1px_rgb(var(--ink)),inset_0_-3px_0_rgb(var(--cyan))]'
                  : 'border-line-strong hover:border-subtle',
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.icon && (
                <span
                  className={cn('mt-0.5 shrink-0 [&_svg]:size-4', checked ? 'text-ink' : 'text-subtle')}
                  aria-hidden
                >
                  {opt.icon}
                </span>
              )}
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{opt.label}</span>
                {opt.description && (
                  <span className="mt-0.5 block text-xs leading-snug text-muted">{opt.description}</span>
                )}
              </span>
              <span
                className={cn(
                  'ml-auto mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border',
                  checked ? 'border-ink bg-ink' : 'border-line-strong bg-surface',
                )}
                aria-hidden
              >
                {checked && <span className="size-1.5 rounded-full bg-white" />}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
