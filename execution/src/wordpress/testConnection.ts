import type { ConnectionCheckResult, ConnectionStatus } from '@publisher-p12/types'
import { normalizeWpApiUrl, wpFetch, type WordPressCredentials } from './client.js'

interface WpUserMe {
  id: number
  name: string
  capabilities?: Record<string, boolean>
}

interface WpTypeSchema {
  schema?: {
    properties?: {
      meta?: {
        properties?: Record<string, unknown>
      }
    }
  }
}

const CRITICAL_CHECKS = new Set(['HTTPS', 'Autenticação', 'Capability edit_posts'])
const WARNING_CHECKS = new Set(['Plugin SEO detectado', 'mu-plugin P12 Bridge'])

export function deriveConnectionStatus(result: Pick<ConnectionCheckResult, 'ok' | 'itens'>): ConnectionStatus {
  const failed = result.itens.filter((item) => !item.ok)
  const criticalFailed = failed.some((item) => CRITICAL_CHECKS.has(item.nome))
  if (criticalFailed) return 'erro'

  const warningFailed = failed.some((item) => WARNING_CHECKS.has(item.nome))
  if (warningFailed || !result.ok) return 'atencao'

  return 'ok'
}

async function userCanEditPosts(creds: WordPressCredentials): Promise<boolean> {
  try {
    const me = await wpFetch<WpUserMe>(creds, '/wp/v2/users/me?context=edit')
    if (me.capabilities?.edit_posts === true) return true
  } catch {
    // segue para probe
  }

  try {
    const post = await wpFetch<{ id: number }>(creds, '/wp/v2/posts', {
      method: 'POST',
      body: {
        title: 'P12 — teste de conexão (pode excluir)',
        status: 'draft',
        content: '<!-- p12 connection probe -->',
      },
    })
    try {
      await wpFetch(creds, `/wp/v2/posts/${post.id}?force=true`, { method: 'DELETE' })
    } catch {
      // criou rascunho — capability confirmada mesmo se a exclusão falhar
    }
    return true
  } catch {
    return false
  }
}

async function muPluginInstalled(creds: WordPressCredentials): Promise<boolean> {
  for (const type of ['post', 'page'] as const) {
    try {
      const wpType = await wpFetch<WpTypeSchema>(creds, `/wp/v2/types/${type}?context=edit`)
      const meta = wpType.schema?.properties?.meta?.properties
      if (meta?.p12_schema_jsonld) return true
    } catch {
      // tenta próximo tipo
    }
  }
  return false
}

export async function testWordPressConnection(
  creds: WordPressCredentials,
): Promise<ConnectionCheckResult> {
  const itens: ConnectionCheckResult['itens'] = []

  const httpsOk = creds.wpApiUrl.startsWith('https://')
  itens.push({
    nome: 'HTTPS',
    ok: httpsOk,
    instrucao: httpsOk ? undefined : 'O site do cliente deve ter HTTPS ativo.',
  })

  let authOk = false
  let hasEditPosts = false
  let seoPluginDetected = false
  let muPluginOk = false

  try {
    await wpFetch<WpUserMe>(creds, '/wp/v2/users/me')
    authOk = true
  } catch {
    authOk = false
  }

  if (authOk) {
    hasEditPosts = await userCanEditPosts(creds)
  }

  itens.push({
    nome: 'Autenticação',
    ok: authOk,
    instrucao: authOk
      ? undefined
      : 'Verifique Application Passwords e credenciais (usuário precisa de edit_posts).',
  })

  itens.push({
    nome: 'Capability edit_posts',
    ok: hasEditPosts,
    instrucao: hasEditPosts ? undefined : 'Use um usuário Author ou Editor no WordPress.',
  })

  try {
    const pluginsRes = await fetch(`${normalizeWpApiUrl(creds.wpApiUrl)}/`, {
      headers: { Authorization: `Basic ${btoa(`${creds.wpUser}:${creds.wpAppPassword}`)}` },
    })
    const html = await pluginsRes.text()
    seoPluginDetected = /yoast|rank.?math/i.test(html)
  } catch {
    seoPluginDetected = false
  }

  itens.push({
    nome: 'Plugin SEO detectado',
    ok: seoPluginDetected,
    instrucao: seoPluginDetected
      ? undefined
      : 'Instale Yoast ou Rank Math, ou configure seo_plugin como nenhum.',
  })

  if (authOk && hasEditPosts) {
    muPluginOk = await muPluginInstalled(creds)
  }

  itens.push({
    nome: 'mu-plugin P12 Bridge',
    ok: muPluginOk,
    instrucao: muPluginOk
      ? undefined
      : 'Instale o P12 Bridge: use “Instalar no WordPress” (ZIP → Plugins → Enviar → Ativar) ou envie o PHP para mu-plugins/.',
  })

  itens.push({
    nome: 'Fuso horário',
    ok: true,
    instrucao: 'Confirme timezone America/Sao_Paulo nas configurações do WP.',
  })

  itens.push({
    nome: 'WP-Cron',
    ok: true,
    instrucao: 'Sites de baixo tráfego: recomende cron real (DISABLE_WP_CRON + crontab).',
  })

  const criticalOk = httpsOk && authOk && hasEditPosts
  const result = {
    ok: criticalOk && muPluginOk && seoPluginDetected,
    itens,
    status_conexao: 'nao_testado' as ConnectionStatus,
  }
  result.status_conexao = deriveConnectionStatus(result)
  return result
}
