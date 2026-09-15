import type { ConnectionStatus } from '@publisher-p12/types'

const STATUS_META: Record<ConnectionStatus, { title: string }> = {
  ok: { title: 'Conexão OK' },
  atencao: { title: 'Atenção — revise a conexão WordPress' },
  erro: { title: 'Erro na conexão WordPress' },
  nao_testado: { title: 'Conexão ainda não testada' },
}

interface ClientStatusIconProps {
  status: ConnectionStatus
  className?: string
}

/** Um único ponto colorido: verde (ok), amarelo (atenção), vermelho (erro), cinza (não testado). */
export function ClientStatusIcon({ status, className }: ClientStatusIconProps) {
  const meta = STATUS_META[status]
  const colorClass = {
    ok: 'bg-emerald-500',
    atencao: 'bg-amber-500',
    erro: 'bg-red-500',
    nao_testado: 'bg-slate-400',
  }[status]

  return (
    <span
      className={`inline-block h-3 w-3 shrink-0 rounded-full ${colorClass} ${className ?? ''}`}
      title={meta.title}
      aria-label={meta.title}
      role="img"
    />
  )
}

export function clientStatusTitle(status: ConnectionStatus): string {
  return STATUS_META[status].title
}
