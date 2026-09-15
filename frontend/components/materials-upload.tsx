'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/lib/api'
import { formatBytes } from '@/lib/client-form'
import type { ClientMaterial } from '@publisher-p12/types'

const ACCEPT =
  '.pdf,.txt,.md,.docx,.jpg,.jpeg,.png,.webp,application/pdf,text/plain,text/markdown,image/*'

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
      setError(err instanceof Error ? err.message : 'Erro no upload')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este material?')) return
    setDeletingId(id)
    setError(null)
    try {
      await api.materials.delete(clientId, id)
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover')
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
      setError(err instanceof Error ? err.message : 'Erro ao baixar')
    } finally {
      setDownloadingId(null)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    void uploadFiles(e.dataTransfer.files)
  }

  return (
    <Card>
      <CardTitle>Materiais de referência</CardTitle>
      <p className="mt-1 text-sm text-zinc-500">
        Envie briefings, guias de marca, artigos de referência ou imagens. PDF, TXT, MD, DOCX e
        imagens até 10 MB.
      </p>

      <div
        className={`mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-zinc-300 bg-zinc-50'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <p className="text-sm text-zinc-600">Arraste arquivos aqui ou</p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          loading={uploading}
          loadingText="Enviando..."
          onClick={() => inputRef.current?.click()}
        >
          Selecionar arquivos
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

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Spinner size="sm" className="text-blue-700" />
            Carregando materiais...
          </div>
        )}
        {!loading && materials.length === 0 && (
          <p className="animate-fade-in text-sm text-zinc-500">Nenhum material enviado ainda.</p>
        )}
        <ul className="divide-y divide-zinc-100">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-3 animate-fade-in">
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{m.nome_original}</p>
                <p className="text-xs text-zinc-500">
                  {formatBytes(m.tamanho_bytes)} · {m.mime_type} ·{' '}
                  {new Date(m.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline disabled:opacity-50"
                  disabled={downloadingId === m.id || deletingId === m.id}
                  onClick={() => void handleDownload(m.id, m.nome_original)}
                >
                  {downloadingId === m.id && <Spinner size="sm" />}
                  Baixar
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:underline disabled:opacity-50"
                  disabled={deletingId === m.id || downloadingId === m.id}
                  onClick={() => void handleDelete(m.id)}
                >
                  {deletingId === m.id && <Spinner size="sm" />}
                  Remover
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
