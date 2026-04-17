'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type ChatInputProps = {
  nickname: string
  senderId: string
  onSend: (content: string, imageUrl?: string) => Promise<void>
  onTyping: (isTyping: boolean) => void
}

function getSafeImageExtension(file: File) {
  const mimeExtension = file.type.split('/')[1]?.toLowerCase()
  const normalizedMimeExtension = mimeExtension === 'jpeg' ? 'jpg' : mimeExtension
  if (normalizedMimeExtension && /^[a-z0-9]+$/.test(normalizedMimeExtension)) {
    return normalizedMimeExtension
  }

  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  if (fileExtension && /^[a-z0-9]+$/.test(fileExtension)) {
    return fileExtension
  }

  return 'bin'
}

export default function ChatInput({ nickname, senderId, onSend, onTyping }: ChatInputProps) {
  const [text, setText] = useState('')
  const [uploading, setUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value)
    if (errorMessage) setErrorMessage(null)
    onTyping(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => onTyping(false), 1500)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || uploading) return

    const content = text.trim()
    setText('')
    setErrorMessage(null)
    onTyping(false)
    try {
      await onSend(content)
    } catch (error) {
      const message = error instanceof Error ? error.message : '메시지 전송에 실패했습니다.'
      console.error('Send failed:', error)
      setErrorMessage(message)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMessage('이미지 파일만 업로드할 수 있습니다.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    setErrorMessage(null)

    try {
      const extension = getSafeImageExtension(file)
      const path = `${senderId}/${Date.now()}.${extension}`
      const { error } = await supabase.storage
        .from('messages')
        .upload(path, file)

      if (error) {
        throw error
      }

      const { data } = supabase.storage.from('messages').getPublicUrl(path)
      await onSend('', data.publicUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : '이미지 업로드에 실패했습니다.'
      console.error('Upload failed:', error)
      setErrorMessage(message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
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

      <div className="mt-1 flex items-center justify-between gap-4">
        <div className="text-terminal-dim text-[10px]">
          press enter to send · attach image with 📎
        </div>
        {errorMessage && (
          <div className="text-[10px] text-red-400 text-right">
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  )
}
