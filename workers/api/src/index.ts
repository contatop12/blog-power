import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { ApiBindings } from './bindings.js'
import clientsRouter from './routes/clients.js'
import materialsRouter from './routes/materials.js'
import articlesRouter from './routes/articles.js'
import jobsRouter from './routes/jobs.js'
import authRouter from './routes/auth.js'
import settingsRouter from './routes/settings.js'
import dashboardRouter from './routes/dashboard.js'
import { authenticateRequest } from './lib/authGuard.js'
import { parseAllowedOrigins } from '@publisher-p12/execution'

const PUBLIC_PATHS = new Set(['/health', '/auth/login'])

const app = new Hono<{ Bindings: ApiBindings }>()

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowed = parseAllowedOrigins(c.env.ALLOWED_ORIGINS, c.env.ENVIRONMENT)
      if (c.env.ENVIRONMENT === 'development') return origin || '*'
      if (!origin) return allowed[0] ?? ''
      return allowed.includes(origin) ? origin : ''
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)

app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next()

  const path = new URL(c.req.url).pathname
  if (PUBLIC_PATHS.has(path)) return next()

  const result = await authenticateRequest(c)
  if (!result.ok) {
    return c.json(result.body, result.status)
  }

  return next()
})

app.get('/health', (c) =>
  c.json({ ok: true, service: 'blog-power', environment: c.env.ENVIRONMENT }),
)

app.route('/auth', authRouter)
app.route('/dashboard', dashboardRouter)
app.route('/settings', settingsRouter)
app.route('/clients', clientsRouter)
app.route('/clients', materialsRouter)
app.route('/articles', articlesRouter)
app.route('/jobs', jobsRouter)

export default app
