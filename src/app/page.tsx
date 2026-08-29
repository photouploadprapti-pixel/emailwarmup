import { AccountCard } from '@/components/account-card'
import { ActivityFeed } from '@/components/activity-feed'
import { AppShell } from '@/components/app-shell'
import { EmptyState } from '@/components/empty-state'
import { StatsOverview } from '@/components/stats-overview'
import {
  getAccountStats,
  getDashboardStats,
  getLastTickAt,
  getPersistenceStatus,
  listAccounts,
  listActivities,
} from '@/lib/db'
import { getDailyQuota } from '@/lib/warmup-schedule'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Dashboard of mailboxes, daily warmup stats, and recent activity.
 */
const HomePage = async () => {
  const emptyStats = {
    accountCount: 0,
    warmingCount: 0,
    sentToday: 0,
    inboxPlacement: 100,
    replyRate: 0,
    rescuedToday: 0,
  }

  let accounts: Awaited<ReturnType<typeof listAccounts>> = []
  let stats = emptyStats
  let activities: Awaited<ReturnType<typeof listActivities>> = []
  let lastTickAt: string | null = null
  let persistence: Awaited<ReturnType<typeof getPersistenceStatus>> = {
    backend: 'memory',
    durable: false,
    error: null,
  }

  try {
    ;[accounts, stats, activities, lastTickAt, persistence] = await Promise.all([
      listAccounts(),
      getDashboardStats(),
      listActivities(12),
      getLastTickAt(),
      getPersistenceStatus(),
    ])
  } catch {
    accounts = []
    stats = emptyStats
    activities = []
  }

  const cards = await Promise.all(
    accounts.map(async (account) => {
      const accountStats = await getAccountStats(account.id)
      return {
        account,
        sentToday: accountStats.sentToday,
        quota: getDailyQuota(account.startedAt, account.dailyLimit),
        daysActive: account.startedAt
          ? Math.max(
            1,
            Math.floor(
              (Date.now() - new Date(account.startedAt).getTime()) / 86400000,
            ) + 1,
          )
          : 1,
        inboxPlacement: accountStats.inboxPlacement,
        replyRate: accountStats.replyRate,
      }
    }),
  )

  const emails = Object.fromEntries(accounts.map((account) => [account.id, account.email]))
  const warmingCount = accounts.filter(
    (account) => account.warmupEnabled && account.status === 'warming',
  ).length

  return (
    <AppShell mailboxCount={accounts.length}>
      {!persistence.durable ? (
        <p className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          Mailboxes are not being stored durably
          {persistence.error ? `: ${persistence.error}` : '.'}
          {' '}
          Add working
          {' '}
          <code className="text-rose-50">TURSO_DATABASE_URL</code>
          {' '}
          and
          {' '}
          <code className="text-rose-50">TURSO_AUTH_TOKEN</code>
          {' '}
          in Vercel, then redeploy.
        </p>
      ) : null}

      <StatsOverview stats={stats} />

      <p className="mt-4 text-sm text-parchment-400">
        {warmingCount >= 2
          ? `Warmup is on for ${warmingCount} mailboxes.`
          : 'Warmup needs two connected mailboxes before it can send.'}
        {lastTickAt
          ? ` Last cycle ${new Date(lastTickAt).toLocaleString()}.`
          : ' No cycle has run yet — use Run now after you add two working inboxes.'}
      </p>

      {accounts.length === 1 ? (
        <p className="mt-4 rounded-2xl border border-ember-400/20 bg-ember-500/10 px-4 py-3 text-sm text-ember-100">
          Add a second working mailbox so Hearth can send warmup mail back and forth.
        </p>
      ) : null}

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="font-display text-3xl text-parchment-50">Mailboxes</h2>
          <p className="text-sm text-parchment-400">
            Saved accounts stay here. Open one to pause, fix settings, or remove it.
          </p>
        </div>
        {cards.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {cards.map((card) => (
              <AccountCard key={card.account.id} {...card} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-4 font-display text-3xl text-parchment-50">Activity</h2>
        <ActivityFeed items={activities} emails={emails} />
      </section>
    </AppShell>
  )
}

export default HomePage
