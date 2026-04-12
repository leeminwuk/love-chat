'use client'

import { useEffect, useRef, useState } from 'react'
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
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const prevStatusRef = useRef<string | null>(null)
  const lastMessageTimeRef = useRef<string | null>(
    initialMessages.length > 0 ? initialMessages[initialMessages.length - 1].created_at : null
  )

  // 실제 메시지(optimistic 제외) 기준으로 마지막 수신 시각 추적
  useEffect(() => {
    const realMessages = messages.filter((m) => !m.id.startsWith('temp-'))
    if (realMessages.length > 0) {
      lastMessageTimeRef.current = realMessages[realMessages.length - 1].created_at
    }
  }, [messages])

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    // 초기 읽음 처리
    const unread = initialMessages.filter(
      (m) => m.sender_id !== currentUser.id && !m.reads.some((r) => r.user_id === currentUser.id)
    )
    if (unread.length > 0) {
      supabase.from('message_reads').upsert(
        unread.map((m) => ({ message_id: m.id, user_id: currentUser.id })),
        { onConflict: 'message_id,user_id' }
      )
    }

    const channel = supabase.channel('chat-room')

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      async (payload) => {
        if (payload.new.sender_id === currentUser.id) return

        const { data: sender, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', payload.new.sender_id)
          .single()

        if (error || !sender) {
          console.error('[Realtime] sender fetch failed, using fallback:', error)
        }

        const newMsg: Message = {
          ...(payload.new as Omit<Message, 'sender' | 'reactions' | 'reads'>),
          sender: sender ?? partnerUser ?? { id: payload.new.sender_id, nickname: '???', created_at: '' },
          reactions: [],
          reads: [],
        }
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })

        if (Notification.permission === 'granted' && document.hidden) {
          const notif = new Notification(sender?.nickname ?? '새 메시지', {
            body: payload.new.content ?? '이미지를 보냈습니다.',
            icon: '/favicon.ico',
          })
          notif.onclick = () => {
            window.focus()
            notif.close()
          }
        }

        supabase.from('message_reads').upsert(
          [{ message_id: payload.new.id, user_id: currentUser.id }],
          { onConflict: 'message_id,user_id' }
        )
      }
    )

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'reactions' },
      (payload) => {
        const r = payload.new as Reaction
        setMessages((prev) =>
          prev.map((m) =>
            m.id === r.message_id ? { ...m, reactions: [...m.reactions, r] } : m
          )
        )
      }
    )

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

    channel.subscribe(async (status) => {
      console.log('[Realtime] status:', status)

      if (status === 'SUBSCRIBED') {
        // 재연결 시: 끊겨 있던 동안 누락된 메시지를 DB에서 보충
        if (prevStatusRef.current !== null && prevStatusRef.current !== 'SUBSCRIBED') {
          const since = lastMessageTimeRef.current
          let query = supabase
            .from('messages')
            .select('*, sender:profiles!sender_id(*), reactions(*), reads:message_reads(*)')
            .order('created_at', { ascending: true })
          if (since) {
            query = query.gt('created_at', since)
          }
          const { data: missed } = await query
          if (missed && missed.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id))
              const newMsgs = (missed as Message[]).filter((m) => !existingIds.has(m.id))
              return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
            })
          }
        }
        setConnected(true)
      }

      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setConnected(false)
      }

      prevStatusRef.current = status
    })

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sendMessage(content: string, imageUrl?: string) {
    const tempId = `temp-${Date.now()}`
    console.log('[sendMessage] 1. adding optimistic', tempId)
    const tempMsg: Message = {
      id: tempId,
      sender_id: currentUser.id,
      content: content || null,
      image_url: imageUrl ?? null,
      created_at: new Date().toISOString(),
      sender: currentUser,
      reactions: [],
      reads: [],
    }
    setMessages((prev) => {
      console.log('[sendMessage] 2. prev count:', prev.length)
      return [...prev, tempMsg]
    })

    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        content: content || null,
        image_url: imageUrl ?? null,
      })
      .select()
      .single()

    if (error) {
      console.error('[sendMessage] insert error:', error)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      return
    }

    console.log('[sendMessage] 3. replacing with real id', data.id)
    setMessages((prev) => {
      console.log('[sendMessage] 4. replacing, prev count:', prev.length)
      return prev.map((m) =>
        m.id === tempId ? { ...tempMsg, id: data.id, created_at: data.created_at } : m
      )
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
      await supabase.from('reactions').insert({ message_id: messageId, user_id: currentUser.id, emoji })
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
