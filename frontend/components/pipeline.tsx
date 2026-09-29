import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import type { ArticleStatus } from '@publisher-p12/types'
import { Badge, StatusDot } from '@/components/ui/badge'
import { ColorBar } from '@/components/ui/print'
import { ARTICLE_STATUS, PIPELINE_ORDER, STAGES, TONE_CLASSES, type Stage } from '@/lib/status'
import { cn } from '@/lib/utils'

/** Borda entre colunas: 2×2 no mobile, 4 colunas a partir de lg. */
const CELL_BORDERS = ['', 'border-l', 'border-t lg:border-l lg:border-t-0', 'border-l border-t lg:border-t-0']

/** Amostra de tinta com a letra do processo (C, M, Y, K). */
function InkSwatch({ stage, className }: { stage: Stage; className?: string }) {
  const meta = STAGES[stage]
  return (
    <span
      className={cn(
        'grid size-7 place-items-center rounded-[4px] font-display text-[13px] font-black transition-transform duration-200',
        TONE_CLASSES[meta.tone].dot,
        meta.tone === 'yellow' ? 'text-ink' : 'text-white',
        className,
      )}
      aria-hidden
    >
      {meta.ink}
    </span>
  )
}

/**
 * Esteira editorial do painel como barra de controle de cor: cada etapa é uma tinta,
 * com o total em destaque e a faixa proporcional embaixo. Cada etapa leva à lista filtrada.
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
    <section
      aria-label="Pipeline editorial"
      className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_0_rgb(27_31_42/0.05)]"
    >
      <ol className="grid grid-cols-2 lg:grid-cols-4">
        {PIPELINE_ORDER.map((stage, i) => {
          const meta = STAGES[stage]
          const count = counts[stage]
          return (
            <li key={stage} className={cn('relative border-line', CELL_BORDERS[i])}>
              <Link
                href={`/articles?etapa=${stage}`}
                className="group flex h-full flex-col p-5 outline-offset-[-2px] transition-colors duration-150 hover:bg-canvas/50 sm:p-6"
              >
                <span className="flex items-center justify-between gap-2">
                  <InkSwatch stage={stage} className="group-hover:-rotate-6 group-hover:scale-110" />
                  {stage === 'producao' && generating > 0 && (
                    <Badge tone="cyan" dot pulse title="Agentes escrevendo agora">
                      {generating} gerando
                    </Badge>
                  )}
                </span>
                <span
                  className={cn(
                    'mt-5 font-display text-[64px] font-black leading-[0.8] tracking-[-0.03em] tabular-nums sm:text-[84px]',
                    count === 0 ? 'text-ink/25' : 'text-ink',
                  )}
                >
                  {count}
                </span>
                <span className="mt-4 font-display text-lg font-bold leading-tight text-ink">{meta.label}</span>
                <span className="mt-0.5 text-[13px] leading-snug text-muted">{meta.description}</span>
              </Link>
              {i < PIPELINE_ORDER.length - 1 && (
                <ChevronRight
                  className="pointer-events-none absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 rounded-full border border-line bg-surface p-1 text-muted lg:block"
                  aria-hidden
                />
              )}
            </li>
          )
        })}
      </ol>

      <div className="border-t border-line px-5 py-4 sm:px-6">
        <ColorBar
          segments={PIPELINE_ORDER.map((stage) => ({
            key: stage,
            value: counts[stage],
            color: TONE_CLASSES[STAGES[stage].tone].dot,
            label: STAGES[stage].label,
          }))}
        />
      </div>

      {counts.erro > 0 && (
        <Link
          href="/articles?etapa=erro"
          className="flex items-center justify-between gap-3 border-t border-spot/20 bg-spot/[0.06] px-5 py-3 text-sm text-[#A3190F] transition-colors hover:bg-spot/10 sm:px-6"
        >
          <span className="flex items-center gap-2.5">
            <StatusDot tone="danger" shape="round" pulse />
            <span>
              <strong className="font-semibold">
                {counts.erro} {counts.erro === 1 ? 'artigo' : 'artigos'}
              </strong>{' '}
              {counts.erro === 1 ? 'falhou' : 'falharam'} ao publicar
            </span>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold">
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
        const meta = STAGES[s]
        return (
          <li key={s} className="flex items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            <span
              className={cn(
                'grid size-6 place-items-center rounded-[4px] font-display text-[12px] font-black',
                state !== 'todo' && TONE_CLASSES[meta.tone].dot,
                state !== 'todo' && (meta.tone === 'yellow' ? 'text-ink' : 'text-white'),
                state === 'current' && 'ring-2 ring-ink ring-offset-2 ring-offset-canvas',
                state === 'todo' && 'border border-dashed border-line-strong text-subtle',
              )}
            >
              {state === 'done' ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : meta.ink}
            </span>
            <span
              className={cn(
                'text-sm',
                state === 'current' ? 'font-semibold text-ink' : state === 'done' ? 'text-ink' : 'text-subtle',
              )}
            >
              {meta.step}
            </span>
            {i < PIPELINE_ORDER.length - 1 && (
              <span
                className={cn('mx-1 h-px w-5 sm:w-8', i < current ? 'bg-ink/50' : 'bg-line-strong')}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
