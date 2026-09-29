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

const INKS = ['bg-process-cyan', 'bg-process-magenta', 'bg-process-yellow', 'bg-white']

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
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-night px-14 py-12 text-white lg:flex lg:flex-col">
        <BrandMark />

        <div className="my-auto max-w-xl py-14">
          <h1 className="font-display text-[88px] font-black leading-[0.82] tracking-[-0.03em] text-white">
            Da pauta
            <br />
            ao post
            <br />
            agendado<span className="text-process-cyan">.</span>
          </h1>
          <p className="mt-7 max-w-md text-base leading-relaxed text-white/60">
            Uma equipe de agentes pesquisa, escreve e revisa cada artigo. Você decide o que vai ao ar.
          </p>

          <ol className="mt-12 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {CHAIN.map((step, i) => {
              const last = i === CHAIN.length - 1
              return (
                <li
                  key={step.name}
                  className="flex animate-slide-up gap-3"
                  style={{ animationDelay: `${200 + i * 80}ms` }}
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-[4px] font-display text-xs font-black tabular-nums',
                      last ? 'bg-process-cyan text-white' : 'border border-white/20 text-white/70',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className={cn('block text-sm font-semibold', last ? 'text-white' : 'text-white/90')}>
                      {step.name}
                    </span>
                    <span className="block text-[13px] leading-snug text-white/50">{step.text}</span>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex gap-1" aria-hidden>
            {INKS.map((c) => (
              <span key={c} className={cn('h-2.5 w-8 rounded-[1px]', c)} />
            ))}
          </span>
          <span className="text-xs text-white/40">P12 Digital</span>
        </div>
      </aside>

      <div className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <BrandMark tone="light" />
          </div>

          <h2 className="mt-12 font-display text-[44px] font-black leading-none tracking-[-0.02em] lg:mt-0">
            Entrar
          </h2>
          <p className="mt-3 text-sm text-muted">
            Acesso da equipe editorial. Depois de várias tentativas erradas o acesso fica bloqueado por
            um tempo.
          </p>

          <form onSubmit={handleSubmit} className="mt-9 space-y-5">
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

            <Button type="submit" className="h-12 w-full text-[15px]" loading={loading} loadingText="Entrando…">
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
