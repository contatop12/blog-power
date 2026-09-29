import { Archivo } from 'next/font/google'

/**
 * Família única com eixo de largura: texto em largura normal,
 * títulos condensados (classe `font-display` em globals.css).
 */
export const fontSans = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  variable: '--font-sans',
  display: 'swap',
})
