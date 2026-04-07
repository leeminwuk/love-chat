# Terminal Chat App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase Realtime 기반 프라이빗 채팅 웹앱 — 텍스트/이미지 전송, 이모지 리액션, 읽음 확인, 타이핑 인디케이터, macOS 터미널 UI.

**Architecture:** Next.js 15 App Router(서버 컴포넌트로 초기 데이터 로드) + Supabase(Auth/Realtime/Storage) + Tailwind CSS. 미들웨어에서 인증 체크, 프로필 없으면 `/setup` 리다이렉트는 채팅 페이지 서버 컴포넌트에서 처리.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, @supabase/ssr, @supabase/supabase-js, Vercel

---

## 파일 구조

```
/Users/leeminuk/Chat/
  src/
    app/
      (auth)/
        login/page.tsx        ← 터미널 스타일 로그인 폼
        setup/page.tsx        ← 최초 닉네임 설정
      chat/page.tsx           ← 서버 컴포넌트: 초기 메시지 로드 + 프로필 체크
      layout.tsx              ← 루트 레이아웃 (배경색, 폰트)
      globals.css             ← 터미널 테마 CSS 변수
    components/
      terminal/
        TitleBar.tsx          ← 신호등 버튼 + 제목 + 연결 상태
        ChatHeader.tsx        ← session: X ↔ Y + 날짜
      chat/
        ChatRoom.tsx          ← 클라이언트 컴포넌트: Realtime 구독 + 상태 관리
        MessageList.tsx       ← 스크롤 메시지 목록
        MessageItem.tsx       ← 단일 메시지 + 읽음 상태 + 리액션
        ImageMessage.tsx      ← 이미지 썸네일 + 클릭 시 원본
        ReactionBar.tsx       ← 이모지 pill + hover picker
        TypingIndicator.tsx   ← ▌▌▌ typing... 표시
        ChatInput.tsx         ← 입력창 + 이미지 첨부
    lib/
      supabase/
        client.ts             ← createBrowserClient
        server.ts             ← createServerClient (서버 컴포넌트용)
    types/
      index.ts                ← Profile, Message, Reaction, MessageRead 타입
  middleware.ts               ← 미인증 → /login 리다이렉트
  .env.local                  ← Supabase 환경변수
```

---

## Task 1: 프로젝트 초기 설정

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `.env.local`
- Modify: `tailwind.config.ts`
- Modify: `package.json` (의존성 추가)

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
cd /Users/leeminuk/Chat
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint \
  --yes
```

프롬프트가 나오면 모두 기본값(Yes) 선택. 기존 `docs/` 디렉토리는 보존됨.

- [ ] **Step 2: Supabase 패키지 설치**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 3: .env.local 생성**

Supabase 대시보드(Project Settings → API)에서 값 복사.

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 4: tailwind.config.ts에 터미널 테마 색상 추가**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: '#1a1a1a',
          'bg-dark': '#111111',
          'bg-card': '#2a2a2a',
          border: '#333333',
          green: '#6a9955',
          'green-cursor': '#6a9955',
          text: '#d4d4d4',
          muted: '#858585',
          dim: '#555555',
        },
      },
      fontFamily: {
        mono: ['Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 5: globals.css 교체**

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --terminal-bg: #1a1a1a;
  --terminal-green: #6a9955;
  --terminal-text: #d4d4d4;
}

* {
  box-sizing: border-box;
}

body {
  background-color: var(--terminal-bg);
  color: var(--terminal-text);
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

/* 스크롤바 스타일 */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: #1a1a1a;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 3px;
}

/* 커서 깜빡임 */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
.cursor-blink {
  animation: blink 1s step-end infinite;
}
```

- [ ] **Step 6: root layout 설정**

```typescript
// src/app/layout.tsx
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
```

- [ ] **Step 7: 개발 서버 실행 확인**

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 → 기본 Next.js 페이지 확인. 오류 없으면 OK.

- [ ] **Step 8: 커밋**

```bash
git init
git add -A
git commit -m "chore: initial Next.js project setup with terminal theme"
```

---

## Task 2: 타입 정의 + Supabase 클라이언트

**Files:**
- Create: `src/types/index.ts`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: 타입 정의 작성**

```typescript
// src/types/index.ts
export type Profile = {
  id: string
  nickname: string
  created_at: string
}

export type Reaction = {
  id: string
  message_id: string
  user_id: string
  emoji: string
}

export type MessageRead = {
  message_id: string
  user_id: string
  read_at: string
}

export type Message = {
  id: string
  sender_id: string
  content: string | null
  image_url: string | null
  created_at: string
  sender: Profile
  reactions: Reaction[]
  reads: MessageRead[]
}
```

- [ ] **Step 2: 브라우저용 Supabase 클라이언트**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: 서버 컴포넌트용 Supabase 클라이언트**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 서버 컴포넌트에서 호출 시 무시
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: 타입 체크**

```bash
npx tsc --noEmit
```

오류 없으면 OK.

- [ ] **Step 5: 커밋**

```bash
git add src/types/index.ts src/lib/supabase/client.ts src/lib/supabase/server.ts
git commit -m "feat: add types and Supabase client setup"
```

---

## Task 3: 미들웨어 (인증 가드)

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: 미들웨어 작성**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // 미인증 사용자 → /login
  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 인증된 사용자가 /login 접근 → /chat
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/chat', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware for route protection"
```

---

## Task 4: Supabase 스키마 + RLS + Storage

**Files:**
- Create: `supabase/schema.sql` (참고용 — Supabase 대시보드 SQL Editor에서 실행)

- [ ] **Step 1: schema.sql 작성**

```sql
-- supabase/schema.sql

-- profiles
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nickname text not null unique,
  created_at timestamptz default now() not null
);
alter table profiles enable row level security;
create policy "read profiles" on profiles for select to authenticated using (true);
create policy "insert own profile" on profiles for insert to authenticated with check (auth.uid() = id);
create policy "update own profile" on profiles for update to authenticated using (auth.uid() = id);

-- messages
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text,
  image_url text,
  created_at timestamptz default now() not null,
  constraint content_or_image check (content is not null or image_url is not null)
);
alter table messages enable row level security;
create policy "read messages" on messages for select to authenticated using (true);
create policy "insert own messages" on messages for insert to authenticated with check (auth.uid() = sender_id);

-- reactions
create table if not exists reactions (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references messages(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  emoji text not null,
  unique(message_id, user_id, emoji)
);
alter table reactions enable row level security;
create policy "read reactions" on reactions for select to authenticated using (true);
create policy "insert own reactions" on reactions for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own reactions" on reactions for delete to authenticated using (auth.uid() = user_id);

-- message_reads
create table if not exists message_reads (
  message_id uuid references messages(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  read_at timestamptz default now() not null,
  primary key (message_id, user_id)
);
alter table message_reads enable row level security;
create policy "read message_reads" on message_reads for select to authenticated using (true);
create policy "insert own reads" on message_reads for insert to authenticated with check (auth.uid() = user_id);

-- Realtime 활성화
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table reactions;
alter publication supabase_realtime add table message_reads;
```

- [ ] **Step 2: Supabase 대시보드에서 SQL 실행**

  1. Supabase 대시보드 → SQL Editor → `New query`
  2. `supabase/schema.sql` 내용 전체 붙여넣기 → Run
  3. 오류 없이 완료 확인

- [ ] **Step 3: Storage 버킷 생성**

Supabase 대시보드 → Storage → `New bucket`:
- Name: `messages`
- Public bucket: **체크**

이후 SQL Editor에서:

```sql
-- Storage RLS
create policy "authenticated users can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'messages');

create policy "public read"
  on storage.objects for select
  using (bucket_id = 'messages');
```

- [ ] **Step 4: 커밋**

```bash
git add supabase/schema.sql
git commit -m "feat: add Supabase schema SQL and storage setup"
```

---

## Task 5: 터미널 UI 쉘 컴포넌트

**Files:**
- Create: `src/components/terminal/TitleBar.tsx`
- Create: `src/components/terminal/ChatHeader.tsx`

- [ ] **Step 1: TitleBar 컴포넌트 작성**

```typescript
// src/components/terminal/TitleBar.tsx
type TitleBarProps = {
  connected: boolean
}

export default function TitleBar({ connected }: TitleBarProps) {
  return (
    <div className="flex items-center gap-2 bg-[#2a2a2a] px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
      {/* 신호등 */}
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
      </div>

      {/* 제목 */}
      <div className="flex-1 text-center text-[11px] text-terminal-muted">
        terminal-chat — bash — 80×24
      </div>

      {/* 연결 상태 */}
      <div className={`text-[11px] ${connected ? 'text-terminal-green' : 'text-terminal-muted'}`}>
        {connected ? '● 연결됨' : '○ 연결 중...'}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: ChatHeader 컴포넌트 작성**

```typescript
// src/components/terminal/ChatHeader.tsx
type ChatHeaderProps = {
  myNickname: string
  partnerNickname: string
}

export default function ChatHeader({ myNickname, partnerNickname }: ChatHeaderProps) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })

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
```

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/terminal/
git commit -m "feat: add terminal TitleBar and ChatHeader components"
```

---

## Task 6: 로그인 페이지

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: 로그인 페이지 작성**

```typescript
// src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/chat')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-terminal-bg flex items-center justify-center font-mono p-4">
      <div className="w-full max-w-md">
        {/* 터미널 창 */}
        <div className="border border-terminal-border rounded-lg overflow-hidden">
          {/* 타이틀 바 */}
          <div className="flex items-center gap-2 bg-[#2a2a2a] px-4 py-2.5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 text-center text-[11px] text-terminal-muted">
              terminal-chat — login
            </div>
          </div>

          {/* 로그인 폼 */}
          <div className="bg-terminal-bg p-6">
            <div className="text-terminal-green mb-6 text-sm">
              <span className="text-terminal-dim">$</span> ./login.sh
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-terminal-dim text-sm w-20 flex-shrink-0">
                  email:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 bg-transparent border-b border-terminal-border text-terminal-text text-sm py-1 outline-none focus:border-terminal-green"
                  placeholder="your@email.com"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-terminal-dim text-sm w-20 flex-shrink-0">
                  password:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="flex-1 bg-transparent border-b border-terminal-border text-terminal-text text-sm py-1 outline-none focus:border-terminal-green"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="text-red-400 text-xs mt-2">
                  <span className="text-terminal-dim">error:</span> {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="border border-terminal-green text-terminal-green text-sm px-4 py-1.5 rounded hover:bg-terminal-green hover:text-terminal-bg transition-colors disabled:opacity-50"
                >
                  {loading ? 'authenticating...' : '[enter]'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-terminal-dim text-xs">
              <span className="cursor-blink">█</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 동작 확인**

```bash
npm run dev
```

`http://localhost:3000/login` 접속 → 터미널 스타일 로그인 폼 확인. Supabase 대시보드에서 테스트 계정 2개 생성(Authentication → Users → Add user):
- `minuk@test.com` / `password123`
- `jihye@test.com` / `password123`

로그인 시도 → `/chat` 리다이렉트 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(auth\)/login/page.tsx
git commit -m "feat: add terminal-style login page"
```

---

## Task 7: 닉네임 설정 페이지

**Files:**
- Create: `src/app/(auth)/setup/page.tsx`

- [ ] **Step 1: 닉네임 설정 페이지 작성**

```typescript
// src/app/(auth)/setup/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim()) return

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .insert({ id: user.id, nickname: nickname.trim() })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/chat')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-terminal-bg flex items-center justify-center font-mono p-4">
      <div className="w-full max-w-md">
        <div className="border border-terminal-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 bg-[#2a2a2a] px-4 py-2.5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 text-center text-[11px] text-terminal-muted">
              terminal-chat — setup
            </div>
          </div>

          <div className="bg-terminal-bg p-6">
            <div className="text-terminal-green mb-2 text-sm">
              <span className="text-terminal-dim">$</span> whoami
            </div>
            <div className="text-terminal-dim text-xs mb-6">
              닉네임을 설정하세요. 채팅창 프롬프트에 표시됩니다.
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-terminal-dim text-sm flex-shrink-0">
                  nickname:
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  maxLength={20}
                  className="flex-1 bg-transparent border-b border-terminal-border text-terminal-text text-sm py-1 outline-none focus:border-terminal-green"
                  placeholder="minuk"
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-red-400 text-xs">
                  <span className="text-terminal-dim">error:</span> {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !nickname.trim()}
                  className="border border-terminal-green text-terminal-green text-sm px-4 py-1.5 rounded hover:bg-terminal-green hover:text-terminal-bg transition-colors disabled:opacity-50"
                >
                  {loading ? 'saving...' : '[enter]'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-terminal-dim text-xs">
              <span className="cursor-blink">█</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 동작 확인**

`http://localhost:3000/setup` 접속 → 닉네임 입력 → `profiles` 테이블에 레코드 생성 확인 (Supabase 대시보드 → Table Editor → profiles).

- [ ] **Step 3: 커밋**

```bash
git add src/app/\(auth\)/setup/page.tsx
git commit -m "feat: add nickname setup page"
```

---

## Task 8: 채팅 페이지 서버 컴포넌트

**Files:**
- Create: `src/app/chat/page.tsx`

- [ ] **Step 1: 채팅 페이지 서버 컴포넌트 작성**

초기 메시지 로드 + 프로필 체크를 서버에서 처리. `ChatRoom` (클라이언트 컴포넌트)에 props로 전달.

```typescript
// src/app/chat/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Message } from '@/types'
import ChatRoom from '@/components/chat/ChatRoom'

export default async function ChatPage() {
  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 내 프로필 확인
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!myProfile) redirect('/setup')

  // 상대방 프로필 (나 제외 첫 번째)
  const { data: otherProfile } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', user.id)
    .single()

  // 초기 메시지 로드 (최근 50개)
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!sender_id(*),
      reactions(*),
      reads:message_reads(*)
    `)
    .order('created_at', { ascending: true })
    .limit(50)

  return (
    <ChatRoom
      currentUser={myProfile}
      partnerUser={otherProfile ?? null}
      initialMessages={(messages as Message[]) ?? []}
    />
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/chat/page.tsx
git commit -m "feat: add chat page server component with initial data loading"
```

---

## Task 9: ChatRoom 클라이언트 컴포넌트 (Realtime 구독)

**Files:**
- Create: `src/components/chat/ChatRoom.tsx`

채팅의 핵심. Realtime 채널 하나로 messages/reactions/reads/presence 모두 관리.

- [ ] **Step 1: ChatRoom 컴포넌트 작성**

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

  // 읽음 처리: 상대방 메시지 중 내가 안 읽은 것들
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
        // 발신자 프로필 조회
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
        // 상대방 메시지면 즉시 읽음 처리
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
        // 초기 읽음 처리
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

- [ ] **Step 2: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/chat/ChatRoom.tsx
git commit -m "feat: add ChatRoom with Supabase Realtime subscriptions"
```

---

## Task 10: MessageList + MessageItem

**Files:**
- Create: `src/components/chat/MessageList.tsx`
- Create: `src/components/chat/MessageItem.tsx`
- Create: `src/components/chat/ImageMessage.tsx`

- [ ] **Step 1: MessageList 작성**

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

- [ ] **Step 2: MessageItem 작성**

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
      {/* 메시지 본문 */}
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

      {/* 이미지 */}
      {message.image_url && (
        <div className="ml-20 mt-1">
          <ImageMessage url={message.image_url} />
        </div>
      )}

      {/* 읽음 상태 + 리액션 */}
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

      {/* 이모지 picker (hover) */}
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

- [ ] **Step 3: ImageMessage 작성**

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

      {/* 라이트박스 */}
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

- [ ] **Step 4: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add src/components/chat/MessageList.tsx src/components/chat/MessageItem.tsx src/components/chat/ImageMessage.tsx
git commit -m "feat: add MessageList, MessageItem, ImageMessage components"
```

---

## Task 11: ReactionBar

**Files:**
- Create: `src/components/chat/ReactionBar.tsx`

- [ ] **Step 1: ReactionBar 작성**

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

  // emoji별로 그룹핑
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

- [ ] **Step 2: 커밋**

```bash
git add src/components/chat/ReactionBar.tsx
git commit -m "feat: add ReactionBar component"
```

---

## Task 12: TypingIndicator + ChatInput

**Files:**
- Create: `src/components/chat/TypingIndicator.tsx`
- Create: `src/components/chat/ChatInput.tsx`

- [ ] **Step 1: TypingIndicator 작성**

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

- [ ] **Step 2: ChatInput 작성**

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

    // input 초기화
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

        {/* 이미지 첨부 */}
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

        {/* 전송 버튼 */}
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

- [ ] **Step 3: 타입 체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 전체 동작 확인**

두 브라우저 창에서 각각 로그인:
- 창 A: `minuk@test.com`
- 창 B: `jihye@test.com`

체크리스트:
- [ ] 메시지 전송 → 상대방 화면에 실시간으로 나타남
- [ ] 타이핑 중 → 상대방 화면에 `▌▌▌ typing...` 표시
- [ ] 이미지 첨부 → 썸네일 렌더링
- [ ] 클릭 시 라이트박스
- [ ] 메시지 hover → 이모지 picker 팝업
- [ ] 이모지 클릭 → pill 업데이트
- [ ] 같은 이모지 재클릭 → 취소
- [ ] 읽음 표시: 상대방 창 열면 `✓✓ 읽음`으로 변경

- [ ] **Step 5: 커밋**

```bash
git add src/components/chat/TypingIndicator.tsx src/components/chat/ChatInput.tsx
git commit -m "feat: add TypingIndicator and ChatInput with image upload"
```

---

## Task 13: 루트 페이지 리다이렉트

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 루트 페이지를 /login으로 리다이렉트**

```typescript
// src/app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/login')
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npm run build
```

오류 없이 완료 확인.

- [ ] **Step 3: 커밋**

```bash
git add src/app/page.tsx
git commit -m "feat: redirect root to /login"
```

---

## Task 14: Vercel 배포

**Files:**
- Create: `.gitignore` 확인 (`.env.local` 포함 여부)

- [ ] **Step 1: .gitignore 확인**

```bash
cat .gitignore | grep env
```

`.env.local`이 포함되어 있어야 함. 없으면 추가:

```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 2: GitHub 레포 생성 + 푸시**

```bash
# GitHub에서 새 레포 생성 후
git remote add origin https://github.com/<username>/terminal-chat.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Vercel 배포 설정**

  1. [vercel.com](https://vercel.com) → Import Project → GitHub 레포 선택
  2. Framework Preset: **Next.js** (자동 감지)
  3. Environment Variables 추가:
     - `NEXT_PUBLIC_SUPABASE_URL` = Supabase URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Supabase anon key
  4. **Deploy** 클릭

- [ ] **Step 4: 배포 후 확인**

  Vercel이 제공한 URL로 접속:
  - `/login` → 터미널 로그인 폼
  - 로그인 → `/chat` 리다이렉트 + 실시간 채팅 동작

- [ ] **Step 5: Supabase Auth URL 설정**

  Supabase 대시보드 → Authentication → URL Configuration:
  - Site URL: `https://your-app.vercel.app`
  - Redirect URLs에 `https://your-app.vercel.app/**` 추가

- [ ] **Step 6: 최종 커밋**

```bash
git add .gitignore
git commit -m "chore: finalize deployment config"
git push origin main
```

---

## 셀프 리뷰 체크리스트

**스펙 커버리지:**
- [x] 터미널 UI (검정 배경 + 뮤트 그린) → Task 1, 5
- [x] 이메일 + 비밀번호 인증 → Task 6
- [x] 닉네임 설정 → Task 7
- [x] 텍스트 메시지 전송 → Task 9, 12
- [x] 이미지 전송 → Task 4 (Storage), 10, 12
- [x] 이모지 리액션 → Task 9, 11
- [x] 읽음 확인 → Task 9, 10
- [x] 타이핑 인디케이터 → Task 9, 12
- [x] Supabase Realtime → Task 9
- [x] Vercel 배포 → Task 14

**타입 일관성:**
- `Message.reads` → `MessageRead[]` — Task 2 정의, Task 9/10에서 동일하게 사용
- `Message.reactions` → `Reaction[]` — Task 2 정의, Task 9/11에서 동일하게 사용
- `onReaction(messageId, emoji)` — Task 9 ChatRoom → Task 10 MessageItem → Task 11 ReactionBar 동일 시그니처
