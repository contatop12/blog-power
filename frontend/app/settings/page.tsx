import { redirect } from 'next/navigation'

/** Credenciais não são editáveis no frontend — apenas via secrets do Worker / .env */
export default function SettingsPage() {
  redirect('/')
}
