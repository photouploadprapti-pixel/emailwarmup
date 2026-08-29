import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { AccountSettings } from '@/components/account-settings'
import { ActivityFeed } from '@/components/activity-feed'
import { AppShell } from '@/components/app-shell'
import { HealthRing } from '@/components/health-ring'
import { WarmupToggle } from '@/components/warmup-toggle'
import { getAccount, getAccountStats, listAccountActivities } from '@/lib/db'
import { getDailyQuota, getHealthScore } from '@/lib/warmup-schedule'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type AccountPageProps = {
  params: Promise<{ id: string }>
}

/**
 * Detail page for one mailbox: health, activity, and settings.
 */
const AccountPage = async ({ params }: AccountPageProps) => {
  const { id } = await params
  const account = await getAccount(id)
  if (!account) {
    notFound()
  }

  const [stats, activities] = await Promise.all([
    getAccountStats(account.id),
    listAccountActivities(account.id),
  ])

  const quota = getDailyQuota(account.startedAt, account.dailyLimit)
  const daysActive = account.startedAt
    ? Math.max(
      1,
      Math.floor((Date.now() - new Date(account.startedAt).getTime()) / 86400000) + 1,
    )
    : 1
  const score = getHealthScore(daysActive, stats.inboxPlacement / 100, stats.replyRate / 100)

  return (
    <AppShell>
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-parchment-400 hover:text-parchment-100"
      >
        <ArrowLeft className="h-4 w-4" />
        All mailboxes
      </Link>

      <section className="mb-6 flex flex-col gap-6 rounded-[1.75rem] border border-white/5 bg-ink-900/80 p-6 shadow-card md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-parchment-500">
            {account.provider}
          </p>
          <h1 className="mt-1 font-display text-4xl text-parchment-50">{account.email}</h1>
          <p className="mt-2 text-parchment-400">{account.displayName}</p>
        </div>
        <div className="flex items-center gap-5">
          <HealthRing score={score} size={88} />
          <WarmupToggle accountId={account.id} enabled={account.warmupEnabled} />
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Today" value={`${stats.sentToday} / ${quota}`} />
        <Stat label="Inbox placement" value={`${stats.inboxPlacement}%`} />
        <Stat label="Replies" value={`${stats.replyRate}%`} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="mb-4 font-display text-3xl text-parchment-50">Activity</h2>
          <ActivityFeed
            items={activities}
            emails={{ [account.id]: account.email }}
          />
        </div>
        <AccountSettings account={account} />
      </div>
    </AppShell>
  )
}

/**
 * Compact metric tile on the account page.
 */
const Stat = ({ label, value }: { label: string; value: string }) => {
  return (
    <article className="rounded-3xl border border-white/5 bg-ink-900/80 p-5 shadow-card">
      <p className="text-xs uppercase tracking-[0.16em] text-parchment-500">{label}</p>
      <p className="mt-2 font-display text-3xl text-parchment-50">{value}</p>
    </article>
  )
}

export default AccountPage
