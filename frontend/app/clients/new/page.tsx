'use client'

import { useRouter } from 'next/navigation'
import { ClientForm } from '@/components/client-form'
import { PageHeader } from '@/components/ui/page-header'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

const PASSOS = ['Dados e acesso ao WordPress', 'Perfil do negócio'] as const

/** Os dois passos do cadastro — o primeiro é esta tela. */
function CadastroSteps() {
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label="Etapas do cadastro">
      {PASSOS.map((passo, i) => {
        const atual = i === 0
        return (
          <li key={passo} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-5 bg-line-strong" aria-hidden />}
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[13px] font-medium',
                atual ? 'bg-brand-soft text-brand-strong' : 'bg-ink/[0.05] text-muted',
              )}
              aria-current={atual ? 'step' : undefined}
            >
              <span
                className={cn(
                  'grid size-5 place-items-center rounded-full text-[11px] font-semibold tabular-nums',
                  atual ? 'bg-brand text-white' : 'bg-surface text-muted ring-1 ring-inset ring-line-strong',
                )}
                aria-hidden
              >
                {i + 1}
              </span>
              {passo}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default function NewClientPage() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        back={{ href: '/clients', label: 'Clientes' }}
        title="Novo cliente"
        description="Cadastre o site e o acesso ao WordPress. Em seguida você vai direto para o perfil: as perguntas sobre o negócio que os agentes usam para escrever os artigos."
        meta={<CadastroSteps />}
      />
      <ClientForm
        submitLabel="Criar cliente"
        onSubmit={async (data) => {
          const client = await api.clients.create(data)
          // O pipeline só roda com o perfil preenchido: o próximo passo natural é ele
          router.push(`/clients/${client.id}?tab=perfil`)
        }}
      />
    </div>
  )
}
