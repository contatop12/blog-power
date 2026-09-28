'use client'

import { useState } from 'react'
import { ChevronRight, Download, ExternalLink, Puzzle } from 'lucide-react'
import { Button, buttonClass } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import {
  BridgeFtpAlternative,
  BridgeSecurityNotes,
  GuideSteps,
} from '@/components/client-form-guides'
import { GuideDialog } from '@/components/field-hint'

interface InstallBridgeButtonProps {
  /** Domínio do cliente, ex.: https://abxtelecom.com.br */
  dominio: string
  size?: 'sm' | 'md'
  className?: string
}

function wpPluginUploadUrl(dominio: string): string {
  try {
    const base = dominio.replace(/\/$/, '')
    return `${base}/wp-admin/plugin-install.php?tab=upload`
  } catch {
    return '#'
  }
}

export function InstallBridgeButton({ dominio, size = 'md', className }: InstallBridgeButtonProps) {
  const [open, setOpen] = useState(false)

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
      <Button type="button" variant="outline" size={size} className={className} onClick={handleInstall}>
        <Puzzle aria-hidden />
        Instalar no WordPress
      </Button>

      <GuideDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Instalar o P12 Bridge no WordPress"
        icon={<Puzzle />}
        footer={
          <>
            <a
              href="/p12-publisher-bridge.zip"
              download="p12-publisher-bridge.zip"
              className={buttonClass('outline', undefined, 'sm')}
            >
              <Download aria-hidden />
              Baixar ZIP de novo
            </a>
            <a
              href={wpPluginUploadUrl(dominio)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass('outline', undefined, 'sm')}
            >
              <ExternalLink aria-hidden />
              Abrir upload no WordPress
            </a>
          </>
        }
      >
        <Notice tone="success" title="Download iniciado">
          O arquivo <strong>p12-publisher-bridge.zip</strong> foi baixado e a tela de upload do
          WordPress abriu em outra aba. Faça login no wp-admin se ele pedir.
        </Notice>

        <section>
          <h3 className="text-sm font-semibold text-ink">No WordPress do cliente</h3>
          <div className="mt-2.5">
            <GuideSteps
              steps={[
                <>
                  Em <strong>Enviar plugin</strong>, escolha o ZIP baixado.
                </>,
                <>
                  Clique em <strong>Instalar agora</strong>.
                </>,
                <>
                  Clique em <strong>Ativar plugin</strong>.
                </>,
                <>
                  Volte aqui e clique em <strong>Testar conexão</strong>.
                </>,
              ]}
            />
          </div>
        </section>

        <details className="group rounded-lg border border-line">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
            <ChevronRight
              className="size-4 text-muted transition-transform duration-150 group-open:rotate-90"
              aria-hidden
            />
            Segurança e instalação via FTP
          </summary>
          <div className="space-y-5 border-t border-line px-3.5 py-4">
            <BridgeSecurityNotes />
            <BridgeFtpAlternative />
          </div>
        </details>
      </GuideDialog>
    </>
  )
}
