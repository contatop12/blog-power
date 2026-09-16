'use client'

import { Card, CardTitle } from '@/components/ui/card'
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

interface QaReportPanelProps {
  qa: QaReport | null
  dossie: Dossie | null
}

export function QaReportPanel({ qa, dossie }: QaReportPanelProps) {
  if (!qa) return null

  const aprovado = qa.veredito === 'aprovado'
  // Rodada 2 reprovada significa que o ciclo automático acabou: decide um humano
  const esgotado = !aprovado && qa.rodada >= 2

  return (
    <Card>
      <CardTitle className="flex flex-wrap items-center gap-2">
        Controle de qualidade
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            aprovado ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900'
          }`}
        >
          {aprovado ? 'Aprovado' : 'Reprovado'} · rodada {qa.rodada}
        </span>
      </CardTitle>

      {esgotado && (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <strong>A rodada de correção automática já foi usada.</strong> O artigo parou aqui
          para decisão humana: edite o texto ao lado ou publique assumindo os pontos abaixo.
        </p>
      )}

      <div className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {CATEGORIAS.map(({ chave, label }) => {
          const nota = qa.score[chave]
          const reprovada = nota < QA_SCORE_MINIMO
          return (
            <div key={chave} className="flex items-center justify-between gap-3">
              <span className="text-slate-700">{label}</span>
              <span
                className={`tabular-nums font-medium ${
                  reprovada ? 'text-red-600' : 'text-emerald-700'
                }`}
              >
                {nota.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Nenhuma categoria pode ficar abaixo de {QA_SCORE_MINIMO} (Skill §64).
      </p>

      {qa.correcoes.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-slate-900">Correções apontadas</p>
          <ul className="mt-2 space-y-3">
            {qa.correcoes.map((c, i) => (
              <li key={i} className="rounded-lg border border-zinc-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {c.categoria}
                </p>
                <p className="mt-1 text-sm text-slate-900">{c.problema}</p>
                <p className="mt-1 text-sm text-slate-700">{c.correcao}</p>
                {c.trecho && (
                  <p className="mt-1 text-xs italic text-slate-500">&ldquo;{c.trecho}&rdquo;</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {qa.fatos_sem_fonte.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-slate-900">Afirmações sem fonte</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {qa.fatos_sem_fonte.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {qa.diferenciacao_ia && (
        <div className="mt-5">
          <p className="text-sm font-medium text-slate-900">Diferenciação (Skill §50)</p>
          <p className="mt-1 text-sm text-slate-700">{qa.diferenciacao_ia}</p>
        </div>
      )}

      {dossie?.pendencias && dossie.pendencias.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-slate-900">Pendências do perfil</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Faltou no perfil do cliente e não foi inventado.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {dossie.pendencias.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
