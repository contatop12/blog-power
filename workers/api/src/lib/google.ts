import type { GoogleCredentials, KeywordPlannerConfig } from '@publisher-p12/execution'
import type { GoogleConta } from '@publisher-p12/types'
import type { ApiBindings } from '../bindings.js'

export const GOOGLE_CONTAS: GoogleConta[] = ['contato', 'ryan']

/** contato = GOOGLE_ADS_*, ryan = GOOGLE_DATA_*. null = conta não configurada no ambiente. */
export function googleCreds(env: ApiBindings, conta: GoogleConta): GoogleCredentials | null {
  const [clientId, clientSecret, refreshToken] =
    conta === 'contato'
      ? [env.GOOGLE_ADS_CLIENT_ID, env.GOOGLE_ADS_CLIENT_SECRET, env.GOOGLE_ADS_REFRESH_TOKEN]
      : [env.GOOGLE_DATA_CLIENT_ID, env.GOOGLE_DATA_CLIENT_SECRET, env.GOOGLE_DATA_REFRESH_TOKEN]
  if (!clientId || !clientSecret || !refreshToken) return null
  return { clientId, clientSecret, refreshToken }
}

export function keywordPlannerConfig(env: ApiBindings): KeywordPlannerConfig | null {
  const creds = googleCreds(env, 'contato')
  if (!creds || !env.GOOGLE_ADS_DEVELOPER_TOKEN || !env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) return null
  return { creds, developerToken: env.GOOGLE_ADS_DEVELOPER_TOKEN, loginCustomerId: env.GOOGLE_ADS_LOGIN_CUSTOMER_ID }
}

export function isGoogleConta(v: unknown): v is GoogleConta {
  return v === 'contato' || v === 'ryan'
}
