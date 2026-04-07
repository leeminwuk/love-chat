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
