'use client'

import { useRouter } from 'next/navigation'
import { ClientForm } from '@/components/client-form'
import { api } from '@/lib/api'

export default function NewClientPage() {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Novo cliente</h1>
      <ClientForm
        submitLabel="Criar cliente"
        onSubmit={async (data) => {
          const client = await api.clients.create(data)
          router.push(`/clients/${client.id}`)
        }}
      />
    </div>
  )
}
