import { Schibsted_Grotesk } from 'next/font/google'

/** Grotesk desenhada para um grupo de mídia — família única para UI, títulos e números */
export const fontSans = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})
