'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { CfD1DatabaseInfo, D1SetupStatus } from '@publisher-p12/types'

type WizardStep = 1 | 2 | 3 | 4

export function D1SetupWizard() {
  const [step, setStep] = useState<WizardStep>(1)
  const [cfOk, setCfOk] = useState<boolean | null>(null)
  const [d1Status, setD1Status] = useState<D1SetupStatus | null>(null)
  const [databases, setDatabases] = useState<CfD1DatabaseInfo[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshStatus = useCallback(async () => {
    const status = await api.settings.d1Status()
    setD1Status(status)
    return status
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  async function testCloudflare() {
    setLoading(true)
    setMsg(null)
    try {
      const r = await api.settings.testCloudflare()
      setCfOk(r.ok)
      setMsg(r.ok ? 'Token Cloudflare válido.' : 'Token inválido ou sem permissão.')
      if (r.ok) setStep(2)
    } catch (err) {
      setCfOk(false)
      setMsg(err instanceof Error ? err.message : 'Erro ao testar')
    } finally {
      setLoading(false)
    }
  }

  async function loadDatabases() {
    setLoading(true)
    setMsg(null)
    try {
      const r = await api.settings.listCfD1()
      setDatabases(r.databases)
      setMsg(`${r.databases.length} banco(s) D1 encontrado(s) na conta.`)
      setStep(3)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao listar D1')
    } finally {
      setLoading(false)
    }
  }

  async function applySchema() {
    setLoading(true)
    setMsg(null)
    try {
      const r = await api.settings.applyD1()
      await refreshStatus()
      setMsg(
        r.ok
          ? `Schema aplicado (${r.applied} statements). Banco pronto.`
          : `Aplicado parcialmente. Tabelas faltando: ${r.after_missing.join(', ')}`,
      )
      if (r.ok) setStep(4)
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao aplicar schema')
    } finally {
      setLoading(false)
    }
  }

  async function createDatabase() {
    setLoading(true)
    setMsg(null)
    try {
      const r = await api.settings.createCfD1('publisher-db')
      setMsg(`${r.instrucao}`)
      await loadDatabases()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Erro ao criar banco')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    { n: 1, label: 'Validar Cloudflare' },
    { n: 2, label: 'Listar D1' },
    { n: 3, label: 'Aplicar schema' },
    { n: 4, label: 'Concluído' },
  ] as const

  return (
    <section className="card-elevated p-6">
      <h2 className="font-display text-xl font-semibold">Wizard — Setup D1</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
        Configure o banco de dados usando as credenciais Cloudflare salvas acima.
      </p>

      <ol className="mt-6 flex flex-wrap gap-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{
              background: step >= s.n ? 'rgba(193,127,58,0.15)' : 'var(--mist)',
              color: step >= s.n ? 'var(--copper)' : 'var(--text-muted)',
            }}
          >
            {s.n}. {s.label}
          </li>
        ))}
      </ol>

      {d1Status && (
        <div className="mt-4 rounded-lg p-3 text-sm" style={{ background: 'var(--paper)' }}>
          <p>
            Status atual:{' '}
            {d1Status.ready ? (
              <span style={{ color: 'var(--success)' }}>banco pronto</span>
            ) : (
              <span style={{ color: 'var(--copper)' }}>pendente</span>
            )}
          </p>
          {d1Status.tables_missing.length > 0 && (
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              Faltando: {d1Status.tables_missing.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {step === 1 && (
          <button type="button" className="btn-primary" disabled={loading} onClick={() => void testCloudflare()}>
            {loading ? 'Testando...' : '1. Testar token Cloudflare'}
          </button>
        )}
        {step >= 2 && cfOk && (
          <>
            <button type="button" className="btn-ghost" disabled={loading} onClick={() => void loadDatabases()}>
              2. Listar bancos D1
            </button>
            <button type="button" className="btn-ghost" disabled={loading} onClick={() => void createDatabase()}>
              Criar publisher-db
            </button>
          </>
        )}
        {step >= 3 && (
          <button type="button" className="btn-primary" disabled={loading} onClick={() => void applySchema()}>
            {loading ? 'Aplicando...' : '3. Aplicar schema no D1 local/vinculado'}
          </button>
        )}
      </div>

      {databases.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {databases.map((db) => (
            <li key={db.uuid} className="rounded border px-3 py-2" style={{ borderColor: 'var(--mist)' }}>
              <strong>{db.name}</strong>
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                {db.uuid}
              </span>
            </li>
          ))}
        </ul>
      )}

      {msg && (
        <p className="mt-4 text-sm" style={{ color: 'var(--text-muted)' }} role="status">
          {msg}
        </p>
      )}
    </section>
  )
}
