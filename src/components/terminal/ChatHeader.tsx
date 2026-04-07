// src/components/terminal/ChatHeader.tsx
'use client'

import { useEffect, useState } from 'react'

type ChatHeaderProps = {
  myNickname: string
  partnerNickname: string
}

export default function ChatHeader({ myNickname, partnerNickname }: ChatHeaderProps) {
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      })
    )
  }, [])

  return (
    <div className="flex justify-between items-center px-4 py-2 bg-terminal-bg-dark border-b border-terminal-border flex-shrink-0">
      <div className="text-[11px]">
        <span className="text-terminal-dim">session:</span>{' '}
        <span className="text-terminal-green">{myNickname}</span>
        <span className="text-terminal-dim"> ↔ </span>
        <span className="text-terminal-muted">{partnerNickname}</span>
      </div>
      <div className="text-[11px] text-terminal-dim">{dateStr}</div>
    </div>
  )
}
