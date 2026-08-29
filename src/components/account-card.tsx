import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

import { HealthRing } from '@/components/health-ring'
import { WarmupToggle } from '@/components/warmup-toggle'
import { cn } from '@/lib/utils'
import { getHealthScore } from '@/lib/warmup-schedule'
import type { EmailAccount } from '@/types/account'

type AccountCardProps = {
  account: EmailAccount
  sentToday: number
  quota: number
  daysActive: number
  inboxPlacement: number
  replyRate: number
}

/**
 * Dashboard card summarizing one mailbox's warmup.
 */
export const AccountCard = ({
  account,
  sentToday,
  quota,
  daysActive,
  inboxPlacement,
  replyRate,
}: AccountCardProps) => {
  const score = getHealthScore(daysActive, inboxPlacement / 100, replyRate / 100)
  const progress = quota === 0 ? 0 : Math.min(100, Math.round((sentToday / quota) * 100))

  return (
    <article className="rounded-[1.75rem] border border-white/5 bg-ink-900/80 p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={`/accounts/${account.id}`}
            className="truncate font-medium text-parchment-50 hover:text-ember-300"
          >
            {account.email}
          </Link>
          <p className="mt-1 text-sm text-parchment-400">{account.displayName}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill status={account.status} enabled={account.warmupEnabled} />
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-parchment-400">
              {account.provider}
            </span>
          </div>
        </div>
        <HealthRing score={score} />
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-parchment-400">
          <span>Today</span>
          <span>
            {sentToday} / {quota}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ember-600 to-ember-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-parchment-500">
          Day {daysActive}
          {account.startedAt
            ? ` · started ${formatDistanceToNow(new Date(account.startedAt), { addSuffix: true })}`
            : ''}
        </p>
        <WarmupToggle accountId={account.id} enabled={account.warmupEnabled} />
      </div>

      {account.lastError ? (
        <p className="mt-3 truncate rounded-2xl bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {account.lastError}
        </p>
      ) : null}
    </article>
  )
}

/**
 * Small status chip for a mailbox.
 */
const StatusPill = ({
  status,
  enabled,
}: {
  status: EmailAccount['status']
  enabled: boolean
}) => {
  const label = !enabled ? 'paused' : status
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]',
        label === 'warming' && 'bg-emerald-500/10 text-emerald-300',
        label === 'paused' && 'bg-white/5 text-parchment-400',
        label === 'error' && 'bg-rose-500/10 text-rose-300',
        label === 'idle' && 'bg-white/5 text-parchment-400',
      )}
    >
      {label}
    </span>
  )
}
