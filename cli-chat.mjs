#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import { createInterface } from 'readline'
import { readFileSync } from 'fs'
import { spawn } from 'child_process'

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
const notificationsEnabled = env.CHAT_CLI_NOTIFICATIONS !== '0'

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
  const content = msg.content?.trim()
  const imageUrl = msg.image_url?.trim()

  if (content) {
    process.stdout.write(`\r${dim(`[${time}]`)} ${prefix} ${content}\n`)
  } else if (imageUrl) {
    process.stdout.write(`\r${dim(`[${time}]`)} ${prefix} ${dim('[image]')} ${imageUrl}\n`)
  } else {
    process.stdout.write(`\r${dim(`[${time}]`)} ${prefix} ${dim('[empty message]')}\n`)
  }
}

function sanitizeNotificationText(text, fallback) {
  return String(text || fallback).replace(/\s+/g, ' ').trim()
}

function escapeAppleScript(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function notifyNewMessage() {
  if (!notificationsEnabled) return

  const safeTitle = sanitizeNotificationText(env.CHAT_CLI_NOTIFICATION_TITLE, 'Notice')

  if (process.platform === 'darwin') {
    const script = `display notification "" with title "${escapeAppleScript(safeTitle)}"`
    const child = spawn('osascript', ['-e', script], { stdio: 'ignore' })
    child.on('error', () => {})
    return
  }

  if (process.platform === 'linux') {
    const child = spawn('notify-send', [safeTitle], { stdio: 'ignore' })
    child.on('error', () => {})
    return
  }

  if (process.platform === 'win32') {
    const script = [
      '[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null',
      '[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null',
      `$xml = New-Object Windows.Data.Xml.Dom.XmlDocument`,
      `$xml.LoadXml("<toast><visual><binding template=\\"ToastGeneric\\"><text>${safeTitle}</text></binding></visual></toast>")`,
      '$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)',
      '[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("terminal-chat").Show($toast)',
    ].join('; ')
    const child = spawn('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'ignore' })
    child.on('error', () => {})
    return
  }
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
  console.log(dim('이미지 메시지는 [image] URL 형태로 표시됩니다.'))
  console.log(dim(`CLI 알림: ${notificationsEnabled ? 'ON' : 'OFF'} (env CHAT_CLI_NOTIFICATIONS=0 으로 비활성화)`))
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

  // 수신된 메시지 ID 추적 (중복 방지)
  const receivedIds = new Set(recentMsgs?.map((m) => m.id) ?? [])

  // 재연결 복구용 상태 추적
  let prevStatus = null
  let lastMessageTime = recentMsgs?.length > 0
    ? recentMsgs[recentMsgs.length - 1].created_at
    : null

  // Realtime 구독
  const channel = supabase.channel('cli-chat')

  channel.on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages' },
    async (payload) => {
      // 자기가 보낸 건 이미 표시했으므로 스킵
      if (payload.new.sender_id === user.id) return

      // 중복 방지
      if (receivedIds.has(payload.new.id)) return
      receivedIds.add(payload.new.id)

      const { data: sender, error: senderError } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', payload.new.sender_id)
        .single()

      if (senderError) {
        process.stderr.write(`\x1b[31m[warn] sender fetch failed: ${senderError.message}\x1b[0m\n`)
      }

      const nickname = sender?.nickname ?? '???'
      printMessage({ ...payload.new, nickname }, user.id)
      notifyNewMessage()
      if (payload.new.created_at > (lastMessageTime ?? '')) {
        lastMessageTime = payload.new.created_at
      }
      rl.prompt(true)
    }
  )

  channel.subscribe(async (status) => {
    const isReconnect = prevStatus !== null && prevStatus !== 'SUBSCRIBED' && status === 'SUBSCRIBED'

    if (status === 'SUBSCRIBED' && isReconnect) {
      process.stdout.write(`\n${green('● 재연결됨')} ${dim('— 누락 메시지 복구 중...')}\n`)

      let query = supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(nickname)')
        .order('created_at', { ascending: true })
      if (lastMessageTime) {
        query = query.gt('created_at', lastMessageTime)
      }

      const { data: missed, error } = await query
      if (error) {
        process.stderr.write(`\x1b[31m[warn] 누락 메시지 fetch 실패: ${error.message}\x1b[0m\n`)
      } else if (missed && missed.length > 0) {
        for (const msg of missed) {
          if (receivedIds.has(msg.id)) continue
          receivedIds.add(msg.id)
          printMessage({ ...msg, nickname: msg.sender?.nickname ?? '???' }, user.id)
          if (msg.created_at > (lastMessageTime ?? '')) {
            lastMessageTime = msg.created_at
          }
        }
      }
      rl.prompt(true)
    }

    if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      process.stdout.write(`\n${dim(`[연결 끊김: ${status}]`)}\n`)
    }

    prevStatus = status
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
        const sentAt = new Date().toISOString()
        printMessage(
          { created_at: sentAt, sender_id: user.id, content: msg, nickname: trimmed },
          user.id
        )
        if (sentAt > (lastMessageTime ?? '')) {
          lastMessageTime = sentAt
        }
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
