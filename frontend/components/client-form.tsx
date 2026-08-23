'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import {
  SEO_PLUGINS,
  arrayToLines,
  emptyClientForm,
  formatServicos,
  linesToArray,
  parseServicos,
} from '@/lib/client-form'
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
      perfil_marca: initial.perfil_marca ?? emptyClientForm().perfil_marca,
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const perfil = form.perfil_marca!

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload: CreateClientInput & { wp_app_password?: string } = {
        ...form,
        perfil_marca: perfil,
      }
      if (!payload.wp_app_password) delete payload.wp_app_password
      await onSubmit(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function updatePerfil<K extends keyof typeof perfil>(key: K, value: (typeof perfil)[K]) {
    setForm((f) => ({ ...f, perfil_marca: { ...f.perfil_marca!, [key]: value } }))
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

      <Card>
        <CardTitle>Perfil de marca</CardTitle>
        <p className="mt-1 text-sm text-zinc-500">
          Contexto usado pelos agentes Redator e Editor. Quanto mais completo, melhor a qualidade.
        </p>
        <div className="mt-4 grid gap-4">
          <label className="block text-sm">
            Descrição institucional
            <textarea
              className={inputClass}
              rows={3}
              value={perfil.descricao_institucional}
              onChange={(e) => updatePerfil('descricao_institucional', e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Segmentos atendidos (um por linha)
            <textarea
              className={inputClass}
              rows={3}
              value={arrayToLines(perfil.segmentos_atendidos)}
              onChange={(e) => updatePerfil('segmentos_atendidos', linesToArray(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            Serviços (formato: Nome | URL — um por linha)
            <textarea
              className={inputClass}
              rows={4}
              value={formatServicos(perfil.servicos)}
              onChange={(e) => updatePerfil('servicos', parseServicos(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            Provas E-E-A-T (um por linha)
            <textarea
              className={inputClass}
              rows={3}
              value={arrayToLines(perfil.provas_eeat)}
              onChange={(e) => updatePerfil('provas_eeat', linesToArray(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            Tom de voz
            <textarea
              className={inputClass}
              rows={2}
              value={perfil.tom_de_voz}
              onChange={(e) => updatePerfil('tom_de_voz', e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Proibições editoriais (um por linha)
            <textarea
              className={inputClass}
              rows={3}
              value={arrayToLines(perfil.proibicoes)}
              onChange={(e) => updatePerfil('proibicoes', linesToArray(e.target.value))}
            />
          </label>
          <label className="block text-sm">
            CTA padrão
            <textarea
              className={inputClass}
              rows={2}
              value={perfil.cta_padrao}
              onChange={(e) => updatePerfil('cta_padrao', e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Diretriz visual (imagens)
            <textarea
              className={inputClass}
              rows={2}
              value={perfil.diretriz_visual}
              onChange={(e) => updatePerfil('diretriz_visual', e.target.value)}
            />
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
