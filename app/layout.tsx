import type { Metadata } from 'next'
import { IBM_Plex_Sans, Source_Serif_4, Teko } from 'next/font/google'
import { SiteHeader } from '@/components/SiteHeader'
import './globals.css'

const display = Teko({
  variable: '--font-display-loaded',
  subsets: ['latin'],
  weight: '700',
})

const sans = IBM_Plex_Sans({
  variable: '--font-sans-loaded',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
})

const editorial = Source_Serif_4({
  variable: '--font-editorial-loaded',
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
})

export const metadata: Metadata = {
  title: {
    default: 'WikiRace | Conecta artículos de Wikipedia',
    template: '%s | WikiRace',
  },
  description: 'Llega de un artículo de Wikipedia a otro usando solo enlaces internos.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable} ${editorial.variable}`}>
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  )
}
