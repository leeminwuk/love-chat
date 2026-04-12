# 채팅 서비스 실시간 메시지 미표시 버그 디버깅 보고서

> 작성일: 2026-04-12  
> 증상: 실시간으로 전송된 메시지가 상대방 화면에 보이지 않을 때가 있음

---

## 1. 발견된 문제들

### 문제 A — Realtime WebSocket 재연결 시 누락 메시지 미복구

**증상**  
네트워크 불안정, 탭 백그라운드 전환, 모바일 화면 잠금 등으로 WebSocket이 잠시 끊겼다가 재연결됐을 때 그 사이에 온 메시지가 영구적으로 유실됨. 새로고침 전까지 보이지 않음.

**원인**  
`ChatRoom.tsx`의 `channel.subscribe()` 콜백에서 `SUBSCRIBED` 상태가 돼도 단순히 `connected=true`만 설정했고, 끊겨 있던 동안 누락된 메시지를 DB에서 보충하는 로직이 없었음.

```typescript
// 기존 코드 (문제 있음)
channel.subscribe((status) => {
  if (status === 'SUBSCRIBED') setConnected(true)  // ← 재연결 처리 없음
  if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setConnected(false)
})
```

**해결**  
이전 연결 상태(`prevStatusRef`)와 마지막 수신 메시지 시각(`lastMessageTimeRef`)을 추적하여, 재연결 시 누락된 메시지를 DB에서 보충.

```typescript
channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    const isReconnect = prevStatusRef.current !== null && prevStatusRef.current !== 'SUBSCRIBED'
    if (isReconnect) {
      // 마지막으로 받은 메시지 이후의 것들을 DB에서 fetch
      const { data: missed } = await supabase
        .from('messages')
        .select('...')
        .gt('created_at', lastMessageTimeRef.current)
      // 중복 제거 후 state에 추가
    }
    setConnected(true)
  }
  prevStatusRef.current = status
})
```

---

### 문제 B — sender 프로필 조회 실패 시 메시지 묵살

**증상**  
상대방 메시지가 Realtime으로 도착했지만 간헐적으로 화면에 안 보임.

**원인**  
상대방 메시지 수신 핸들러에서 `profiles` 테이블을 추가 조회할 때 에러가 발생하면, 메시지 자체를 state에 추가하지 않고 조용히 무시했음.

```typescript
// 기존 코드 (문제 있음)
const { data: sender } = await supabase.from('profiles')...
const newMsg = { ...payload.new, sender: sender! }  // ← sender가 null이면 크래시 또는 유실
setMessages((prev) => [...prev, newMsg])
```

**해결**  
에러 처리 추가. `sender` 조회 실패 시 `partnerUser`를 fallback으로 사용하여 메시지는 반드시 표시.

```typescript
const { data: sender, error } = await supabase.from('profiles')...
const resolvedSender = sender ?? partnerUser ?? { id: payload.new.sender_id, nickname: '???', created_at: '' }
// 중복 메시지 방지
setMessages((prev) => {
  if (prev.some((m) => m.id === newMsg.id)) return prev
  return [...prev, newMsg]
})
```

---

### 문제 C — React Hydration Error #418

**증상**  
브라우저 콘솔에 `Uncaught Error: Minified React error #418` 발생. 채팅 UI 전체가 렌더링되지 않아 메시지가 전혀 안 보임.

**원인**  
`MessageItem.tsx`에서 `toLocaleTimeString('ko-KR')`을 컴포넌트 렌더 시점에 바로 호출했음. 이 함수는 **서버(UTC 기준)**와 **브라우저(로컬 시간대 기준)**에서 다른 문자열을 반환하기 때문에 React가 서버 렌더 결과와 클라이언트 렌더 결과 사이의 불일치(hydration mismatch)를 감지하고 전체 컴포넌트 트리를 크래시시킴.

```typescript
// 기존 코드 (문제 있음)
const time = new Date(message.created_at).toLocaleTimeString('ko-KR', { ... })
// ↑ 서버: UTC 기준 시각, 브라우저: KST 기준 시각 → 불일치!
```

**해결**  
`useEffect` 안에서 계산하여 클라이언트에서만 실행되도록 변경.

```typescript
const [time, setTime] = useState('')

useEffect(() => {
  setTime(new Date(message.created_at).toLocaleTimeString('ko-KR', { ... }))
}, [message.created_at])
```

---

### 문제 D — Next.js 16에서 `dynamic({ ssr: false })` Server Component 사용 불가

**증상**  
```
`ssr: false` is not allowed with `next/dynamic` in Server Components.
Please move it into a Client Component.
```

**원인**  
`chat/page.tsx`는 `async` 함수로 선언된 Server Component인데, 여기서 `dynamic(() => import(...), { ssr: false })`를 직접 사용했음. Next.js 16에서는 이 조합이 허용되지 않음.

또한 기존의 `ClientOnly` 패턴(`useState(false)`)은 Next.js 16에서 완전히 보장되지 않는다는 것을 확인함. Next.js 16 공식 문서 명시:
> *"Client components are prerendered during next build. If you want to disable prerendering for a Client Component and only load it in the browser environment, you can use `next/dynamic`."*

**해결**  
`dynamic({ ssr: false })`를 담은 Client Component 래퍼(`ChatRoomDynamic.tsx`)를 별도로 생성하고, Server Component에서는 이 래퍼를 import.

```typescript
// ChatRoomDynamic.tsx (Client Component)
'use client'
import dynamic from 'next/dynamic'
const ChatRoom = dynamic(() => import('./ChatRoom'), { ssr: false })
export default function ChatRoomDynamic(props) {
  return <ChatRoom {...props} />
}

// chat/page.tsx (Server Component)
import ChatRoomDynamic from '@/components/chat/ChatRoomDynamic'
// ... 데이터 fetch 후 ...
return <ChatRoomDynamic currentUser={...} partnerUser={...} initialMessages={...} />
```

---

## 2. 주의해야 할 점

### 서버/클라이언트 시간 처리
- `Date`, `toLocaleString`, `toLocaleTimeString`, `toLocaleDateString` 등 **locale 또는 timezone에 영향받는 함수**는 절대 컴포넌트 렌더 시점에 바로 사용하면 안 됨
- 반드시 `useEffect` 또는 `useState` + `useEffect` 조합으로 클라이언트에서만 실행
- `Date.now()`, `Math.random()` 등도 서버/클라이언트 불일치를 유발하므로 같은 규칙 적용

### Next.js 16의 Server/Client Component 경계
- `'use client'`를 붙여도 빌드 시 서버에서 prerender됨 (SSR 완전 제외 ≠ `'use client'`)
- SSR을 완전히 배제하려면 반드시 `dynamic({ ssr: false })`를 사용해야 하고, 이는 **Client Component 안에서만** 사용 가능
- `ClientOnly` 패턴(`useState(false)` + `useEffect`)은 구버전에서 동작하던 패턴이며 Next.js 16에서는 신뢰할 수 없음

### Realtime WebSocket
- Supabase Realtime은 WebSocket 기반이라 네트워크 상태에 따라 연결이 끊어질 수 있음
- 재연결 후 누락 메시지 복구 로직은 필수
- `CLOSED`, `CHANNEL_ERROR`, `TIMED_OUT` 모두 처리해야 함

### 에러 처리 누락은 데이터 유실로 이어짐
- Realtime 핸들러 내부의 비동기 작업(DB 조회 등)이 실패해도 사용자는 알 수 없음
- 핸들러 안의 모든 비동기 작업에 에러 처리 및 fallback 추가 필수

---

## 3. 공부해야 할 개념

| 주제 | 핵심 내용 |
|------|-----------|
| **React Hydration** | 서버 렌더링 HTML과 클라이언트 렌더링 결과가 일치해야 함. 불일치 시 error #418 발생. 시간/랜덤값/locale 주의 |
| **Next.js App Router의 RSC** | Server Component와 Client Component의 경계와 prerendering 동작 방식 이해 필요 |
| **next/dynamic { ssr: false }** | 컴포넌트를 브라우저에서만 렌더링하는 공식 방법. Client Component 안에서만 사용 가능 |
| **Supabase Realtime** | WebSocket 기반. `postgres_changes`로 DB 변경사항 구독. 재연결 시 누락 메시지 처리 패턴 |
| **Optimistic UI** | 서버 응답 전에 UI를 먼저 업데이트하고 실패 시 롤백. 임시 ID로 관리 |
| **WebSocket 재연결 패턴** | 연결 상태 추적 → 재연결 감지 → 누락 데이터 fetch → 중복 제거 후 병합 |
| **useRef vs useState** | 렌더링을 유발하지 않는 값(이전 상태, 타이머 등)은 `useRef`로 관리 |
| **suppressHydrationWarning** | 브라우저 확장 프로그램 등 외부 요인으로 생기는 hydration 불일치를 한 단계에서 무시하는 속성. 근본 해결책은 아님 |

---

## 4. 디버깅 방법론 (이번에 배운 것)

1. **production 에러는 정보가 너무 적다** → 항상 `npm run dev` 로컬 개발 서버에서 확인
2. **에러가 지속되면 다른 원인일 수 있다** → 한 가지 원인을 고쳤는데 같은 에러가 나면 다른 위치를 의심
3. **콘솔 로그를 전략적으로 배치** → 각 단계(수신, 상태 업데이트, 렌더링)에 로그를 넣어 어디서 끊기는지 추적
4. **프레임워크 공식 문서를 읽어라** → `node_modules/next/dist/docs/`에 Next.js 16 공식 문서가 있음. 버전이 올라가면 API가 바뀜

---

## 5. 수정 파일 목록

| 파일 | 수정 내용 |
|------|-----------|
| `src/components/chat/ChatRoom.tsx` | 재연결 복구 로직, sender 에러 처리, 중복 방지, 디버그 로그 추가 |
| `src/components/chat/MessageItem.tsx` | `toLocaleTimeString`을 `useEffect`로 이동 (hydration 오류 수정) |
| `src/components/chat/ChatInput.tsx` | Supabase client를 `useRef`로 변경 (매 렌더마다 재생성 방지) |
| `src/components/chat/ChatRoomDynamic.tsx` | **신규 생성** — `dynamic({ ssr: false })` 래퍼 Client Component |
| `src/app/chat/page.tsx` | `ClientOnly` 제거, `ChatRoomDynamic` 사용으로 변경 |
