'use client'

import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { cn } from '@/lib/utils'
import { QA_SCORE_MINIMO, type Dossie, type QaReport, type QaScore } from '@publisher-p12/types'

/** Rótulos das 11 categorias do §64, na ordem em que a Skill as lista. */
const CATEGORIAS: Array<{ chave: keyof QaScore; label: string }> = [
  { chave: 'intencao_busca', label: 'Intenção de busca' },
  { chave: 'profundidade', label: 'Profundidade' },
  { chave: 'originalidade', label: 'Originalidade' },
  { chave: 'seo', label: 'SEO' },
  { chave: 'geo_aeo', label: 'GEO/AEO' },
  { chave: 'eeat', label: 'E-E-A-T' },
  { chave: 'ux', label: 'UX' },
  { chave: 'conversao', label: 'Conversão' },
  { chave: 'atualidade', label: 'Atualidade' },
  { chave: 'qualidade_fontes', label: 'Qualidade das fontes' },
  { chave: 'naturalidade', label: 'Naturalidade' },
]

const LABEL_POR_CHAVE = Object.fromEntries(CATEGORIAS.map((c) => [c.chave, c.label])) as Record<
  keyof QaScore,
  string
>

interface QaReportPanelProps {
  qa: QaReport | null
  dossie: Dossie | null
}

function SubHeading({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-2">
      <h3 className="text-sm font-semibold text-ink">{children}</h3>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function QaReportPanel({ qa, dossie }: QaReportPanelProps) {
  if (!qa) return null

  const aprovado = qa.veredito === 'aprovado'
  // Rodada 2 reprovada significa que o ciclo automático acabou: decide um humano
  const esgotado = !aprovado && qa.rodada >= 2

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted" aria-hidden />
          Controle de qualidade
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge tone={aprovado ? 'success' : 'danger'} dot>
            {aprovado ? 'Aprovado' : 'Reprovado'}
          </Badge>
          <Badge>Rodada {qa.rodada}</Badge>
        </div>
      </div>

      {esgotado && (
        <Notice tone="warning" title="A rodada de correção automática já foi usada" className="mt-4">
          O artigo parou aqui para decisão humana: edite o texto ou publique assumindo os pontos
          abaixo.
        </Notice>
      )}

      <div className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {CATEGORIAS.map(({ chave, label }) => {
          const nota = qa.score[chave]
          const reprovada = nota < QA_SCORE_MINIMO
          return (
            <div key={chave}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink">{label}</span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    reprovada ? 'text-red-600' : 'text-emerald-700',
                  )}
                >
                  {nota.toFixed(1)}
                </span>
              </div>
              <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
                <div
                  className={cn('h-full rounded-full', reprovada ? 'bg-red-500' : 'bg-emerald-500')}
                  style={{ width: `${Math.max(0, Math.min(10, nota)) * 10}%` }}
                />
                {/* Marca do mínimo aceito */}
                <span
                  className="absolute inset-y-0 w-px bg-ink/40"
                  style={{ left: `${QA_SCORE_MINIMO * 10}%` }}
                  aria-hidden
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-xs text-muted">
        Nenhuma categoria pode ficar abaixo de {QA_SCORE_MINIMO} (Skill §64). A linha em cada barra
        marca esse mínimo.
      </p>

      {qa.correcoes.length > 0 && (
        <div className="mt-6">
          <SubHeading>Correções apontadas</SubHeading>
          <ul className="space-y-2.5">
            {qa.correcoes.map((c, i) => (
              <li key={i} className="rounded-lg border border-line bg-canvas/60 px-4 py-3">
                <Badge tone={qa.reprovadas.includes(c.categoria) ? 'danger' : 'neutral'}>
                  {LABEL_POR_CHAVE[c.categoria] ?? c.categoria}
                </Badge>
                <p className="mt-2 text-sm font-medium text-ink">{c.problema}</p>
                <p className="mt-1 text-sm text-muted">{c.correcao}</p>
                {c.trecho && (
                  <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-xs italic text-muted">
                    {c.trecho}
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {qa.fatos_sem_fonte.length > 0 && (
        <div className="mt-6">
          <SubHeading>Afirmações sem fonte</SubHeading>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink marker:text-subtle">
            {qa.fatos_sem_fonte.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {qa.diferenciacao_ia && (
        <div className="mt-6">
          <SubHeading>Diferenciação (Skill §50)</SubHeading>
          <p className="text-sm text-ink">{qa.diferenciacao_ia}</p>
        </div>
      )}

      {dossie?.pendencias && dossie.pendencias.length > 0 && (
        <div className="mt-6">
          <SubHeading hint="Faltou no perfil do cliente e não foi inventado.">
            Pendências do perfil
          </SubHeading>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink marker:text-subtle">
            {dossie.pendencias.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
