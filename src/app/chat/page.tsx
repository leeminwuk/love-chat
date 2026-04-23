import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Message } from '@/types'
import ChatRoomDynamic from '@/components/chat/ChatRoomDynamic'

const INITIAL_PAGE_SIZE = 50

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

  // 초기 메시지 로드 (최신 50개 + 이전 페이지 존재 여부 확인용 1개)
  const { data: messages } = await supabase
    .from('messages')
    .select(`
      *,
      sender:profiles!sender_id(*),
      reactions(*),
      reads:message_reads(*)
    `)
    .order('created_at', { ascending: false })
    .limit(INITIAL_PAGE_SIZE + 1)

  const newestFirst = (messages as Message[]) ?? []
  const initialHasOlder = newestFirst.length > INITIAL_PAGE_SIZE
  const initialMessages = newestFirst
    .slice(0, INITIAL_PAGE_SIZE)
    .reverse()

  return (
    <ChatRoomDynamic
      currentUser={myProfile}
      partnerUser={otherProfile ?? null}
      initialMessages={initialMessages}
      initialHasOlder={initialHasOlder}
    />
  )
}
