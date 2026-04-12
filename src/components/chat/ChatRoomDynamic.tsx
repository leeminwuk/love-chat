'use client'

import dynamic from 'next/dynamic'
import type { Message, Profile } from '@/types'

const ChatRoom = dynamic(() => import('./ChatRoom'), { ssr: false })

type Props = {
  currentUser: Profile
  partnerUser: Profile | null
  initialMessages: Message[]
}

export default function ChatRoomDynamic(props: Props) {
  return <ChatRoom {...props} />
}
