import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Where Is My Train - Live Melbourne Transit',
  description: 'Real-time positions of all trains and trams in Melbourne',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
