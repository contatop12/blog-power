'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { FieldLabel } from '@/components/field-hint'
import { SEO_PLUGINS, emptyClientForm } from '@/lib/client-form'
import type { Client, CreateClientInput } from '@publisher-p12/types'

interface ClientFormProps {
  initial?: Client
  onSubmit: (data: CreateClientInput & { wp_app_password?: string }) => Promise<void>
  submitLabel: string
}

const HINTS = {
  nome: 'Nome comercial do cliente (empresa ou marca). Aparece no painel e nos relatórios.',
  dominio:
    'URL completa do site, com https://. Ex.: https://abxtelecom.com.br — usada para links internos e validação.',
  timezone:
    'Fuso do cliente para agendar posts no horário local. Padrão Brasil: America/Sao_Paulo. Lista IANA (ex.: America/Manaus).',
  wp_api_url:
    'Endpoint REST do WordPress. Em geral é o domínio + /wp-json. Ex.: https://site.com.br/wp-json — sem barra no final.',
  wp_user:
    'Usuário WordPress com permissão de Editor ou Administrador. Deve ser o mesmo usado para gerar a Application Password.',
  wp_app_password:
    'Senha de aplicativo do WordPress (não a senha de login). Em WP: Usuários → Perfil → Application Passwords. Cole o código gerado (pode ter espaços).',
  seo_plugin:
    'Plugin SEO ativo no site do cliente. Define como título e meta description são enviados. Escolha Yoast, Rank Math ou Nenhum.',
} as const

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

  const inputClass =
    'mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardTitle>Dados do cliente</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Passe o mouse no ícone <strong className="text-blue-700">!</strong> de cada campo para ver
          a orientação.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <FieldLabel label="Nome" hint={HINTS.nome} className="block text-sm sm:col-span-2">
            <input
              className={inputClass}
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: ABX Telecom"
              required
            />
          </FieldLabel>

          <FieldLabel label="Domínio" hint={HINTS.dominio}>
            <input
              className={inputClass}
              placeholder="https://exemplo.com.br"
              value={form.dominio}
              onChange={(e) => setForm({ ...form, dominio: e.target.value })}
              required
            />
          </FieldLabel>

          <FieldLabel label="Fuso horário" hint={HINTS.timezone}>
            <input
              className={inputClass}
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              placeholder="America/Sao_Paulo"
            />
          </FieldLabel>

          <FieldLabel
            label="URL da API WordPress"
            hint={HINTS.wp_api_url}
            className="block text-sm sm:col-span-2"
          >
            <input
              className={inputClass}
              placeholder="https://exemplo.com.br/wp-json"
              value={form.wp_api_url}
              onChange={(e) => setForm({ ...form, wp_api_url: e.target.value })}
              required
            />
          </FieldLabel>

          <FieldLabel label="Usuário WP" hint={HINTS.wp_user}>
            <input
              className={inputClass}
              value={form.wp_user}
              onChange={(e) => setForm({ ...form, wp_user: e.target.value })}
              placeholder="usuario-editor"
              required
            />
          </FieldLabel>

          <FieldLabel label="Application Password" hint={HINTS.wp_app_password}>
            <input
              className={inputClass}
              type="password"
              placeholder={initial ? 'Deixe vazio para manter' : 'xxxx xxxx xxxx xxxx xxxx xxxx'}
              value={form.wp_app_password}
              onChange={(e) => setForm({ ...form, wp_app_password: e.target.value })}
              required={!initial}
              autoComplete="new-password"
            />
          </FieldLabel>

          <FieldLabel label="Plugin SEO" hint={HINTS.seo_plugin}>
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
          </FieldLabel>
        </div>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving}>
        {saving ? 'Salvando...' : submitLabel}
      </Button>
    </form>
  )
}
