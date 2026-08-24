import { Hono } from 'hono'
import type { ApiBindings } from '../bindings.js'
import { getDashboard } from '../lib/db.js'

const dashboard = new Hono<{ Bindings: ApiBindings }>()

dashboard.get('/', async (c) => {
  const data = await getDashboard(c.env.DB)
  return c.json(data)
})

export default dashboard
