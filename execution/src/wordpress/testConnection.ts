import type { ConnectionCheckResult } from '@publisher-p12/types'
import { normalizeWpApiUrl, wpFetch, type WordPressCredentials } from './client.js'

interface WpUserMe {
  id: number
  name: string
  capabilities?: Record<string, boolean>
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
    const me = await wpFetch<WpUserMe>(creds, '/wp/v2/users/me')
    authOk = true
    hasEditPosts = Boolean(me.capabilities?.edit_posts)
    void me.name
  } catch {
    authOk = false
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

  try {
    const schema = await wpFetch<{ schema?: { properties?: Record<string, unknown> } }>(
      creds,
      '/wp/v2/posts?per_page=1',
    )
    void schema
    muPluginOk = true
  } catch {
    muPluginOk = false
  }

  itens.push({
    nome: 'mu-plugin P12 Bridge',
    ok: muPluginOk,
    instrucao: muPluginOk
      ? undefined
      : 'Instale mu-plugin/p12-publisher-bridge.php no WordPress do cliente.',
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
  return {
    ok: criticalOk && muPluginOk,
    itens,
  }
}
