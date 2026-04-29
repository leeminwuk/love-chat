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

  const [myProfileResult, otherProfileResult, messagesResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!sender_id(*),
        reactions(*),
        reads:message_reads(*)
      `)
      .order('created_at', { ascending: false })
      .limit(INITIAL_PAGE_SIZE + 1),
  ])

  const myProfile = myProfileResult.data
  if (!myProfile) redirect('/setup')

  const newestFirst = (messagesResult.data as Message[]) ?? []
  const initialHasOlder = newestFirst.length > INITIAL_PAGE_SIZE
  const initialMessages = newestFirst
    .slice(0, INITIAL_PAGE_SIZE)
    .reverse()

  return (
    <ChatRoomDynamic
      currentUser={myProfile}
      partnerUser={otherProfileResult.data ?? null}
      initialMessages={initialMessages}
      initialHasOlder={initialHasOlder}
    />
  )
}
