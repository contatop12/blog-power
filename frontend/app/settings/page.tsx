'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { D1SetupWizard } from '@/components/d1-setup-wizard'
import type { SettingKey, SettingsGroupView } from '@publisher-p12/types'

const FIELD_META: Record<
  SettingKey,
  { label: string; secret?: boolean; placeholder?: string; hint?: string }
> = {
  openrouter_api_key: {
    label: 'API Key',
    secret: true,
    placeholder: 'sk-or-v1-...',
    hint: 'Usada pelos agentes Redator, Editor e Imagem.',
  },
  openrouter_model_redator: { label: 'Modelo — Redator', placeholder: 'anthropic/claude-sonnet-4-5' },
  openrouter_model_editor: { label: 'Modelo — Editor SEO', placeholder: 'anthropic/claude-sonnet-4-5' },
  openrouter_model_imagem: { label: 'Modelo — Imagem', placeholder: 'anthropic/claude-sonnet-4-5' },
  evolution_api_url: {
    label: 'URL da API',
    placeholder: 'https://evolution.seudominio.com',
    hint: 'Base URL da Evolution API v2.',
  },
  evolution_api_key: { label: 'API Key', secret: true },
  evolution_instance: { label: 'Instância', placeholder: 'publisher-p12' },
  evolution_group_id: {
    label: 'ID do grupo WhatsApp',
    placeholder: '120363...@g.us',
    hint: 'JID do grupo que receberá notificações de publicação.',
  },
  cloudflare_account_id: { label: 'Account ID', placeholder: 'abc123...' },
  cloudflare_api_token: {
    label: 'API Token',
    secret: true,
    hint: 'Token com permissão D1, R2 e Workers para setup do banco.',
  },
  image_provider: { label: 'Provider de imagem', placeholder: 'openrouter' },
}

function SettingsSection({
  title,
  description,
  items,
  group,
  values,
  onChange,
  onTest,
  testLabel,
}: {
  title: string
  description: string
  items: SettingsGroupView['openrouter']
  group: keyof SettingsGroupView
  values: Partial<Record<SettingKey, string>>
  onChange: (key: SettingKey, value: string) => void
  onTest?: () => Promise<void>
  testLabel?: string
}) {
  const [testing, setTesting] = useState(false)

  return (
    <section className="card-elevated p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>
        {onTest && (
          <button
            type="button"
            className="btn-ghost h-9 px-4 text-xs"
            disabled={testing}
            onClick={async () => {
              setTesting(true)
              try {
                await onTest()
              } finally {
                setTesting(false)
              }
            }}
          >
            {testing ? 'Testando...' : testLabel ?? 'Testar conexão'}
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((item) => {
          const meta = FIELD_META[item.key]
          return (
            <label key={item.key} className={item.key.includes('model') ? '' : 'sm:col-span-2'}>
              <span className="field-label flex items-center gap-2">
                {meta.label}
                {item.configurado ? (
                  <span className="badge-ok">Configurado</span>
                ) : (
                  <span className="badge-warn">Pendente</span>
                )}
              </span>
              <input
                className="field-input"
                type={meta.secret ? 'password' : 'text'}
                placeholder={
                  meta.placeholder ??
                  (item.valor_mascarado ? item.valor_mascarado : 'Digite para atualizar')
                }
                defaultValue={item.valor ?? ''}
                onChange={(e) => onChange(item.key, e.target.value)}
                autoComplete="off"
              />
              {meta.hint && (
                <span className="mt-1 block text-xs" style={{ color: 'var(--text-muted)' }}>
                  {meta.hint}
                </span>
              )}
            </label>
          )
        })}
      </div>
      <input type="hidden" name={`group-${group}`} value={group} />
    </section>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsGroupView | null>(null)
  const [draft, setDraft] = useState<Partial<Record<SettingKey, string>>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<string | null>(null)

  useEffect(() => {
    api.settings.get().then(setSettings)
  }, [])

  function updateDraft(key: SettingKey, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (Object.keys(draft).length === 0) {
      setMsg('Nenhuma alteração para salvar.')
      return
    }
    setSaving(true)
    setMsg(null)
    try {
      const updated = await api.settings.update(draft)
      setSettings(updated)
      setDraft({})
      setMsg('Credenciais salvas com sucesso.')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function runTest(fn: () => Promise<{ ok: boolean; erro?: string }>, label: string) {
    setTestMsg(null)
    const r = await fn()
    setTestMsg(r.ok ? `${label}: conexão OK` : `${label}: ${r.erro ?? 'falhou'}`)
  }

  if (!settings) {
    return <p style={{ color: 'var(--text-muted)' }}>Carregando configurações...</p>
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--copper)' }}>
          Administração
        </p>
        <h1 className="font-display mt-1 text-3xl font-semibold">Credenciais e integrações</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Chaves secretas são criptografadas no banco. Valores mascarados nunca exibem o conteúdo
          completo.
        </p>
      </header>

      <form onSubmit={handleSave} className="space-y-6">
        <SettingsSection
          title="OpenRouter"
          description="IA para redação, edição SEO e geração de imagens."
          items={settings.openrouter}
          group="openrouter"
          values={draft}
          onChange={updateDraft}
          onTest={() => runTest(api.settings.testOpenRouter, 'OpenRouter')}
          testLabel="Testar OpenRouter"
        />
        <SettingsSection
          title="Evolution API"
          description="Notificações WhatsApp ao grupo quando uma publicação for agendada."
          items={settings.evolution}
          group="evolution"
          values={draft}
          onChange={updateDraft}
          onTest={() => runTest(api.settings.testEvolution, 'Evolution')}
          testLabel="Testar Evolution"
        />
        <SettingsSection
          title="Cloudflare"
          description="Account ID e token para configurar D1, R2 e deploy da ferramenta."
          items={settings.cloudflare}
          group="cloudflare"
          values={draft}
          onChange={updateDraft}
          onTest={() => runTest(api.settings.testCloudflare, 'Cloudflare')}
          testLabel="Testar token"
        />

        {msg && (
          <p className="text-sm" style={{ color: msg.includes('sucesso') ? 'var(--success)' : 'var(--danger)' }}>
            {msg}
          </p>
        )}
        {testMsg && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {testMsg}
          </p>
        )}

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar credenciais'}
        </button>
      </form>

      <D1SetupWizard />
    </div>
  )
}
