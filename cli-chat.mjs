#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'readline'
import { readFileSync } from 'fs'

// .env.local 로드
const env = {}
try {
  const lines = readFileSync('.env.local', 'utf-8').split('\n')
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) env[match[1].trim()] = match[2].trim()
  }
} catch {
  console.error('\x1b[31m.env.local 파일을 찾을 수 없습니다\x1b[0m')
  process.exit(1)
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\x1b[31mSUPABASE_URL 또는 SUPABASE_ANON_KEY가 없습니다\x1b[0m')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const rl = createInterface({ input: process.stdin, output: process.stdout })
const prompt = (q) => new Promise((r) => rl.question(q, r))

// 색상 헬퍼
const green = (s) => `\x1b[32m${s}\x1b[0m`
const dim = (s) => `\x1b[90m${s}\x1b[0m`
const gray = (s) => `\x1b[37m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function printMessage(msg, myId) {
  const time = formatTime(msg.created_at)
  const isMe = msg.sender_id === myId
  const nick = msg.nickname || msg.sender?.nickname || '?'
  const prefix = isMe ? green(`${nick}:~$`) : gray(`${nick}:~$`)
  const content = msg.content || '[image]'
  process.stdout.write(`\r${dim(`[${time}]`)} ${prefix} ${content}\n`)
}

async function main() {
  console.clear()
  console.log(dim('┌─────────────────────────────────────┐'))
  console.log(dim('│') + bold('   terminal-chat — CLI client        ') + dim('│'))
  console.log(dim('└─────────────────────────────────────┘'))
  console.log()

  const nickname = await prompt(green('nickname:~$ '))
  if (!nickname.trim()) process.exit(0)

  const trimmed = nickname.trim()
  const email = `${trimmed.toLowerCase()}@terminal.chat`
  const password = `terminal-chat-${trimmed}`

  // 로그인 또는 회원가입
  let { error: signInErr } = await supabase.auth.signInWithPassword({ email, password })

  if (signInErr) {
    const { error: signUpErr } = await supabase.auth.signUp({ email, password })
    if (signUpErr) {
      console.error(`\x1b[31merror: ${signUpErr.message}\x1b[0m`)
      process.exit(1)
    }
    // 가입 후 로그인
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error(`\x1b[31merror: ${error.message}\x1b[0m`)
      process.exit(1)
    }
  }

  const { data: { user } } = await supabase.auth.getUser()

  // 프로필 upsert
  await supabase.from('profiles').upsert({ id: user.id, nickname: trimmed })

  console.log()
  console.log(green('● 연결됨') + dim(` — ${trimmed}으로 접속`))
  console.log(dim('메시지를 입력하고 Enter. /quit으로 종료.'))
  console.log(dim('── session started ──'))
  console.log()

  // 최근 메시지 로드
  const { data: recentMsgs } = await supabase
    .from('messages')
    .select('*, sender:profiles!sender_id(nickname)')
    .order('created_at', { ascending: true })

  if (recentMsgs) {
    for (const msg of recentMsgs) {
      printMessage({ ...msg, nickname: msg.sender?.nickname }, user.id)
    }
  }

  // Realtime 구독
  const channel = supabase.channel('cli-chat')

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages' },
    async (payload) => {
      // 자기가 보낸 건 이미 표시했으므로 스킵
      if (payload.new.sender_id === user.id) return

      const { data: sender } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', payload.new.sender_id)
        .single()

      printMessage(
        { ...payload.new, nickname: sender?.nickname },
        user.id
      )
      rl.prompt(true)
    }
  )

  channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return
  })

  // 입력 루프
  const inputPrompt = () => {
    rl.question('', async (input) => {
      const msg = input.trim()
      if (msg === '/quit') {
        console.log(dim('bye.'))
        supabase.removeChannel(channel)
        rl.close()
        process.exit(0)
      }
      if (!msg) {
        inputPrompt()
        return
      }

      const { error } = await supabase.from('messages').insert({
        sender_id: user.id,
        content: msg,
        image_url: null,
      })

      if (error) {
        console.error(`\x1b[31merror: ${error.message}\x1b[0m`)
      } else {
        printMessage(
          { created_at: new Date().toISOString(), sender_id: user.id, content: msg, nickname: trimmed },
          user.id
        )
      }

      inputPrompt()
    })
  }

  inputPrompt()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
