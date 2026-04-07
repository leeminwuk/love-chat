'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

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
        {/* 터미널 창 */}
        <div className="border border-terminal-border rounded-lg overflow-hidden">
          {/* 타이틀 바 */}
          <div className="flex items-center gap-2 bg-[#2a2a2a] px-4 py-2.5">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
              <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
              <div className="w-3 h-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex-1 text-center text-[11px] text-terminal-muted">
              terminal-chat — login
            </div>
          </div>

          {/* 로그인 폼 */}
          <div className="bg-terminal-bg p-6">
            <div className="text-terminal-green mb-6 text-sm">
              <span className="text-terminal-dim">$</span> ./login.sh
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-terminal-dim text-sm w-20 flex-shrink-0">
                  email:
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 bg-transparent border-b border-terminal-border text-terminal-text text-sm py-1 outline-none focus:border-terminal-green"
                  placeholder="your@email.com"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-terminal-dim text-sm w-20 flex-shrink-0">
                  password:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="flex-1 bg-transparent border-b border-terminal-border text-terminal-text text-sm py-1 outline-none focus:border-terminal-green"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="text-red-400 text-xs mt-2">
                  <span className="text-terminal-dim">error:</span> {error}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="border border-terminal-green text-terminal-green text-sm px-4 py-1.5 rounded hover:bg-terminal-green hover:text-terminal-bg transition-colors disabled:opacity-50"
                >
                  {loading ? 'authenticating...' : '[enter]'}
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
