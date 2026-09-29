'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils'

export interface TabItem<T extends string> {
  value: T
  label: string
  icon?: React.ReactNode
  /** Sinal ao lado do rótulo — ex.: ponto de pendência ou contador. */
  indicator?: React.ReactNode
}

/** Abas com sublinhado, navegação por setas e rolagem horizontal no mobile. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  label,
}: {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  /** Rótulo acessível do grupo de abas. */
  label: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function focusAt(index: number) {
    const i = (index + items.length) % items.length
    refs.current[i]?.focus()
    onChange(items[i].value)
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1', className)}
    >
      {items.map((item, index) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') focusAt(index + 1)
              if (e.key === 'ArrowLeft') focusAt(index - 1)
            }}
            className={cn(
              'relative -mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150 [&_svg]:size-4',
              active
                ? 'border-ink font-semibold text-ink [&_svg]:text-ink'
                : 'border-transparent text-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {item.icon}
            {item.label}
            {item.indicator}
          </button>
        )
      })}
    </div>
  )
}
