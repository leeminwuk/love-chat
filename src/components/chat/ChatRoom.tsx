'use client'
import type { Profile, Message } from '@/types'

type ChatRoomProps = {
  currentUser: Profile
  partnerUser: Profile | null
  initialMessages: Message[]
}

export default function ChatRoom({ currentUser, partnerUser, initialMessages }: ChatRoomProps) {
  return (
    <div className="h-screen bg-terminal-bg font-mono flex items-center justify-center">
      <div className="text-terminal-green">
        [{currentUser.nickname}:~$ loading...]
      </div>
    </div>
  )
}
