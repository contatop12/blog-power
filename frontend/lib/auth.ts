const AUTH_KEY = 'publisher_auth'

export function getStoredAuth(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(AUTH_KEY)
}

export function setStoredAuth(token: string): void {
  sessionStorage.setItem(AUTH_KEY, token)
}

export function clearStoredAuth(): void {
  sessionStorage.removeItem(AUTH_KEY)
}

export function isAuthenticated(): boolean {
  return Boolean(getStoredAuth())
}

export function getAuthHeader(): string {
  const stored = getStoredAuth()
  if (stored) return `Basic ${stored}`
  return ''
}
