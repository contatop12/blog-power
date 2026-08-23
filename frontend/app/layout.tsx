import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/nav'
import { AuthGuard } from '@/components/auth-guard'
import { fontBody, fontDisplay } from '@/lib/fonts'

export const metadata: Metadata = {
  title: 'Publisher P12',
  description: 'Produção e publicação de conteúdo SEO/GEO em WordPress',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fontDisplay.variable} ${fontBody.variable}`}>
      <body>
        <AuthGuard>
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </AuthGuard>
      </body>
    </html>
  )
}
