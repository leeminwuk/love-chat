'use client'

import { useEffect, useState, type ReactNode } from 'react'

export default function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="h-screen bg-terminal-bg font-mono flex items-center justify-center">
        <div className="text-terminal-green text-sm">connecting...</div>
      </div>
    )
  }

  return <>{children}</>
}
