// src/components/terminal/TitleBar.tsx
type TitleBarProps = {
  status: 'connecting' | 'connected' | 'reconnecting'
}

export default function TitleBar({ status }: TitleBarProps) {
  const statusLabel =
    status === 'connected'
      ? '● 연결됨'
      : status === 'reconnecting'
        ? '◐ 재연결 중...'
        : '○ 연결 중...'

  const statusClass =
    status === 'connected' ? 'text-terminal-green' : 'text-yellow-400'

  return (
    <div className="flex items-center gap-2 bg-[#2a2a2a] px-4 py-2.5 border-b border-terminal-border flex-shrink-0">
      {/* 신호등 */}
      <div className="flex gap-1.5">
        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
      </div>

      {/* 제목 */}
      <div className="flex-1 text-center text-[11px] text-terminal-muted">
        terminal-chat — bash — 80×24
      </div>

      {/* 연결 상태 */}
      <div className={`text-[11px] ${statusClass}`}>
        {statusLabel}
      </div>
    </div>
  )
}
