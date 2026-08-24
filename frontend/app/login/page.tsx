'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setStoredAuth } from '@/lib/auth'
import { api } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [tentativas, setTentativas] = useState<number | null>(null)
  const [bloqueado, setBloqueado] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErro(null)
    setBloqueado(null)
    try {
      const result = await api.auth.login(user, pass)
      if (result.ok && result.token) {
        setStoredAuth(result.token)
        router.replace('/')
        return
      }
      setErro(result.erro ?? 'Falha no login')
      setTentativas(result.tentativas_restantes ?? null)
      setBloqueado(result.bloqueado_ate ?? null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro de conexão')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
      <div className="card-elevated p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">P12 Editorial</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Publisher P12</h1>
        <p className="mt-2 text-sm text-slate-600">
          Acesso restrito à equipe editorial. Tentativas inválidas são limitadas por segurança.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="field-label">Usuário</span>
            <input
              className="field-input"
              autoComplete="username"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              required
            />
          </label>
          <label className="block">
            <span className="field-label">Senha</span>
            <input
              className="field-input"
              type="password"
              autoComplete="current-password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
            />
          </label>

          {erro && (
            <div
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
              role="alert"
            >
              {erro}
              {tentativas !== null && tentativas > 0 && (
                <span className="mt-1 block text-xs">Tentativas restantes: {tentativas}</span>
              )}
              {bloqueado && (
                <span className="mt-1 block text-xs">
                  Bloqueado até: {new Date(bloqueado).toLocaleString('pt-BR')}
                </span>
              )}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
