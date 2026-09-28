'use client'

import { useState } from 'react'
import { CheckCircle2, Plus, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle } from '@/components/ui/card'
import { Notice } from '@/components/ui/notice'
import { FieldLabel } from '@/components/field-hint'
import { WpApiUrlGuide, WpAppPasswordGuide } from '@/components/client-form-guides'
import { WpDefaultsFields } from '@/components/wp-defaults-fields'
import { SEO_PLUGINS, emptyClientForm } from '@/lib/client-form'
import type { Client, CreateClientInput } from '@publisher-p12/types'

interface ClientFormProps {
  initial?: Client
  clientId?: string
  onSubmit: (data: CreateClientInput & { wp_app_password?: string }) => Promise<void>
  submitLabel: string
}

const HINTS = {
  nome: 'Nome comercial do cliente (empresa ou marca). Aparece no painel e nos relatórios.',
  dominio:
    'URL completa do site, com https://. Ex.: https://abxtelecom.com.br. Usada para links internos e validação.',
  timezone:
    'Fuso do cliente para agendar posts no horário local. Padrão Brasil: America/Sao_Paulo. Lista IANA (ex.: America/Manaus).',
  wp_user:
    'Usuário WordPress com permissão de Editor ou Administrador. Deve ser o mesmo usado para gerar a Application Password.',
  seo_plugin:
    'Plugin SEO ativo no site do cliente. Define como título e meta description são enviados. Escolha Yoast, Rank Math ou Nenhum.',
} as const

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">{children}</div>
    </Card>
  )
}

export function ClientForm({ initial, clientId, onSubmit, submitLabel }: ClientFormProps) {
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
  const [savedAt, setSavedAt] = useState<string | null>(null)

  function update(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }))
    setSavedAt(null)
  }

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
      // Na criação a página navega para o perfil; na edição, confirma aqui
      if (initial) {
        setSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Section
        title="Identificação"
        description="Como o cliente aparece no Publisher e em que fuso os posts são agendados."
      >
        <FieldLabel label="Nome" hint={HINTS.nome} className="sm:col-span-2">
          <input
            className="field-input"
            value={form.nome}
            onChange={(e) => update({ nome: e.target.value })}
            placeholder="Ex.: ABX Telecom"
            required
          />
        </FieldLabel>

        <FieldLabel label="Domínio" hint={HINTS.dominio}>
          <input
            className="field-input"
            inputMode="url"
            spellCheck={false}
            placeholder="https://exemplo.com.br"
            value={form.dominio}
            onChange={(e) => update({ dominio: e.target.value })}
            required
          />
        </FieldLabel>

        <FieldLabel label="Fuso horário" hint={HINTS.timezone}>
          <input
            className="field-input"
            spellCheck={false}
            value={form.timezone}
            onChange={(e) => update({ timezone: e.target.value })}
            placeholder="America/Sao_Paulo"
          />
        </FieldLabel>
      </Section>

      <Section
        title="Acesso ao WordPress"
        description="O Publisher usa estes dados para publicar no site. A Application Password é guardada criptografada e nunca aparece de novo."
      >
        <FieldLabel
          label="URL da API WordPress"
          guide={{ title: 'Como encontrar a URL da API WordPress', content: <WpApiUrlGuide /> }}
          help="Domínio + /wp-json. Não é a URL de login."
          className="sm:col-span-2"
        >
          <input
            className="field-input"
            inputMode="url"
            spellCheck={false}
            placeholder="https://exemplo.com.br/wp-json"
            value={form.wp_api_url}
            onChange={(e) => update({ wp_api_url: e.target.value })}
            required
          />
        </FieldLabel>

        <FieldLabel label="Usuário WP" hint={HINTS.wp_user}>
          <input
            className="field-input"
            spellCheck={false}
            autoComplete="off"
            value={form.wp_user}
            onChange={(e) => update({ wp_user: e.target.value })}
            placeholder="usuario-editor"
            required
          />
        </FieldLabel>

        <FieldLabel
          label="Application Password"
          guide={{
            title: 'Como gerar a Application Password no WordPress',
            content: <WpAppPasswordGuide />,
          }}
          badge={
            initial?.wp_app_password_configurado ? (
              <Badge tone="success" dot>
                Configurada
              </Badge>
            ) : undefined
          }
          help={
            initial
              ? 'Deixe em branco para manter a senha atual.'
              : 'Gerada no perfil do usuário no WordPress. Não é a senha de login.'
          }
        >
          <input
            className="field-input"
            type="password"
            placeholder={initial ? 'Deixe vazio para manter' : 'xxxx xxxx xxxx xxxx xxxx xxxx'}
            value={form.wp_app_password}
            onChange={(e) => update({ wp_app_password: e.target.value })}
            required={!initial}
            autoComplete="new-password"
          />
        </FieldLabel>

        <FieldLabel label="Plugin SEO" hint={HINTS.seo_plugin}>
          <select
            className="field-input"
            value={form.seo_plugin}
            onChange={(e) => update({ seo_plugin: e.target.value as typeof form.seo_plugin })}
          >
            {SEO_PLUGINS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </FieldLabel>
      </Section>

      {clientId && initial && (
        <WpDefaultsFields
          clientId={clientId}
          categoriaPadraoId={form.categoria_padrao_id ?? null}
          autorPadraoId={form.autor_padrao_id ?? null}
          onCategoriaChange={(id) => update({ categoria_padrao_id: id })}
          onAutorChange={(id) => update({ autor_padrao_id: id })}
        />
      )}

      {error && (
        <Notice
          tone="danger"
          title={initial ? 'As alterações não foram salvas' : 'O cliente não foi criado'}
          className="animate-fade-in"
        >
          {error}
        </Notice>
      )}

      <div className="flex flex-col-reverse items-start gap-3 rounded-xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted" aria-live="polite">
          {savedAt ? (
            <span className="inline-flex animate-fade-in items-center gap-1.5 font-medium text-emerald-700">
              <CheckCircle2 className="size-4" aria-hidden />
              Alterações salvas às {savedAt}.
            </span>
          ) : initial ? (
            'As mudanças valem para os próximos artigos e publicações.'
          ) : (
            'Depois de criar, você preenche o perfil do negócio.'
          )}
        </p>
        <Button
          type="submit"
          loading={saving}
          loadingText={initial ? 'Salvando…' : 'Criando cliente…'}
          className="shrink-0"
        >
          {initial ? <Save aria-hidden /> : <Plus aria-hidden />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
