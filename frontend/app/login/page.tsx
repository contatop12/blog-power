'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BrandMark } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { setStoredAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Cadeia real do pipeline (directives/README.md) — o último passo é da equipe. */
const CHAIN = [
  { name: 'Pesquisador', text: 'Intenção de busca e risco de canibalização' },
  { name: 'Redator', text: 'Texto a partir do briefing e do perfil do cliente' },
  { name: 'Editor SEO/GEO', text: 'Título, meta e estrutura para buscadores e IAs' },
  { name: 'Links internos', text: 'Só URLs do cliente, validadas uma a uma' },
  { name: 'Imagem e revisão', text: 'Imagem destacada e relatório de qualidade' },
  { name: 'Você', text: 'Aprova e agenda no WordPress do cliente' },
]

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
      setErro(result.erro ?? 'Usuário ou senha incorretos.')
      setTentativas(result.tentativas_restantes ?? null)
      setBloqueado(result.bloqueado_ate ?? null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Sem conexão com a API.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-night px-12 py-12 text-white lg:flex lg:flex-col">
        <BrandMark />

        <div className="my-auto max-w-md py-12">
          <h1 className="text-[40px] font-extrabold leading-[1.05] tracking-[-0.035em] text-white">
            Da pauta ao post agendado.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">
            Uma equipe de agentes pesquisa, escreve e revisa cada artigo. Você decide o que vai ao
            ar.
          </p>

          <ol className="mt-10">
            {CHAIN.map((step, i) => {
              const last = i === CHAIN.length - 1
              return (
                <li
                  key={step.name}
                  className="relative flex animate-slide-up gap-4 pb-5 last:pb-0"
                  style={{ animationDelay: `${120 + i * 90}ms` }}
                >
                  {!last && (
                    <span className="absolute left-[11px] top-7 h-[calc(100%-1.5rem)] w-px bg-white/15" aria-hidden />
                  )}
                  <span
                    className={cn(
                      'relative grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums',
                      last ? 'bg-brand text-white ring-4 ring-brand/25' : 'bg-white/10 text-white/70',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="-mt-0.5">
                    <span className={cn('block text-sm font-semibold', last ? 'text-white' : 'text-white/90')}>
                      {step.name}
                    </span>
                    <span className="block text-[13px] text-white/50">{step.text}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        <p className="text-xs text-white/40">P12 Digital</p>
      </aside>

      <div className="flex flex-col justify-center bg-surface px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <BrandMark tone="light" />
          </div>

          <h2 className="mt-10 text-[28px] font-extrabold tracking-[-0.025em] lg:mt-0">Entrar</h2>
          <p className="mt-1.5 text-sm text-muted">
            Acesso da equipe editorial. Depois de várias tentativas erradas o acesso fica bloqueado por
            um tempo.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="block">
              <span className="field-label">Usuário</span>
              <input
                className="field-input h-11"
                autoComplete="username"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                required
                autoFocus
              />
            </label>
            <label className="block">
              <span className="field-label">Senha</span>
              <input
                className="field-input h-11"
                type="password"
                autoComplete="current-password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
              />
            </label>

            {erro && (
              <Notice tone="danger" title={erro} className="animate-fade-in">
                {tentativas !== null && tentativas > 0 && (
                  <span className="block">
                    {tentativas === 1 ? 'Resta 1 tentativa.' : `Restam ${tentativas} tentativas.`}
                  </span>
                )}
                {bloqueado && (
                  <span className="block">
                    Tente de novo depois de {new Date(bloqueado).toLocaleString('pt-BR')}.
                  </span>
                )}
              </Notice>
            )}

            <Button type="submit" className="h-11 w-full" loading={loading} loadingText="Entrando…">
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
