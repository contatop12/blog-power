import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
import { getClient } from '../lib/db.js'
import {
  createClientMaterial,
  deleteClientMaterial,
  getClientMaterial,
  listClientMaterials,
} from '../lib/materials.js'

const materials = new Hono<{ Bindings: ApiBindings }>()

materials.get('/:clientId/materials', async (c) => {
  const clientId = c.req.param('clientId')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)
  const items = await listClientMaterials(c.env.DB, clientId)
  return c.json(items)
})

materials.post('/:clientId/materials', async (c) => {
  const clientId = c.req.param('clientId')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const form = await c.req.formData()
  const file = form.get('file')
  if (!file || typeof file === 'string') {
    return c.json({ error: 'Campo "file" obrigatório' }, 400)
  }

  try {
    const material = await createClientMaterial(c.env.DB, c.env.IMAGES, clientId, file)
    return c.json(material, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro no upload'
    return c.json({ error: message }, 400)
  }
})

materials.get('/:clientId/materials/:materialId/download', async (c) => {
  const { clientId, materialId } = c.req.param()
  const material = await getClientMaterial(c.env.DB, clientId, materialId)
  if (!material) return c.json({ error: 'Material não encontrado' }, 404)

  const obj = await c.env.IMAGES.get(material.r2_key)
  if (!obj) return c.json({ error: 'Arquivo não encontrado no storage' }, 404)

  const headers = new Headers()
  headers.set('Content-Type', material.mime_type)
  headers.set(
    'Content-Disposition',
    `attachment; filename="${encodeURIComponent(material.nome_original)}"`,
  )
  return new Response(obj.body, { headers })
})

materials.delete('/:clientId/materials/:materialId', async (c) => {
  const { clientId, materialId } = c.req.param()
  const ok = await deleteClientMaterial(c.env.DB, c.env.IMAGES, clientId, materialId)
  if (!ok) return c.json({ error: 'Material não encontrado' }, 404)
  return c.json({ ok: true })
})

export default materials
