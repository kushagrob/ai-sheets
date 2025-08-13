import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Sheets - AI-Powered Spreadsheet Application',
  description: 'AI Sheets provides a Google Sheets-like interface enhanced with AI assistance for data analysis, formula creation, and spreadsheet manipulation.',
  keywords: 'spreadsheet, AI, data analysis, Excel, Claude AI, Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className={GeistSans.className}>{children}</body>
    </html>
  )
}
