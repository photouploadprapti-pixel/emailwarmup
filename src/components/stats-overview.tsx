import { Inbox, Mail, ShieldCheck, Sparkles } from 'lucide-react'

import type { DashboardStats } from '@/types/activity'

type StatsOverviewProps = {
  stats: DashboardStats
}

/**
 * Four-up metrics row for the dashboard.
 */
export const StatsOverview = ({ stats }: StatsOverviewProps) => {
  const items = [
    {
      label: 'Warming now',
      value: `${stats.warmingCount}`,
      hint: `${stats.accountCount} mailbox${stats.accountCount === 1 ? '' : 'es'}`,
      icon: Sparkles,
    },
    {
      label: 'Sent today',
      value: `${stats.sentToday}`,
      hint: 'Gentle daily ramp',
      icon: Mail,
    },
    {
      label: 'Inbox placement',
      value: `${stats.inboxPlacement}%`,
      hint: 'Opened or rescued',
      icon: Inbox,
    },
    {
      label: 'Reply rate',
      value: `${stats.replyRate}%`,
      hint: `${stats.rescuedToday} rescued today`,
      icon: ShieldCheck,
    },
  ]

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <article
            key={item.label}
            className="rounded-3xl border border-white/5 bg-ink-900/80 p-5 shadow-card"
          >
            <div className="flex items-start justify-between">
              <p className="text-xs uppercase tracking-[0.16em] text-parchment-500">
                {item.label}
              </p>
              <Icon className="h-4 w-4 text-ember-400" />
            </div>
            <p className="mt-3 font-display text-4xl text-parchment-50">{item.value}</p>
            <p className="mt-1 text-sm text-parchment-400">{item.hint}</p>
          </article>
        )
      })}
    </section>
  )
}
