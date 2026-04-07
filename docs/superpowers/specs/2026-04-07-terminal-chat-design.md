# Terminal Chat App — Design Spec
**Date:** 2026-04-07
**Stack:** Next.js 15 App Router · Supabase · Vercel

---

## 개요

민욱과 여자친구 지혜, 단둘이 사용하는 프라이빗 채팅 웹앱. macOS Terminal.app 스타일(검정 배경 + 뮤트 그린 `#6a9955` 텍스트)의 UI로 구성. Supabase Realtime 기반 실시간 메시지, 이미지 전송, 이모지 리액션, 읽음 확인을 지원한다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 15 App Router (TypeScript) |
| 스타일링 | Tailwind CSS (monospace 폰트, 다크 터미널 테마, 프롬프트 컬러 `#6a9955`) |
| 인증 | Supabase Auth (이메일 + 비밀번호) |
| 실시간 메시지 | Supabase Realtime (Postgres Changes) |
| 이미지 저장 | Supabase Storage |
| DB | Supabase PostgreSQL |
| 배포 | Vercel |

---

## 데이터베이스 스키마

### `profiles`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK, FK → auth.users) | |
| nickname | text | 터미널 프롬프트에 표시될 이름 |
| created_at | timestamptz | |

### `messages`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| sender_id | uuid (FK → profiles.id) | |
| content | text | 텍스트 메시지 (null 허용 — 이미지 전용 메시지) |
| image_url | text | Supabase Storage 이미지 URL (nullable) |
| created_at | timestamptz | |

### `reactions`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid (PK) | |
| message_id | uuid (FK → messages.id) | |
| user_id | uuid (FK → profiles.id) | |
| emoji | text | 단일 이모지 문자 |
| UNIQUE | (message_id, user_id, emoji) | 같은 리액션 중복 방지 |

### `message_reads`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| message_id | uuid (FK → messages.id) | |
| user_id | uuid (FK → profiles.id) | |
| read_at | timestamptz | |
| PRIMARY KEY | (message_id, user_id) | |

**RLS 정책:** 모든 테이블에 Row Level Security 적용. 인증된 사용자만 읽기/쓰기 허용.

---

## 화면 구성

### 1. 로그인 페이지 (`/login`)
- 터미널 스타일 폼: `email:`, `password:` 레이블
- 이메일 + 비밀번호 입력 후 `[enter]` 버튼으로 로그인
- Supabase Auth `signInWithPassword` 사용
- 로그인 성공 시 `/chat`으로 리다이렉트

### 2. 닉네임 설정 페이지 (`/setup`)
- 최초 로그인 시에만 표시 (profiles 레코드 없을 때)
- 닉네임 입력 → profiles 테이블에 INSERT

### 3. 채팅 페이지 (`/chat`)
터미널 창 전체 레이아웃:

```
┌─────────────────────────────────────────┐
│ ● ● ●   terminal-chat — bash — 80×24   ● 연결됨 │  ← 타이틀 바
├─────────────────────────────────────────┤
│ session: minuk ↔ 지혜    2026-04-07 Mon │  ← 헤더
├─────────────────────────────────────────┤
│                                         │
│  ── session started ──                  │
│  [10:21] minuk:~$ 안녕 오늘 뭐해?       │
│  [10:22] 지혜:~$ 나 카페 왔어~          │
│           ✓✓ 읽음   ❤️ 1               │
│  [10:24] 지혜:~$ [image attached]       │
│           ☕ 카페사진.jpg               │
│  지혜:~$ ▌▌▌ typing...                 │  ← 타이핑 인디케이터
│                                         │
├─────────────────────────────────────────┤
│ minuk:~$ [메시지 입력...]   📎  [enter] │  ← 입력창
│ press enter to send · attach image 📎   │
└─────────────────────────────────────────┘
```

---

## 실시간 데이터 흐름

1. **메시지 수신:** `messages` 테이블 INSERT 이벤트 구독 → 새 메시지 즉시 렌더링
2. **읽음 처리:** 채팅창 포커스 시 상대방 메시지를 `message_reads`에 upsert
3. **읽음 표시:** `message_reads` INSERT 이벤트 구독 → 메시지 아래 `✓✓ 읽음` 업데이트
4. **이모지 리액션:** `reactions` 변경 이벤트 구독 → 해당 메시지 리액션 pill 실시간 업데이트
5. **타이핑 인디케이터:** Supabase Realtime Presence 사용 → `typing: true/false` broadcast

---

## 이미지 업로드 흐름

1. 📎 버튼 클릭 → 파일 선택
2. `messages` 버킷에 업로드 (`{sender_id}/{timestamp}-{filename}`)
3. 반환된 public URL을 `messages.image_url`에 저장
4. 채팅창에 썸네일 렌더링 (클릭 시 원본 이미지 열기)

---

## 이모지 리액션 UX

- 메시지 hover 시 이모지 선택 팝업 표시 (❤️ 😂 😮 😢 👍 5개 고정)
- 이미 리액션한 이모지 클릭 시 취소 (DELETE)
- 리액션 pill: `❤️ 1` 형태로 표시

---

## 라우팅 구조

```
/                → /login 리다이렉트
/login           → 로그인 페이지
/setup           → 닉네임 설정 (최초 1회)
/chat            → 메인 채팅 페이지 (인증 필요)
```

---

## 환경변수

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## 프로젝트 구조

```
src/
  app/
    (auth)/
      login/page.tsx
      setup/page.tsx
    chat/page.tsx
    layout.tsx
  components/
    chat/
      MessageList.tsx
      MessageItem.tsx
      ImageMessage.tsx
      ReactionBar.tsx
      TypingIndicator.tsx
      ChatInput.tsx
    terminal/
      TitleBar.tsx
      ChatHeader.tsx
  lib/
    supabase/
      client.ts       ← 브라우저용
      server.ts       ← 서버 컴포넌트용
      middleware.ts
  types/
    index.ts
middleware.ts
```

---

## 배포

- Vercel에 GitHub 레포 연결
- Supabase 프로젝트 환경변수 Vercel에 등록
- `main` 브랜치 push → 자동 배포
