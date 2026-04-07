export default function TypingIndicator({ nickname }: { nickname: string }) {
  return (
    <div className="px-4 pb-1 text-[11px] text-terminal-muted">
      <span>{nickname}:~$</span>{' '}
      <span className="inline-flex gap-0.5">
        <span className="cursor-blink" style={{ animationDelay: '0ms' }}>▌</span>
        <span className="cursor-blink" style={{ animationDelay: '150ms' }}>▌</span>
        <span className="cursor-blink" style={{ animationDelay: '300ms' }}>▌</span>
      </span>{' '}
      <span className="text-terminal-dim">typing...</span>
    </div>
  )
}
