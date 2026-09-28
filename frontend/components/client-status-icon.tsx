import type { ConnectionStatus } from '@publisher-p12/types'
import { StatusDot } from '@/components/ui/badge'
import { CONNECTION_STATUS } from '@/lib/status'
import { cn } from '@/lib/utils'

interface ClientStatusIconProps {
  status: ConnectionStatus
  className?: string
}

/** Ponto com halo: verde (ok), âmbar (atenção), vermelho (erro), cinza (não testado). */
export function ClientStatusIcon({ status, className }: ClientStatusIconProps) {
  const meta = CONNECTION_STATUS[status]
  return (
    <StatusDot
      tone={meta.tone}
      label={meta.title}
      className={cn('size-2.5 rounded-full ring-4 ring-ink/[0.04]', className)}
    />
  )
}

export function clientStatusTitle(status: ConnectionStatus): string {
  return CONNECTION_STATUS[status].title
}
