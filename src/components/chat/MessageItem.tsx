'use client'

import { useState } from 'react'
import type { Message } from '@/types'
import ImageMessage from './ImageMessage'
import ReactionBar from './ReactionBar'

const EMOJIS = ['❤️', '😂', '😮', '😢', '👍']

type MessageItemProps = {
  message: Message
  isMe: boolean
  currentUserId: string
  onReaction: (messageId: string, emoji: string) => void
}

export default function MessageItem({ message, isMe, currentUserId, onReaction }: MessageItemProps) {
  const [showPicker, setShowPicker] = useState(false)

  const time = new Date(message.created_at).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const isRead = message.reads.some((r) => r.user_id !== currentUserId)
  const readStatus = isMe
    ? isRead
      ? '✓✓ 읽음'
      : '✓ 전송됨'
    : null

  return (
    <div
      className="group relative"
      onMouseEnter={() => setShowPicker(true)}
      onMouseLeave={() => setShowPicker(false)}
    >
      <div className={`text-[12px] leading-relaxed ${isMe ? 'text-terminal-green' : 'text-terminal-muted'}`}>
        <span className="text-terminal-dim">[{time}]</span>{' '}
        <span className={isMe ? 'text-terminal-green' : 'text-terminal-muted'}>
          {message.sender.nickname}:~$
        </span>{' '}
        {message.content && (
          <span className="text-terminal-text">{message.content}</span>
        )}
        {message.image_url && (
          <span className="text-terminal-dim">[image attached]</span>
        )}
      </div>

      {message.image_url && (
        <div className="ml-20 mt-1">
          <ImageMessage url={message.image_url} />
        </div>
      )}

      <div className="ml-20 mt-0.5 flex items-center gap-2 flex-wrap">
        {readStatus && (
          <span className="text-terminal-dim text-[10px]">{readStatus}</span>
        )}
        <ReactionBar
          reactions={message.reactions}
          currentUserId={currentUserId}
          onReaction={(emoji) => onReaction(message.id, emoji)}
        />
      </div>

      {showPicker && (
        <div className="absolute left-20 -top-7 flex gap-1 bg-[#2a2a2a] border border-terminal-border rounded px-2 py-1 z-10">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onReaction(message.id, emoji)}
              className="text-sm hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
