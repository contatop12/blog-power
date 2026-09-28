import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import type { ArticleStatus } from '@publisher-p12/types'
import { Badge, StatusDot } from '@/components/ui/badge'
import { ARTICLE_STATUS, PIPELINE_ORDER, STAGES, TONE_CLASSES, type Stage } from '@/lib/status'
import { cn } from '@/lib/utils'

/** Borda entre colunas: 2×2 no mobile, 4 colunas a partir de lg. */
const CELL_BORDERS = ['', 'border-l', 'border-t lg:border-l lg:border-t-0', 'border-l border-t lg:border-t-0']

/**
 * Esteira editorial do painel: quantos artigos há em cada etapa.
 * Cada etapa leva à lista de artigos filtrada.
 */
export function PipelineOverview({
  counts,
  generating = 0,
}: {
  counts: Record<Stage, number>
  /** Artigos com status "gerando" agora — acende o sinal de agentes trabalhando. */
  generating?: number
}) {
  return (
    <section aria-label="Pipeline editorial" className="overflow-hidden rounded-xl border border-line bg-surface">
      <ol className="grid grid-cols-2 lg:grid-cols-4">
        {PIPELINE_ORDER.map((stage, i) => {
          const meta = STAGES[stage]
          const count = counts[stage]
          return (
            <li
              key={stage}
              className={cn('relative animate-slide-up border-line', CELL_BORDERS[i])}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <Link
                href={`/articles?etapa=${stage}`}
                className="group flex h-full flex-col p-5 outline-offset-[-2px] transition-colors duration-150 hover:bg-canvas/70 sm:p-6"
              >
                <span
                  className={cn(
                    'h-1 w-10 rounded-full transition-[width] duration-300 group-hover:w-14',
                    TONE_CLASSES[meta.tone].dot,
                    count === 0 && 'opacity-30',
                  )}
                  aria-hidden
                />
                <span className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
                  {meta.label}
                  {stage === 'producao' && generating > 0 && (
                    <Badge tone="violet" dot pulse title="Agentes escrevendo agora">
                      {generating} gerando
                    </Badge>
                  )}
                </span>
                <span className="mt-1.5 text-[40px] font-extrabold leading-none tracking-[-0.04em] text-ink tabular-nums sm:text-[46px]">
                  {count}
                </span>
                <span className="mt-2.5 text-[13px] leading-snug text-muted">{meta.description}</span>
              </Link>
              {i < PIPELINE_ORDER.length - 1 && (
                <ChevronRight
                  className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 rounded-full border border-line bg-surface p-1 text-subtle lg:block"
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>

      {counts.erro > 0 && (
        <Link
          href="/articles?etapa=erro"
          className="flex items-center justify-between gap-3 border-t border-red-100 bg-red-50/70 px-5 py-3 text-sm text-red-800 transition-colors hover:bg-red-50 sm:px-6"
        >
          <span className="flex items-center gap-2.5">
            <StatusDot tone="danger" />
            <span>
              <strong className="font-semibold">
                {counts.erro} {counts.erro === 1 ? 'artigo' : 'artigos'}
              </strong>{' '}
              {counts.erro === 1 ? 'falhou' : 'falharam'} ao publicar
            </span>
          </span>
          <span className="inline-flex items-center gap-1 font-medium">
            Ver artigos
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </Link>
      )}
    </section>
  )
}

/** Onde um artigo está no fluxo: Produção, Revisão, Agendado, Publicado. */
export function PipelineStepper({ status, className }: { status: ArticleStatus; className?: string }) {
  const stage = ARTICLE_STATUS[status]?.stage ?? 'producao'
  const current = stage === 'erro' ? -1 : PIPELINE_ORDER.indexOf(stage)

  return (
    <ol aria-label="Etapa do artigo" className={cn('flex flex-wrap items-center gap-x-2 gap-y-2', className)}>
      {PIPELINE_ORDER.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'todo'
        const tone = TONE_CLASSES[STAGES[s].tone]
        return (
          <li key={s} className="flex items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            <span
              className={cn(
                'grid size-6 place-items-center rounded-full text-[11px] font-bold tabular-nums',
                state === 'done' && 'bg-ink text-white',
                state === 'current' && cn(tone.dot, 'text-white ring-4 ring-ink/[0.06]'),
                state === 'todo' && 'border border-line-strong bg-surface text-subtle',
              )}
            >
              {state === 'done' ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                'text-sm',
                state === 'current' ? 'font-semibold text-ink' : state === 'done' ? 'text-ink' : 'text-subtle',
              )}
            >
              {STAGES[s].step}
            </span>
            {i < PIPELINE_ORDER.length - 1 && (
              <span
                className={cn('mx-1 h-px w-5 sm:w-8', i < current ? 'bg-ink/40' : 'bg-line-strong')}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
