import type { ConnectionStatus } from '@publisher-p12/types'
import { StatusDot } from '@/components/ui/badge'
import { CONNECTION_STATUS } from '@/lib/status'
import { cn } from '@/lib/utils'

interface ClientStatusIconProps {
  status: ConnectionStatus
  className?: string
}

/** Luz de sinal: verde (ok), âmbar (atenção), vermelho (erro), cinza (não testado). */
export function ClientStatusIcon({ status, className }: ClientStatusIconProps) {
  const meta = CONNECTION_STATUS[status]
  return (
    <StatusDot
      tone={meta.tone}
      shape="round"
      label={meta.title}
      pulse={status === 'erro'}
      className={cn('size-2.5 ring-4 ring-ink/[0.05]', className)}
    />
  )
}

export function clientStatusTitle(status: ConnectionStatus): string {
  return CONNECTION_STATUS[status].title
}
