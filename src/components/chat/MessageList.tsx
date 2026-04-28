'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Message } from '@/types'
import MessageItem from './MessageItem'

type MessageListProps = {
  messages: Message[]
  currentUserId: string
  onReaction: (messageId: string, emoji: string) => void
  hasOlder: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
}

export default function MessageList({
  messages,
  currentUserId,
  onReaction,
  hasOlder,
  loadingOlder,
  onLoadOlder,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldStickToBottomRef = useRef(true)
  const metricsRef = useRef({
    firstId: null as string | null,
    lastId: null as string | null,
    scrollHeight: 0,
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scrollContainer = container

    function handleScroll() {
      const distanceFromBottom =
        scrollContainer.scrollHeight - (scrollContainer.scrollTop + scrollContainer.clientHeight)
      shouldStickToBottomRef.current = distanceFromBottom < 120

      if (scrollContainer.scrollTop < 120 && hasOlder && !loadingOlder) {
        onLoadOlder()
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [hasOlder, loadingOlder, onLoadOlder])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const previous = metricsRef.current
    const firstId = messages[0]?.id ?? null
    const lastId = messages[messages.length - 1]?.id ?? null
    const currentScrollHeight = container.scrollHeight
    const prependedOlder = previous.firstId !== null && firstId !== previous.firstId && lastId === previous.lastId
    const appendedNewer = previous.lastId !== null && lastId !== previous.lastId

    const scrollToBottom = () => {
      container.scrollTop = container.scrollHeight
    }

    let scrollFrame: number | null = null

    if (prependedOlder) {
      container.scrollTop += currentScrollHeight - previous.scrollHeight
    } else if (previous.lastId === null || (appendedNewer && shouldStickToBottomRef.current)) {
      scrollToBottom()
      scrollFrame = window.requestAnimationFrame(scrollToBottom)
    }

    metricsRef.current = {
      firstId,
      lastId,
      scrollHeight: container.scrollHeight,
    }

    return () => {
      if (scrollFrame !== null) {
        window.cancelAnimationFrame(scrollFrame)
      }
    }
  }, [messages])

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-2">
      <div className="text-terminal-dim text-[11px] text-center mb-2">
        ── session started ──
      </div>
      {loadingOlder && (
        <div className="text-terminal-dim text-[11px] text-center">
          이전 메시지 불러오는 중...
        </div>
      )}
      {!hasOlder && messages.length > 0 && (
        <div className="text-terminal-dim text-[11px] text-center">
          ── 이전 메시지의 시작 ──
        </div>
      )}
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          isMe={msg.sender_id === currentUserId}
          currentUserId={currentUserId}
          onReaction={onReaction}
        />
      ))}
    </div>
  )
}
