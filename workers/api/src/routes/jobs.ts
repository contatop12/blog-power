import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
import { getJob } from '../lib/db.js'

const jobs = new Hono<{ Bindings: ApiBindings }>()

jobs.get('/:id', async (c) => {
  const job = await getJob(c.env.DB, c.req.param('id'))
  if (!job) return c.json({ error: 'Job não encontrado' }, 404)
  return c.json(job)
})

export default jobs
