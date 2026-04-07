import type { Reaction } from '@/types'

type ReactionBarProps = {
  reactions: Reaction[]
  currentUserId: string
  onReaction: (emoji: string) => void
}

export default function ReactionBar({ reactions, currentUserId, onReaction }: ReactionBarProps) {
  if (reactions.length === 0) return null

  const grouped = reactions.reduce<Record<string, { count: number; isMine: boolean }>>(
    (acc, r) => {
      if (!acc[r.emoji]) acc[r.emoji] = { count: 0, isMine: false }
      acc[r.emoji].count += 1
      if (r.user_id === currentUserId) acc[r.emoji].isMine = true
      return acc
    },
    {}
  )

  return (
    <div className="flex gap-1 flex-wrap">
      {Object.entries(grouped).map(([emoji, { count, isMine }]) => (
        <button
          key={emoji}
          onClick={() => onReaction(emoji)}
          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
            isMine
              ? 'border-terminal-green text-terminal-green bg-terminal-green/10'
              : 'border-terminal-border text-terminal-muted hover:border-terminal-green'
          }`}
        >
          {emoji} {count}
        </button>
      ))}
    </div>
  )
}
