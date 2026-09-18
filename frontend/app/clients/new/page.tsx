'use client'

import { useRouter } from 'next/navigation'
import { ClientForm } from '@/components/client-form'
import { api } from '@/lib/api'

export default function NewClientPage() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Novo cliente</h1>
        <p className="mt-1 text-sm text-slate-500">
          Depois de criar, você vai direto para a aba Perfil: as perguntas sobre o negócio que
          os agentes usam para escrever os artigos.
        </p>
      </div>
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
