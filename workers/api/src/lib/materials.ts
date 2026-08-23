import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import type { ClientMaterial } from '@publisher-p12/types'

const ALLOWED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const MAX_BYTES = 10 * 1024 * 1024

interface MaterialRow {
  id: string
  client_id: string
  nome: string
  nome_original: string
  mime_type: string
  r2_key: string
  tamanho_bytes: number
  created_at: string
}

function rowToMaterial(row: MaterialRow): ClientMaterial {
  return {
    id: row.id,
    client_id: row.client_id,
    nome: row.nome,
    nome_original: row.nome_original,
    mime_type: row.mime_type,
    tamanho_bytes: row.tamanho_bytes,
    created_at: row.created_at,
  }
}

export async function listClientMaterials(
  db: D1Database,
  clientId: string,
): Promise<ClientMaterial[]> {
  const { results } = await db
    .prepare('SELECT * FROM client_materials WHERE client_id = ? ORDER BY created_at DESC')
    .bind(clientId)
    .all<MaterialRow>()
  return (results ?? []).map(rowToMaterial)
}

export async function getClientMaterial(
  db: D1Database,
  clientId: string,
  materialId: string,
): Promise<(ClientMaterial & { r2_key: string }) | null> {
  const row = await db
    .prepare('SELECT * FROM client_materials WHERE id = ? AND client_id = ?')
    .bind(materialId, clientId)
    .first<MaterialRow>()
  if (!row) return null
  return { ...rowToMaterial(row), r2_key: row.r2_key }
}

export function validateMaterialFile(file: File): string | null {
  if (file.size > MAX_BYTES) {
    return `Arquivo muito grande (máx. ${MAX_BYTES / 1024 / 1024} MB)`
  }
  const mime = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME.has(mime)) {
    return `Tipo não permitido: ${mime}. Use PDF, TXT, MD, DOCX ou imagens.`
  }
  return null
}

export function materialR2Key(clientId: string, materialId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `materials/${clientId}/${materialId}/${safe}`
}

export async function createClientMaterial(
  db: D1Database,
  r2: R2Bucket,
  clientId: string,
  file: File,
): Promise<ClientMaterial> {
  const validationError = validateMaterialFile(file)
  if (validationError) throw new Error(validationError)

  const id = crypto.randomUUID()
  const r2Key = materialR2Key(clientId, id, file.name)
  const bytes = await file.arrayBuffer()

  await r2.put(r2Key, bytes, {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
    customMetadata: { originalName: file.name, clientId },
  })

  const ts = new Date().toISOString()
  await db
    .prepare(
      `INSERT INTO client_materials (
        id, client_id, nome, nome_original, mime_type, r2_key, tamanho_bytes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, clientId, file.name, file.name, file.type || 'application/octet-stream', r2Key, file.size, ts)
    .run()

  const created = await getClientMaterial(db, clientId, id)
  if (!created) throw new Error('Falha ao registrar material')
  const { r2_key: _, ...material } = created
  void _
  return material
}

export async function deleteClientMaterial(
  db: D1Database,
  r2: R2Bucket,
  clientId: string,
  materialId: string,
): Promise<boolean> {
  const material = await getClientMaterial(db, clientId, materialId)
  if (!material) return false
  await r2.delete(material.r2_key)
  const res = await db
    .prepare('DELETE FROM client_materials WHERE id = ? AND client_id = ?')
    .bind(materialId, clientId)
    .run()
  return (res.meta.changes ?? 0) > 0
}
