import { formatDistanceToNow } from 'date-fns'
import { AlertCircle, Inbox, Mail, Reply, Shield, Sparkles, Eye } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ActivityItem, ActivityType } from '@/types/activity'

type ActivityFeedProps = {
  items: ActivityItem[]
  emails: Record<string, string>
}

const ICONS: Record<ActivityType, typeof Mail> = {
  sent: Mail,
  received: Inbox,
  replied: Reply,
  opened: Eye,
  rescued: Shield,
  error: AlertCircle,
  connected: Sparkles,
}

/**
 * Recent warmup events for the dashboard or an account page.
 */
export const ActivityFeed = ({ items, emails }: ActivityFeedProps) => {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-white/10 px-6 py-10 text-center text-sm text-parchment-500">
        Warmup activity will appear here once mail starts moving.
      </div>
    )
  }

  return (
    <ol className="space-y-2">
      {items.map((item) => {
        const Icon = ICONS[item.type]
        return (
          <li
            key={item.id}
            className="flex items-start gap-3 rounded-2xl border border-white/5 bg-ink-900/60 px-4 py-3"
          >
            <span
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                item.status === 'failed'
                  ? 'bg-rose-500/10 text-rose-300'
                  : 'bg-ember-500/10 text-ember-300',
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-parchment-100">
                {item.subject || item.detail || item.type}
              </p>
              <p className="truncate text-xs text-parchment-500">
                {emails[item.accountId] ?? 'Mailbox'}
                {item.peerEmail ? ` → ${item.peerEmail}` : ''}
              </p>
            </div>
            <time className="shrink-0 text-xs text-parchment-500">
              {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
            </time>
          </li>
        )
      })}
    </ol>
  )
}
