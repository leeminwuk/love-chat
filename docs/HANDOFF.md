# 인계 가이드 — Terminal Chat App

## 현재 상태

**작업 디렉토리:** `/Users/leeminuk/Chat`
**마지막 커밋:** `eb7873e` — feat: add chat page server component with initial data loading

### 완료된 태스크 (Tasks 1-8) ✅

| Task | 내용 | 커밋 |
|------|------|------|
| 1 | Next.js 16 + Tailwind v4 + Supabase 패키지 설치 | 489c1af |
| 2 | `src/types/index.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` | 07829e2 |
| 3 | `middleware.ts` (인증 가드) | 9b2cfcc |
| 4 | `supabase/schema.sql` (profiles/messages/reactions/message_reads + RLS + Realtime) | 5fc8375 |
| 5 | `src/components/terminal/TitleBar.tsx`, `ChatHeader.tsx` | dfcab76 |
| 6 | `src/app/(auth)/login/page.tsx` | c350b1c |
| 7 | `src/app/(auth)/setup/page.tsx` | c350b1c |
| 8 | `src/app/chat/page.tsx` (서버 컴포넌트) + `src/components/chat/ChatRoom.tsx` (placeholder) | eb7873e |

### 남은 태스크 (Tasks 9-14) ← 여기서부터 시작

---

## 중요 기술 사항

### Tailwind v4
- `tailwind.config.ts` 없음 (삭제됨 — v4에서 무시됨)
- 커스텀 색상은 **`src/app/globals.css`의 `@theme {}` 블록**에서 관리
- 사용 가능한 클래스: `terminal-bg`, `terminal-bg-dark`, `terminal-bg-card`, `terminal-border`, `terminal-green`, `terminal-text`, `terminal-muted`, `terminal-dim`
- `font-mono` 클래스 사용 가능

### Node.js 경로
```bash
PATH="/opt/homebrew/bin:$PATH" npm run build
PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit
```

### 커밋 규칙
- Conventional Commits 형식 (feat/fix/refactor/chore)
- **Co-Authored-By 등 Claude 관련 문구 절대 포함 금지**

---

## 남은 구현 계획

전체 플랜: `docs/superpowers/plans/2026-04-07-terminal-chat.md`

---

### Task 9: ChatRoom 클라이언트 컴포넌트 (Realtime 구독) ← 다음 작업

**File:** `src/components/chat/ChatRoom.tsx` (현재 placeholder — 완전히 교체)

현재 파일(`src/components/chat/ChatRoom.tsx`)은 placeholder임. 아래 내용으로 완전히 교체:

```typescript
// src/components/chat/ChatRoom.tsx
'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Message, Profile, Reaction, MessageRead } from '@/types'
import TitleBar from '@/components/terminal/TitleBar'
import ChatHeader from '@/components/terminal/ChatHeader'
import MessageList from '@/components/chat/MessageList'
import TypingIndicator from '@/components/chat/TypingIndicator'
import ChatInput from '@/components/chat/ChatInput'

type ChatRoomProps = {
  currentUser: Profile
  partnerUser: Profile | null
  initialMessages: Message[]
}

export default function ChatRoom({ currentUser, partnerUser, initialMessages }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [connected, setConnected] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const supabase = createClient()
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

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
    const channel = supabase.channel('chat-room', {
      config: { presence: { key: currentUser.id } },
    })

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

    // 타이핑 인디케이터 (Presence)
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ typing: boolean }>()
      const isPartnerTyping = Object.entries(state).some(
        ([key, presences]) =>
          key !== currentUser.id &&
          presences.some((p) => p.typing === true)
      )
      setPartnerTyping(isPartnerTyping)
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setConnected(true)
        channel.track({ typing: false })
        markAsRead(initialMessages)
      }
    })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUser.id, supabase, markAsRead, initialMessages])

  async function handleTyping(isTyping: boolean) {
    channelRef.current?.track({ typing: isTyping })
  }

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
        {partnerTyping && partnerUser && (
          <TypingIndicator nickname={partnerUser.nickname} />
        )}
      </div>

      <ChatInput
        nickname={currentUser.nickname}
        senderId={currentUser.id}
        onSend={sendMessage}
        onTyping={handleTyping}
      />
    </div>
  )
}
```

**커밋:**
```bash
git add src/components/chat/ChatRoom.tsx
git commit -m "feat: add ChatRoom with Supabase Realtime subscriptions"
```

> **주의:** MessageList, TypingIndicator, ChatInput은 Task 10-12에서 생성됨. Task 9 단독 빌드는 오류 발생 가능 — Tasks 9-12를 연속으로 구현한 뒤 한 번에 빌드 확인해도 됨.

---

### Task 10: MessageList + MessageItem + ImageMessage

**Files:**
- Create: `src/components/chat/MessageList.tsx`
- Create: `src/components/chat/MessageItem.tsx`
- Create: `src/components/chat/ImageMessage.tsx`

```typescript
// src/components/chat/MessageList.tsx
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
```

```typescript
// src/components/chat/MessageItem.tsx
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
```

```typescript
// src/components/chat/ImageMessage.tsx
'use client'

import { useState } from 'react'

type ImageMessageProps = {
  url: string
}

export default function ImageMessage({ url }: ImageMessageProps) {
  const [lightbox, setLightbox] = useState(false)
  const filename = url.split('/').pop() ?? 'image'

  return (
    <>
      <div
        className="inline-block border border-terminal-border rounded p-2 cursor-pointer hover:border-terminal-green transition-colors"
        onClick={() => setLightbox(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={filename}
          className="max-w-[200px] max-h-[150px] object-cover rounded"
        />
        <div className="text-terminal-dim text-[10px] mt-1 truncate max-w-[200px]">
          {filename}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setLightbox(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={filename}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded"
          />
        </div>
      )}
    </>
  )
}
```

**커밋:**
```bash
git add src/components/chat/MessageList.tsx src/components/chat/MessageItem.tsx src/components/chat/ImageMessage.tsx
git commit -m "feat: add MessageList, MessageItem, ImageMessage components"
```

---

### Task 11: ReactionBar

**File:** `src/components/chat/ReactionBar.tsx`

```typescript
// src/components/chat/ReactionBar.tsx
import type { Reaction } from '@/types'

type ReactionBarProps = {
  reactions: Reaction[]
  currentUserId: string
  onReaction: (emoji: string) => void
}

export default function ReactionBar({ reactions, currentUserId, onReaction }: ReactionBarProps) {
  if (reactions.length === 0) return null

  const grouped = reactions.reduce<Record<string, { count: number; isMine: boolean }>>(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { count: 0, isMine: false }
      acc[r.emoji].count += 1
      if (r.user_id === currentUserId) acc[r.emoji].isMine = true
      return acc
    },
    {}
  )

  return (
    <div className="flex gap-1 flex-wrap">
      {Object.entries(grouped).map(([emoji, { count, isMine }]) => (
        <button
          key={emoji}
          onClick={() => onReaction(emoji)}
          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
            isMine
              ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
              : 'border-terminal-border text-terminal-muted hover:border-terminal-green'
          }`}
        >
          {emoji} {count}
        </button>
      ))}
    </div>
  )
}
```

**커밋:**
```bash
git add src/components/chat/ReactionBar.tsx
git commit -m "feat: add ReactionBar component"
```

---

### Task 12: TypingIndicator + ChatInput

**Files:**
- Create: `src/components/chat/TypingIndicator.tsx`
- Create: `src/components/chat/ChatInput.tsx`

```typescript
// src/components/chat/TypingIndicator.tsx
export default function TypingIndicator({ nickname }: { nickname: string }) {
  return (
    <div className="px-4 pb-1 text-[11px] text-terminal-muted">
      <span>{nickname}:~$</span>{' '}
      <span className="inline-flex gap-0.5">
        <span className="cursor-blink" style={{ animationDelay: '0ms' }}>▌</span>
        <span className="cursor-blink" style={{ animationDelay: '150ms' }}>▌</span>
        <span className="cursor-blink" style={{ animationDelay: '300ms' }}>▌</span>
      </span>{' '}
      <span className="text-terminal-dim">typing...</span>
    </div>
  )
}
```

```typescript
// src/components/chat/ChatInput.tsx
'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ChatInputProps = {
  nickname: string
  senderId: string
  onSend: (content: string, imageUrl?: string) => Promise<void>
  onTyping: (isTyping: boolean) => void
}

export default function ChatInput({ nickname, senderId, onSend, onTyping }: ChatInputProps) {
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value)
    onTyping(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 1500)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || uploading) return

    const content = text.trim()
    setText('')
    onTyping(false)
    await onSend(content)
  }

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      await handleSubmit(e as unknown as React.FormEvent)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const path = `${senderId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage
      .from('messages')
      .upload(path, file)

    if (error) {
      console.error('Upload failed:', error.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('messages').getPublicUrl(path)
    await onSend('', data.publicUrl)
    setUploading(false)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="border-t border-terminal-border bg-terminal-bg-dark px-4 py-3 flex-shrink-0">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <span className="text-terminal-green text-[12px] flex-shrink-0">
          {nickname}:~$
        </span>
        <input
          type="text"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={uploading}
          placeholder={uploading ? 'uploading...' : '메시지 입력...'}
          className="flex-1 bg-transparent text-terminal-text text-[12px] outline-none border-b border-terminal-border focus:border-terminal-green py-0.5 placeholder:text-terminal-dim disabled:opacity-50"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-terminal-muted hover:text-terminal-text text-[12px] flex-shrink-0 disabled:opacity-50"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="submit"
          disabled={!text.trim() || uploading}
          className="border border-terminal-green text-terminal-green text-[11px] px-3 py-0.5 rounded hover:bg-terminal-green hover:text-terminal-bg transition-colors disabled:opacity-30 flex-shrink-0"
        >
          [enter]
        </button>
      </form>

      <div className="text-terminal-dim text-[10px] mt-1">
        press enter to send · attach image with 📎
      </div>
    </div>
  )
}
```

**Tasks 9-12 완료 후 빌드 확인:**
```bash
PATH="/opt/homebrew/bin:$PATH" npx tsc --noEmit
PATH="/opt/homebrew/bin:$PATH" npm run build
```

**커밋:**
```bash
git add src/components/chat/TypingIndicator.tsx src/components/chat/ChatInput.tsx
git commit -m "feat: add TypingIndicator and ChatInput with image upload"
```

---

### Task 13: 루트 페이지 리다이렉트

**File:** `src/app/page.tsx` (기존 파일 교체)

```typescript
// src/app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
}
```

**커밋:**
```bash
git add src/app/page.tsx
git commit -m "feat: redirect root to /login"
```

---

### Task 14: Vercel 배포

1. `.gitignore` 확인 (`.env.local` 포함 여부 — 이미 포함됨)
2. GitHub 레포 생성 + push:
   ```bash
   git remote add origin https://github.com/<username>/terminal-chat.git
   git branch -M main
   git push -u origin main
   ```
3. Vercel → Import Project → GitHub 레포 선택
4. Environment Variables 등록:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy

**Supabase 대시보드에서도:**
- Authentication → URL Configuration → Site URL: `https://your-app.vercel.app`
- Redirect URLs: `https://your-app.vercel.app/**`

**Supabase 대시보드에서 실행해야 할 SQL (`supabase/schema.sql` 아직 미실행):**
→ Supabase SQL Editor에서 `supabase/schema.sql` 전체 실행 필요
→ Storage 버킷 `messages` (public) 생성 필요

---

## 전체 진행 순서 요약

```
Task 9  → ChatRoom.tsx 교체 (Realtime 구독)
Task 10 → MessageList.tsx, MessageItem.tsx, ImageMessage.tsx
Task 11 → ReactionBar.tsx
Task 12 → TypingIndicator.tsx, ChatInput.tsx
        → 빌드 확인
Task 13 → page.tsx (루트 리다이렉트)
Task 14 → GitHub + Vercel 배포
```
