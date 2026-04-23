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
  initialHasOlder: boolean
}

type ConnectionState = 'connecting' | 'connected' | 'reconnecting'

const LOG = (...args: unknown[]) => console.log('[CHAT]', ...args)
const ERR = (...args: unknown[]) => console.error('[CHAT][ERR]', ...args)
const PAGE_SIZE = 50
const RECOVERY_POLL_INTERVAL_MS = 1500

function mergeMessages(existing: Message[], incoming: Message[]) {
  const merged = new Map(existing.map((message) => [message.id, message]))

  for (const message of incoming) {
    merged.set(message.id, message)
  }

  return Array.from(merged.values())
    .sort((a, b) => {
      if (a.created_at === b.created_at) {
        return a.id.localeCompare(b.id)
      }
      return a.created_at.localeCompare(b.created_at)
    })
}

export default function ChatRoom({
  currentUser,
  partnerUser,
  initialMessages,
  initialHasOlder,
}: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [hasOlder, setHasOlder] = useState(initialHasOlder)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const prevStatusRef = useRef<string | null>(null)
  const connectionStateRef = useRef<ConnectionState>('connecting')
  const syncInFlightRef = useRef(false)
  const loadOlderInFlightRef = useRef(false)
  const oldestMessageTimeRef = useRef<string | null>(
    initialMessages.length > 0 ? initialMessages[0].created_at : null
  )
  const lastMessageTimeRef = useRef<string | null>(
    initialMessages.length > 0 ? initialMessages[initialMessages.length - 1].created_at : null
  )

  LOG('=== ChatRoom mount ===', {
    currentUser: currentUser.id,
    nickname: currentUser.nickname,
    partnerUser: partnerUser?.id,
    initialMessagesCount: initialMessages.length,
    lastMessageTime: lastMessageTimeRef.current,
  })

  // messages 상태가 바뀔 때마다 전체 ID 목록 출력
  useEffect(() => {
    LOG('messages state updated:', {
      count: messages.length,
      ids: messages.map((m) => ({ id: m.id.slice(0, 8), sender: m.sender?.nickname, content: m.content?.slice(0, 20) })),
    })
    const realMessages = messages.filter((m) => !m.id.startsWith('temp-'))
    if (realMessages.length > 0) {
      oldestMessageTimeRef.current = realMessages[0].created_at
      lastMessageTimeRef.current = realMessages[realMessages.length - 1].created_at
      LOG('oldestMessageTime updated:', oldestMessageTimeRef.current)
      LOG('lastMessageTime updated:', lastMessageTimeRef.current)
    }
  }, [messages])

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    LOG('=== Setting up Realtime channel ===')

    const updateConnectionState = (nextState: ConnectionState) => {
      connectionStateRef.current = nextState
      setConnectionState(nextState)
    }

    const syncLatestMessages = async (reason: string) => {
      if (syncInFlightRef.current) {
        LOG('sync skipped, already in flight:', reason)
        return
      }

      syncInFlightRef.current = true
      const since = lastMessageTimeRef.current
      LOG('syncLatestMessages start:', { reason, since })

      try {
        let query = supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(*), reactions(*), reads:message_reads(*)')

        if (since) {
          query = query
            .gt('created_at', since)
            .order('created_at', { ascending: true })
        } else {
          query = query
            .order('created_at', { ascending: false })
            .limit(PAGE_SIZE)
        }

        const { data, error } = await query
        LOG('syncLatestMessages result:', { reason, count: data?.length ?? 0, error })

        if (error) {
          throw error
        }

        if (!data || data.length === 0) {
          return
        }

        const normalized = since ? (data as Message[]) : [...(data as Message[])].reverse()

        setMessages((prev) => {
          const next = mergeMessages(prev, normalized)
          LOG('sync merged messages:', { reason, prevCount: prev.length, nextCount: next.length })
          return next
        })
      } catch (error) {
        ERR('syncLatestMessages failed:', reason, error)
      } finally {
        syncInFlightRef.current = false
      }
    }

    // 초기 읽음 처리
    const unread = initialMessages.filter(
      (m) => m.sender_id !== currentUser.id && !m.reads.some((r) => r.user_id === currentUser.id)
    )
    if (unread.length > 0) {
      LOG('marking initial unread messages:', unread.map((m) => m.id.slice(0, 8)))
      supabase.from('message_reads').upsert(
        unread.map((m) => ({ message_id: m.id, user_id: currentUser.id })),
        { onConflict: 'message_id,user_id' }
      )
    }

    const channel = supabase.channel('chat-room')
    LOG('channel created:', channel.topic)

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      async (payload) => {
        LOG('--- [Realtime] messages INSERT received ---')
        LOG('raw payload:', JSON.stringify(payload.new))
        LOG('payload.new.sender_id:', payload.new.sender_id)
        LOG('currentUser.id:', currentUser.id)
        LOG('is own message?', payload.new.sender_id === currentUser.id)

        if (payload.new.sender_id === currentUser.id) {
          LOG('=> own message, skipping realtime insert (handled by optimistic UI)')
          return
        }

        LOG('=> partner message, fetching sender profile for id:', payload.new.sender_id)
        const { data: sender, error: senderError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', payload.new.sender_id)
          .single()

        LOG('sender fetch result:', { sender, error: senderError })

        if (senderError || !sender) {
          ERR('sender fetch failed, using fallback. error:', senderError)
        }

        const resolvedSender = sender ?? partnerUser ?? { id: payload.new.sender_id, nickname: '???', created_at: '' }
        LOG('resolved sender:', resolvedSender)

        const newMsg: Message = {
          ...(payload.new as Omit<Message, 'sender' | 'reactions' | 'reads'>),
          sender: resolvedSender,
          reactions: [],
          reads: [],
        }
        LOG('constructed newMsg:', { id: newMsg.id.slice(0, 8), content: newMsg.content?.slice(0, 30) })

        setMessages((prev) => {
          const isDuplicate = prev.some((m) => m.id === newMsg.id)
          LOG('setMessages check - isDuplicate:', isDuplicate, '| prev.length:', prev.length)
          if (isDuplicate) {
            LOG('=> duplicate detected, skipping')
            return prev
          }
          LOG('=> adding newMsg to state, new length will be:', prev.length + 1)
          return mergeMessages(prev, [newMsg])
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

        LOG('upserting message_read for message:', payload.new.id.slice(0, 8))
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
        LOG('[Realtime] reactions INSERT:', payload.new)
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
        LOG('[Realtime] reactions DELETE:', payload.old)
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
        LOG('[Realtime] message_reads INSERT:', payload.new)
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
      LOG('=== channel status changed:', prevStatusRef.current, '->', status, '===')

      if (status === 'SUBSCRIBED') {
        const isReconnect = prevStatusRef.current !== null && prevStatusRef.current !== 'SUBSCRIBED'
        LOG('SUBSCRIBED | isReconnect:', isReconnect, '| prevStatus:', prevStatusRef.current)

        updateConnectionState('connected')
        await syncLatestMessages(isReconnect ? 'reconnect' : 'subscribed')
      }

      if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        ERR('channel disconnected with status:', status)
        updateConnectionState('reconnecting')
      }

      prevStatusRef.current = status
    })

    const syncOnForeground = () => {
      void syncLatestMessages('foreground')
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncOnForeground()
      }
    }

    const handleOffline = () => {
      updateConnectionState('reconnecting')
    }

    const intervalId = window.setInterval(() => {
      if (connectionStateRef.current !== 'connected') {
        void syncLatestMessages('poll-reconnecting')
      }
    }, RECOVERY_POLL_INTERVAL_MS)

    window.addEventListener('focus', syncOnForeground)
    window.addEventListener('online', syncOnForeground)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      LOG('=== ChatRoom unmount, removing channel ===')
      window.clearInterval(intervalId)
      window.removeEventListener('focus', syncOnForeground)
      window.removeEventListener('online', syncOnForeground)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLoadOlder() {
    if (loadingOlder || loadOlderInFlightRef.current || !hasOlder) return

    const before = oldestMessageTimeRef.current
    LOG('handleLoadOlder triggered:', { before })

    setLoadingOlder(true)
    loadOlderInFlightRef.current = true

    try {
      let query = supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(*), reactions(*), reads:message_reads(*)')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1)

      if (before) {
        query = query.lt('created_at', before)
      }

      const { data, error } = await query
      LOG('handleLoadOlder result:', { count: data?.length ?? 0, error })

      if (error) {
        throw error
      }

      const rows = (data as Message[]) ?? []
      const nextHasOlder = rows.length > PAGE_SIZE
      const page = rows.slice(0, PAGE_SIZE).reverse()

      setHasOlder(nextHasOlder)
      if (page.length === 0) {
        return
      }

      setMessages((prev) => mergeMessages(page, prev))
    } catch (error) {
      ERR('handleLoadOlder failed:', error)
    } finally {
      loadOlderInFlightRef.current = false
      setLoadingOlder(false)
    }
  }

  async function sendMessage(content: string, imageUrl?: string) {
    const tempId = `temp-${Date.now()}`
    LOG('=== sendMessage start ===', { tempId, content: content?.slice(0, 30), imageUrl })

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
      LOG('optimistic add - prev.length:', prev.length, '-> new length:', prev.length + 1)
      return [...prev, tempMsg]
    })

    LOG('inserting to DB...')
    const { data, error } = await supabase
      .from('messages')
      .insert({
        sender_id: currentUser.id,
        content: content || null,
        image_url: imageUrl ?? null,
      })
      .select()
      .single()

    LOG('DB insert result:', { data: data ? { id: data.id?.slice(0, 8), created_at: data.created_at } : null, error })

    if (error) {
      ERR('insert failed, removing optimistic message:', error)
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
      throw error
    }

    LOG('replacing tempId', tempId.slice(0, 12), 'with real id', data.id.slice(0, 8))
    setMessages((prev) => {
      const found = prev.some((m) => m.id === tempId)
      LOG('replace - tempId found?', found, '| prev.length:', prev.length)
      return prev.map((m) =>
        m.id === tempId ? { ...tempMsg, id: data.id, created_at: data.created_at } : m
      )
    })
    LOG('=== sendMessage done ===')
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
      <TitleBar status={connectionState} />
      <ChatHeader
        myNickname={currentUser.nickname}
        partnerNickname={partnerUser?.nickname ?? '...'}
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        <MessageList
          messages={messages}
          currentUserId={currentUser.id}
          onReaction={toggleReaction}
          hasOlder={hasOlder}
          loadingOlder={loadingOlder}
          onLoadOlder={handleLoadOlder}
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
