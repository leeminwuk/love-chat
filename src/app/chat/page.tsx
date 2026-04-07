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
  const { data: messages, error: messagesError } = await supabase
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
