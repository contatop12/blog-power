'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
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
    await api.materials.delete(clientId, id)
    load()
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
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Enviando...' : 'Selecionar arquivos'}
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
        {loading && <p className="text-sm text-zinc-500">Carregando materiais...</p>}
        {!loading && materials.length === 0 && (
          <p className="text-sm text-zinc-500">Nenhum material enviado ainda.</p>
        )}
        <ul className="divide-y divide-zinc-100">
          {materials.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-sm">{m.nome_original}</p>
                <p className="text-xs text-zinc-500">
                  {formatBytes(m.tamanho_bytes)} · {m.mime_type} ·{' '}
                  {new Date(m.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="text-sm text-blue-700 hover:underline"
                  onClick={() => void api.materials.download(clientId, m.id, m.nome_original)}
                >
                  Baixar
                </button>
                <button
                  type="button"
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => void handleDelete(m.id)}
                >
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
