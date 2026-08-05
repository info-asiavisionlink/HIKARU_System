import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/components/providers/AuthProvider'

export const metadata: Metadata = {
  title: 'HIKARU System',
  description: '清掃作業者向けAIシステム',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
