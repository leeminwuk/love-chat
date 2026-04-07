import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'terminal-chat',
  description: 'private chat',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-terminal-bg min-h-screen font-mono">
        {children}
      </body>
    </html>
  )
}
