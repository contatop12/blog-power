import type { ArticleStatus, ConnectionStatus } from '@publisher-p12/types'

/** Tom visual compartilhado por Badge, Notice, pontos e barras de etapa. */
export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'violet'

/** Etapas do pipeline editorial — agrupam os status do artigo. */
export type Stage = 'producao' | 'revisao' | 'agendado' | 'publicado' | 'erro'

/** Ordem do fluxo (erro fica fora: pode acontecer em qualquer etapa). */
export const PIPELINE_ORDER = ['producao', 'revisao', 'agendado', 'publicado'] as const

export const STAGES: Record<
  Stage,
  {
    label: string
    /** Rótulo no singular, para um artigo só (stepper). */
    step: string
    description: string
    tone: Tone
    statuses: ArticleStatus[]
  }
> = {
  producao: {
    label: 'Produção',
    step: 'Produção',
    description: 'Briefing, geração e rascunho',
    tone: 'violet',
    statuses: ['briefing', 'gerando', 'rascunho'],
  },
  revisao: {
    label: 'Revisão',
    step: 'Revisão',
    description: 'Esperando aprovação da equipe',
    tone: 'warning',
    statuses: ['em_revisao', 'aprovado'],
  },
  agendado: {
    label: 'Agendados',
    step: 'Agendado',
    description: 'Com data marcada no WordPress',
    tone: 'brand',
    statuses: ['agendado'],
  },
  publicado: {
    label: 'Publicados',
    step: 'Publicado',
    description: 'No ar no site do cliente',
    tone: 'success',
    statuses: ['publicado'],
  },
  erro: {
    label: 'Com erro',
    step: 'Erro',
    description: 'Falharam e precisam de ação',
    tone: 'danger',
    statuses: ['erro'],
  },
}

export const ARTICLE_STATUS: Record<ArticleStatus, { label: string; stage: Stage }> = {
  briefing: { label: 'Briefing', stage: 'producao' },
  gerando: { label: 'Gerando', stage: 'producao' },
  rascunho: { label: 'Rascunho', stage: 'producao' },
  em_revisao: { label: 'Em revisão', stage: 'revisao' },
  aprovado: { label: 'Aprovado', stage: 'revisao' },
  agendado: { label: 'Agendado', stage: 'agendado' },
  publicado: { label: 'Publicado', stage: 'publicado' },
  erro: { label: 'Erro', stage: 'erro' },
}

export function isStage(value: string | null | undefined): value is Stage {
  return value != null && value in STAGES
}

export const CONNECTION_STATUS: Record<
  ConnectionStatus,
  { label: string; title: string; tone: Tone }
> = {
  ok: { label: 'Conectado', title: 'Conexão com o WordPress funcionando', tone: 'success' },
  atencao: { label: 'Atenção', title: 'Revise a conexão com o WordPress', tone: 'warning' },
  erro: { label: 'Sem conexão', title: 'O último teste de conexão falhou', tone: 'danger' },
  nao_testado: { label: 'Não testado', title: 'Conexão ainda não testada', tone: 'neutral' },
}

/** Classes por tom. `dot` = cor sólida (pontos, barras); `soft` = fundo + texto de badge. */
export const TONE_CLASSES: Record<Tone, { dot: string; soft: string; text: string; border: string }> = {
  neutral: {
    dot: 'bg-subtle',
    soft: 'bg-ink/[0.06] text-muted',
    text: 'text-muted',
    border: 'border-line',
  },
  brand: {
    dot: 'bg-brand',
    soft: 'bg-brand-soft text-brand-strong',
    text: 'text-brand',
    border: 'border-brand/25',
  },
  success: {
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-50 text-emerald-700',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  warning: {
    dot: 'bg-amber-500',
    soft: 'bg-amber-50 text-amber-800',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  danger: {
    dot: 'bg-red-500',
    soft: 'bg-red-50 text-red-700',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  violet: {
    dot: 'bg-violet-500',
    soft: 'bg-violet-50 text-violet-700',
    text: 'text-violet-700',
    border: 'border-violet-200',
  },
}
