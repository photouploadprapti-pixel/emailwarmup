import { AddAccountDialog } from '@/components/add-account-dialog'
import { AccountCard } from '@/components/account-card'
import { ActivityFeed } from '@/components/activity-feed'
import { AppShell } from '@/components/app-shell'
import { EmptyState } from '@/components/empty-state'
import { RunNowButton } from '@/components/run-now-button'
import { StatsOverview } from '@/components/stats-overview'
import {
  getAccountStats,
  getDashboardStats,
  getStoreWarning,
  listAccounts,
  listActivities,
} from '@/lib/db'
import { getDailyQuota } from '@/lib/warmup-schedule'

export const dynamic = 'force-dynamic'

/**
 * Dashboard of mailboxes, daily warmup stats, and recent activity.
 */
const HomePage = async () => {
  const [accounts, stats, activities] = await Promise.all([
    listAccounts(),
    getDashboardStats(),
    listActivities(12),
  ])

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

  return (
    <AppShell
      action={
        accounts.length > 0 ? (
          <div className="flex items-center gap-2">
            <RunNowButton />
            <AddAccountDialog />
          </div>
        ) : null
      }
    >
      {getStoreWarning() ? (
        <p className="mb-6 rounded-2xl border border-ember-400/20 bg-ember-500/10 px-4 py-3 text-sm text-ember-100">
          This Vercel deploy has no durable database yet. Add
          {' '}
          <code className="text-ember-50">TURSO_DATABASE_URL</code>
          {' '}
          and
          {' '}
          <code className="text-ember-50">TURSO_AUTH_TOKEN</code>
          {' '}
          in project env vars so mailboxes survive restarts.
        </p>
      ) : null}

      {accounts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-8">
          {accounts.length === 1 ? (
            <p className="rounded-2xl border border-ember-400/20 bg-ember-500/10 px-4 py-3 text-sm text-ember-100">
              Add a second mailbox so Hearth can send warmup mail back and forth.
            </p>
          ) : null}

          <StatsOverview stats={stats} />

          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <h2 className="font-display text-3xl text-parchment-50">Mailboxes</h2>
                <p className="text-sm text-parchment-400">
                  Warmup runs by itself every couple of minutes.
                </p>
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              {cards.map((card) => (
                <AccountCard key={card.account.id} {...card} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-4 font-display text-3xl text-parchment-50">Activity</h2>
            <ActivityFeed items={activities} emails={emails} />
          </section>
        </div>
      )}
    </AppShell>
  )
}

export default HomePage
