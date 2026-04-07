'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message, Profile, Reaction, MessageRead } from '@/types'
import TitleBar from '@/components/terminal/TitleBar'
import ChatHeader from '@/components/terminal/ChatHeader'
import MessageList from '@/components/chat/MessageList'
import ChatInput from '@/components/chat/ChatInput'

type ChatRoomProps = {
  currentUser: Profile
  partnerUser: Profile | null
  initialMessages: Message[]
}

export default function ChatRoom({ currentUser, partnerUser, initialMessages }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [connected, setConnected] = useState(false)
  const supabase = createClient()

  const markAsRead = useCallback(async (msgs: Message[]) => {
    const unread = msgs.filter(
      (m) =>
        m.sender_id !== currentUser.id &&
        !m.reads.some((r) => r.user_id === currentUser.id)
    )
    if (unread.length === 0) return

    await supabase.from('message_reads').upsert(
      unread.map((m) => ({ message_id: m.id, user_id: currentUser.id })),
      { onConflict: 'message_id,user_id' }
    )
  }, [currentUser.id, supabase])

  useEffect(() => {
    const channel = supabase.channel('chat-room')

    // 새 메시지
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      async (payload) => {
        const { data: sender } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', payload.new.sender_id)
          .single()

        const newMsg: Message = {
          ...(payload.new as Omit<Message, 'sender' | 'reactions' | 'reads'>),
          sender: sender!,
          reactions: [],
          reads: [],
        }
        setMessages((prev) => [...prev, newMsg])

        if (payload.new.sender_id !== currentUser.id) {
          await supabase.from('message_reads').upsert(
            [{ message_id: payload.new.id, user_id: currentUser.id }],
            { onConflict: 'message_id,user_id' }
          )
        }
      }
    )

    // 리액션 추가
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'reactions' },
      (payload) => {
        const newReaction = payload.new as Reaction
        setMessages((prev) =>
          prev.map((m) =>
            m.id === newReaction.message_id
              ? { ...m, reactions: [...m.reactions, newReaction] }
              : m
          )
        )
      }
    )

    // 리액션 삭제
    channel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'reactions' },
      (payload) => {
        const deletedId = payload.old.id
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            reactions: m.reactions.filter((r) => r.id !== deletedId),
          }))
        )
      }
    )

    // 읽음 확인
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'message_reads' },
      (payload) => {
        const newRead = payload.new as MessageRead
        setMessages((prev) =>
          prev.map((m) =>
            m.id === newRead.message_id
              ? { ...m, reads: [...m.reads.filter((r) => r.user_id !== newRead.user_id), newRead] }
              : m
          )
        )
      }
    )

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true)
        markAsRead(initialMessages)
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser.id, supabase, markAsRead, initialMessages])

  async function sendMessage(content: string, imageUrl?: string) {
    await supabase.from('messages').insert({
      sender_id: currentUser.id,
      content: content || null,
      image_url: imageUrl ?? null,
    })
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const msg = messages.find((m) => m.id === messageId)
    if (!msg) return

    const existing = msg.reactions.find(
      (r) => r.user_id === currentUser.id && r.emoji === emoji
    )

    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      await supabase
        .from('reactions')
        .insert({ message_id: messageId, user_id: currentUser.id, emoji })
    }
  }

  return (
    <div className="h-screen flex flex-col bg-terminal-bg font-mono">
      <TitleBar connected={connected} />
      <ChatHeader
        myNickname={currentUser.nickname}
        partnerNickname={partnerUser?.nickname ?? '...'}
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        <MessageList
          messages={messages}
          currentUserId={currentUser.id}
          onReaction={toggleReaction}
        />
      </div>

      <ChatInput
        nickname={currentUser.nickname}
        senderId={currentUser.id}
        onSend={sendMessage}
        onTyping={() => {}}
      />
    </div>
  )
}
