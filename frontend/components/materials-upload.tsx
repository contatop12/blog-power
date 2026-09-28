'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Download,
  FileText,
  FolderOpen,
  ImageIcon,
  Info,
  Paperclip,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardTitle, Panel } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Notice } from '@/components/ui/notice'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { formatBytes } from '@/lib/client-form'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ClientMaterial } from '@publisher-p12/types'

const ACCEPT =
  '.pdf,.txt,.md,.docx,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,text/markdown,image/*'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** Rótulo curto e ícone do tipo do arquivo. */
function fileKind(m: ClientMaterial): { label: string; image: boolean } {
  const mime = m.mime_type
  if (mime.startsWith('image/')) {
    const sub = mime.slice(6).toUpperCase()
    return { label: sub === 'JPEG' ? 'JPG' : sub, image: true }
  }
  if (mime === 'application/pdf') return { label: 'PDF', image: false }
  if (mime === DOCX_MIME) return { label: 'DOCX', image: false }
  if (mime === 'text/markdown' || mime === 'text/x-markdown') return { label: 'MD', image: false }
  if (mime === 'text/plain') return { label: 'TXT', image: false }
  const ext = m.nome_original.split('.').pop()
  return { label: ext && ext !== m.nome_original ? ext.toUpperCase() : 'Arquivo', image: false }
}

function MaterialsSkeleton() {
  return (
    <div className="divide-y divide-line" aria-busy="true" aria-label="Carregando materiais">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <Skeleton className="size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
      ))}
    </div>
  )
}

interface MaterialsUploadProps {
  clientId: string
}

export function MaterialsUpload({ clientId }: MaterialsUploadProps) {
  const [materials, setMaterials] = useState<ClientMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    api.materials
      .list(clientId)
      .then(setMaterials)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [clientId])

  useEffect(() => {
    load()
  }, [load])

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files)
    if (list.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (const file of list) {
        await api.materials.upload(clientId, file)
      }
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o arquivo. Tente de novo.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(material: ClientMaterial) {
    if (
      !confirm(
        `Remover "${material.nome_original}" dos materiais do cliente?\n\nO arquivo é apagado e não dá para desfazer.`,
      )
    )
      return
    const id = material.id
    setDeletingId(id)
    setError(null)
    try {
      await api.materials.delete(clientId, id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover o arquivo. Tente de novo.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDownload(id: string, filename: string) {
    setDownloadingId(id)
    setError(null)
    try {
      await api.materials.download(clientId, id, filename)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível baixar o arquivo. Tente de novo.')
    } finally {
      setDownloadingId(null)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    void uploadFiles(e.dataTransfer.files)
  }

  const firstLoad = loading && materials.length === 0

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="size-4 text-muted" aria-hidden />
          Materiais de referência
        </CardTitle>
        <CardDescription>
          Briefings, guias de marca, artigos de referência e imagens do cliente, guardados num só
          lugar para a equipe consultar e baixar quando precisar.
        </CardDescription>
        <p className="mt-2 flex items-start gap-1.5 text-[13px] text-subtle">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Os agentes ainda não leem estes arquivos. O que deve orientar a escrita vai no perfil
            do cliente.
          </span>
        </p>

        <div
          className={cn(
            'mt-5 flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150',
            dragOver ? 'border-brand bg-brand-soft/70' : 'border-line-strong bg-canvas/50',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={(e) => {
            // Passar por cima dos filhos da zona também dispara dragleave: só sai de fato ao deixar a zona
            if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
            setDragOver(false)
          }}
          onDrop={onDrop}
          aria-busy={uploading || undefined}
        >
          <span
            className={cn(
              'grid size-12 place-items-center rounded-full text-brand transition-transform duration-150 [&_svg]:size-6',
              dragOver ? 'scale-110 bg-surface' : 'bg-brand-soft',
            )}
            aria-hidden
          >
            <UploadCloud />
          </span>
          <p className="mt-3 text-sm font-medium text-ink">
            {dragOver ? 'Solte para enviar' : uploading ? 'Enviando arquivos…' : 'Arraste arquivos para cá'}
          </p>
          <p className="mt-1 max-w-sm text-[13px] text-muted">
            PDF, DOCX, TXT, MD ou imagens JPG, PNG e WEBP. Até 10 MB por arquivo.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            loading={uploading}
            loadingText="Enviando…"
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip aria-hidden />
            Escolher arquivos
          </Button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            accept={ACCEPT}
            onChange={(e) => e.target.files && void uploadFiles(e.target.files)}
          />
        </div>
      </Card>

      {error && (
        <Notice tone="danger" className="animate-fade-in">
          {error}
        </Notice>
      )}

      <Panel
        icon={<Paperclip />}
        title={
          <span className="flex items-center gap-2">
            Arquivos enviados
            {materials.length > 0 && <Badge className="tabular-nums">{materials.length}</Badge>}
          </span>
        }
        description="Do mais recente para o mais antigo."
        action={
          loading && !firstLoad ? (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Spinner size="sm" />
              Atualizando
            </span>
          ) : undefined
        }
      >
        {firstLoad ? (
          <MaterialsSkeleton />
        ) : materials.length === 0 ? (
          <EmptyState
            compact
            icon={<FolderOpen />}
            title="Nenhum material ainda"
            description="Arraste um arquivo para a área acima ou use Escolher arquivos."
          />
        ) : (
          <ul className="divide-y divide-line">
            {materials.map((m) => {
              const kind = fileKind(m)
              return (
                <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand [&_svg]:size-4"
                    aria-hidden
                  >
                    {kind.image ? <ImageIcon /> : <FileText />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink" title={m.nome_original}>
                      {m.nome_original}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <Badge className="px-2">{kind.label}</Badge>
                      <span className="tabular-nums">{formatBytes(m.tamanho_bytes)}</span>
                      <time dateTime={m.created_at} title={formatDateTime(m.created_at)}>
                        Enviado {formatRelative(m.created_at)}
                      </time>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="max-sm:px-2"
                      aria-label={`Baixar ${m.nome_original}`}
                      loading={downloadingId === m.id}
                      disabled={deletingId === m.id}
                      onClick={() => void handleDownload(m.id, m.nome_original)}
                    >
                      <Download aria-hidden />
                      <span className="max-sm:sr-only">Baixar</span>
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="max-sm:px-2"
                      aria-label={`Remover ${m.nome_original}`}
                      loading={deletingId === m.id}
                      disabled={downloadingId === m.id}
                      onClick={() => void handleDelete(m)}
                    >
                      <Trash2 aria-hidden />
                      <span className="max-sm:sr-only">Remover</span>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
