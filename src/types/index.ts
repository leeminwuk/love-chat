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
