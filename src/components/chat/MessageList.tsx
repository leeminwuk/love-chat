'use client'

import { useEffect, useRef } from 'react'
import type { Message } from '@/types'
import MessageItem from './MessageItem'

type MessageListProps = {
  messages: Message[]
  currentUserId: string
  onReaction: (messageId: string, emoji: string) => void
}

export default function MessageList({ messages, currentUserId, onReaction }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
      <div className="text-terminal-dim text-[11px] text-center mb-2">
        ── session started ──
      </div>
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          isMe={msg.sender_id === currentUserId}
          currentUserId={currentUserId}
          onReaction={onReaction}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
