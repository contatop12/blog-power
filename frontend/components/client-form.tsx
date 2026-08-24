'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { SEO_PLUGINS, emptyClientForm } from '@/lib/client-form'
import type { Client, CreateClientInput } from '@publisher-p12/types'

interface ClientFormProps {
  initial?: Client
  onSubmit: (data: CreateClientInput & { wp_app_password?: string }) => Promise<void>
  submitLabel: string
}

export function ClientForm({ initial, onSubmit, submitLabel }: ClientFormProps) {
  const [form, setForm] = useState(() => {
    if (!initial) return emptyClientForm()
    return {
      nome: initial.nome,
      dominio: initial.dominio,
      wp_api_url: initial.wp_api_url,
      wp_user: initial.wp_user,
      wp_app_password: '',
      seo_plugin: initial.seo_plugin,
      timezone: initial.timezone,
      categoria_padrao_id: initial.categoria_padrao_id,
      autor_padrao_id: initial.autor_padrao_id,
      perfil_marca: null,
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload: CreateClientInput & { wp_app_password?: string } = {
        ...form,
        perfil_marca: null,
      }
      if (!payload.wp_app_password) delete payload.wp_app_password
      await onSubmit(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardTitle>Dados do cliente</CardTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            Nome
            <input
              className={inputClass}
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            Domínio
            <input
              className={inputClass}
              placeholder="https://exemplo.com.br"
              value={form.dominio}
              onChange={(e) => setForm({ ...form, dominio: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            Fuso horário
            <input
              className={inputClass}
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            URL da API WordPress
            <input
              className={inputClass}
              placeholder="https://exemplo.com.br/wp-json"
              value={form.wp_api_url}
              onChange={(e) => setForm({ ...form, wp_api_url: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            Usuário WP
            <input
              className={inputClass}
              value={form.wp_user}
              onChange={(e) => setForm({ ...form, wp_user: e.target.value })}
              required
            />
          </label>
          <label className="block text-sm">
            Application Password
            <input
              className={inputClass}
              type="password"
              placeholder={initial ? 'Deixe vazio para manter' : ''}
              value={form.wp_app_password}
              onChange={(e) => setForm({ ...form, wp_app_password: e.target.value })}
              required={!initial}
            />
          </label>
          <label className="block text-sm">
            Plugin SEO
            <select
              className={inputClass}
              value={form.seo_plugin}
              onChange={(e) =>
                setForm({ ...form, seo_plugin: e.target.value as typeof form.seo_plugin })
              }
            >
              {SEO_PLUGINS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : submitLabel}
      </Button>
    </form>
  )
}
