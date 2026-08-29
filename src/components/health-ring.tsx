import { cn } from '@/lib/utils'

type HealthRingProps = {
  score: number
  size?: number
}

/**
 * Circular health meter used on account cards.
 * @param score - 0-100 reputation estimate
 * @param size - Pixel width and height
 */
export const HealthRing = ({ score, size = 72 }: HealthRingProps) => {
  const stroke = 6
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-ink-700"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            'transition-all duration-700',
            score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-ember-400' : 'text-rose-400',
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-lg leading-none text-parchment-50">{score}</span>
        <span className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-parchment-500">
          health
        </span>
      </div>
    </div>
  )
}
