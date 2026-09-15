'use client'

import { useEffect, useId, useState } from 'react'
import { Button, buttonClass } from '@/components/ui/button'
import { MuPluginGuide } from '@/components/client-form-guides'

interface InstallBridgeButtonProps {
  /** Domínio do cliente, ex.: https://abxtelecom.com.br */
  dominio: string
}

function wpPluginUploadUrl(dominio: string): string {
  try {
    const base = dominio.replace(/\/$/, '')
    return `${base}/wp-admin/plugin-install.php?tab=upload`
  } catch {
    return '#'
  }
}

export function InstallBridgeButton({ dominio }: InstallBridgeButtonProps) {
  const [open, setOpen] = useState(false)
  const dialogId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function handleInstall() {
    // Dispara download do ZIP instalável no WP Admin
    const a = document.createElement('a')
    a.href = '/p12-publisher-bridge.zip'
    a.download = 'p12-publisher-bridge.zip'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()

    const uploadUrl = wpPluginUploadUrl(dominio)
    window.open(uploadUrl, '_blank', 'noopener,noreferrer')
    setOpen(true)
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={handleInstall}>
        Instalar no WordPress
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
          />
          <div
            id={dialogId}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${dialogId}-title`}
            className="relative z-10 max-h-[85vh] w-full max-w-lg animate-pop-in overflow-y-auto rounded-xl border border-emerald-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id={`${dialogId}-title`} className="text-base font-semibold text-emerald-900">
                Instalar P12 Bridge no WordPress
              </h3>
              <button
                type="button"
                className="shrink-0 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                onClick={() => setOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-700">
              <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-950">
                O ZIP <strong>p12-publisher-bridge.zip</strong> foi baixado e a tela de upload do
                WordPress abriu em nova aba (faça login no wp-admin se pedir).
              </p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>
                  Em <strong>Enviar plugin</strong>, escolha o arquivo ZIP baixado
                </li>
                <li>
                  Clique em <strong>Instalar agora</strong>
                </li>
                <li>
                  Depois clique em <strong>Ativar plugin</strong>
                </li>
                <li>
                  Volte aqui e use <strong>Testar conexão</strong>
                </li>
              </ol>
              <MuPluginGuide />
              <div className="flex flex-wrap gap-2 pt-2">
                <a
                  href="/p12-publisher-bridge.zip"
                  download="p12-publisher-bridge.zip"
                  className={buttonClass('outline', 'h-9 text-sm')}
                >
                  Baixar ZIP de novo
                </a>
                <a
                  href={wpPluginUploadUrl(dominio)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass('outline', 'h-9 text-sm')}
                >
                  Abrir upload no WP
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
