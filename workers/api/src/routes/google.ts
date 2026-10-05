import { Hono } from 'hono'
import {
  GoogleApiError,
  calcularQuickWins,
  createIdeaFromOportunidade,
  getClientGoogle,
  getKeywordVolumes,
  getOportunidade,
  listGscSites,
  listOportunidades,
  marcaTermos,
  queryGscSearchAnalytics,
  saveClientGoogle,
  saveOportunidades,
  setOportunidadeStatus,
} from '@publisher-p12/execution'
import type {
  ClientGoogleView,
  GoogleConta,
  GscSiteOption,
  OportunidadeStatus,
  SyncOportunidadesResult,
} from '@publisher-p12/types'
import type { ApiBindings } from '../bindings.js'
import { getClient } from '../lib/db.js'
import { GOOGLE_CONTAS, googleCreds, isGoogleConta, keywordPlannerConfig } from '../lib/google.js'

const google = new Hono<{ Bindings: ApiBindings }>()

const STATUS_VALIDOS: OportunidadeStatus[] = ['nova', 'em_pauta', 'descartada']

function erroGoogle(e: unknown, padrao: string): { status: 502 | 400; error: string } {
  if (e instanceof GoogleApiError) return { status: 502, error: e.message }
  return { status: 502, error: e instanceof Error ? e.message : padrao }
}

async function sitesDasContas(env: ApiBindings): Promise<{ sites: GscSiteOption[]; erros: ClientGoogleView['erros'] }> {
  const sites: GscSiteOption[] = []
  const erros: ClientGoogleView['erros'] = []
  await Promise.all(
    GOOGLE_CONTAS.map(async (conta) => {
      const creds = googleCreds(env, conta)
      if (!creds) {
        erros.push({ conta, erro: 'Credenciais desta conta não configuradas no Worker' })
        return
      }
      try {
        for (const s of await listGscSites(creds)) sites.push({ site_url: s.siteUrl, conta, permissao: s.permissionLevel })
      } catch (e) {
        erros.push({ conta, erro: e instanceof Error ? e.message : 'Falha ao listar propriedades' })
      }
    }),
  )
  sites.sort((a, b) => a.site_url.localeCompare(b.site_url))
  return { sites, erros }
}

google.get('/:id/google', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const [vinculo, { sites, erros }] = await Promise.all([getClientGoogle(c.env.DB, clientId), sitesDasContas(c.env)])
  const view: ClientGoogleView = { vinculo, sites_disponiveis: sites, erros }
  return c.json(view)
})

google.put('/:id/google', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const body = await c.req
    .json<{ gsc_site_url?: string | null; gsc_conta?: GoogleConta | null }>()
    .catch(() => ({}) as { gsc_site_url?: string | null; gsc_conta?: GoogleConta | null })
  const siteUrl = typeof body.gsc_site_url === 'string' && body.gsc_site_url.trim() ? body.gsc_site_url.trim() : null
  const conta = body.gsc_conta ?? null

  if (siteUrl === null) {
    return c.json(await saveClientGoogle(c.env.DB, clientId, { gsc_site_url: null, gsc_conta: null }))
  }
  if (!isGoogleConta(conta)) return c.json({ error: 'Conta Google inválida (use contato ou ryan)' }, 400)

  const creds = googleCreds(c.env, conta)
  if (!creds) return c.json({ error: 'Credenciais desta conta não configuradas no Worker' }, 400)
  try {
    const sites = await listGscSites(creds)
    if (!sites.some((s) => s.siteUrl === siteUrl)) {
      return c.json({ error: 'Esta conta Google não tem acesso a essa propriedade do Search Console' }, 400)
    }
  } catch (e) {
    const { status, error } = erroGoogle(e, 'Falha ao validar a propriedade')
    return c.json({ error }, status)
  }

  return c.json(await saveClientGoogle(c.env.DB, clientId, { gsc_site_url: siteUrl, gsc_conta: conta }))
})

google.post('/:id/oportunidades/sync', async (c) => {
  const clientId = c.req.param('id')
  const client = await getClient(c.env.DB, clientId)
  if (!client) return c.json({ error: 'Cliente não encontrado' }, 404)

  const vinculo = await getClientGoogle(c.env.DB, clientId)
  if (!vinculo.gsc_site_url || !vinculo.gsc_conta) {
    return c.json({ error: 'Vincule a propriedade do Search Console antes de buscar oportunidades' }, 400)
  }
  const creds = googleCreds(c.env, vinculo.gsc_conta)
  if (!creds) return c.json({ error: 'Credenciais da conta vinculada não configuradas no Worker' }, 400)
  const kp = keywordPlannerConfig(c.env)

  const started = Date.now()
  try {
    const calc = await calcularQuickWins(
      vinculo.gsc_site_url,
      {
        queryGsc: (site, q) => queryGscSearchAnalytics(creds, site, q),
        getVolumes: kp ? (kws) => getKeywordVolumes(kp, kws) : null,
      },
      { marca: marcaTermos(client.nome, client.dominio) },
    )
    await saveOportunidades(c.env.DB, clientId, calc.janela, calc.oportunidades)

    const result: SyncOportunidadesResult = {
      janela: calc.janela,
      queries_analisadas: calc.queriesAnalisadas,
      quick_wins: calc.oportunidades.length,
      com_volume: calc.oportunidades.filter((o) => o.volume_mensal !== null).length,
      keyword_planner_erro: calc.kpErro,
      duration_ms: Date.now() - started,
    }
    return c.json(result)
  } catch (e) {
    const { status, error } = erroGoogle(e, 'Falha ao buscar oportunidades')
    return c.json({ error }, status)
  }
})

google.get('/:id/oportunidades', async (c) => {
  const clientId = c.req.param('id')
  const status = c.req.query('status') as OportunidadeStatus | undefined
  if (status && !STATUS_VALIDOS.includes(status)) return c.json({ error: 'Status inválido' }, 400)
  return c.json(await listOportunidades(c.env.DB, clientId, status))
})

google.post('/:id/oportunidades/:oppId/descartar', async (c) => {
  const ok = await setOportunidadeStatus(c.env.DB, c.req.param('id'), c.req.param('oppId'), 'descartada')
  if (!ok) return c.json({ error: 'Oportunidade não encontrada' }, 404)
  return c.json({ ok: true })
})

google.post('/:id/oportunidades/:oppId/pauta', async (c) => {
  const clientId = c.req.param('id')
  const opp = await getOportunidade(c.env.DB, clientId, c.req.param('oppId'))
  if (!opp) return c.json({ error: 'Oportunidade não encontrada' }, 404)
  if (opp.status === 'em_pauta' && opp.idea_id) return c.json({ idea_id: opp.idea_id })

  const ideaId = await createIdeaFromOportunidade(c.env.DB, clientId, opp)
  await setOportunidadeStatus(c.env.DB, clientId, opp.id, 'em_pauta', ideaId)
  return c.json({ idea_id: ideaId })
})

export default google
