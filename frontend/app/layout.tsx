import type { Metadata } from 'next'
import './globals.css'
import { AppShell } from '@/components/app-shell'
import { AuthGuard } from '@/components/auth-guard'
import { fontSans } from '@/lib/fonts'

export const metadata: Metadata = {
  title: 'Publisher P12',
  description: 'Produção e publicação de conteúdo SEO/GEO em WordPress',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={fontSans.variable}>
      <body>
        <AuthGuard>
          <AppShell>{children}</AppShell>
        </AuthGuard>
      </body>
    </html>
  )
}
