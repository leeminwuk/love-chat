'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SetupPage() {
  const router = useRouter()
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim()) return

    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    const { error } = await supabase
      .from('profiles')
      .insert({ id: user.id, nickname: nickname.trim() })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/chat')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-terminal-bg flex items-center justify-center font-mono p-4">
      <div className="w-full max-w-md">
        <div className="border border-terminal-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 bg-[#2a2a2a] px-4 py-2.5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 text-center text-[11px] text-terminal-muted">
              terminal-chat — setup
            </div>
          </div>

          <div className="bg-terminal-bg p-6">
            <div className="text-terminal-green mb-2 text-sm">
              <span className="text-terminal-dim">$</span> whoami
            </div>
            <div className="text-terminal-dim text-xs mb-6">
              닉네임을 설정하세요. 채팅창 프롬프트에 표시됩니다.
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-terminal-dim text-sm flex-shrink-0">
                  nickname:
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  maxLength={20}
                  className="flex-1 bg-transparent border-b border-terminal-border text-terminal-text text-sm py-1 outline-none focus:border-terminal-green"
                  placeholder="minuk"
                  autoFocus
                />
              </div>

              {error && (
                <div className="text-red-400 text-xs">
                  <span className="text-terminal-dim">error:</span> {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !nickname.trim()}
                  className="border border-terminal-green text-terminal-green text-sm px-4 py-1.5 rounded hover:bg-terminal-green hover:text-terminal-bg transition-colors disabled:opacity-50"
                >
                  {loading ? 'saving...' : '[enter]'}
                </button>
              </div>
            </form>

            <div className="mt-6 text-terminal-dim text-xs">
              <span className="cursor-blink">█</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
