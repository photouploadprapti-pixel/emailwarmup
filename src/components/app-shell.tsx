import Link from 'next/link'
import { Flame } from 'lucide-react'

import { AddAccountDialog } from '@/components/add-account-dialog'
import { RunNowButton } from '@/components/run-now-button'

type AppShellProps = {
  children: React.ReactNode
  mailboxCount?: number
  showActions?: boolean
}

/**
 * Shared page chrome with mailbox navigation always visible.
 */
export const AppShell = ({
  children,
  mailboxCount = 0,
  showActions = true,
}: AppShellProps) => {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ember-500/15 text-ember-400 shadow-glow">
            <Flame className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-display text-2xl leading-none text-parchment-50">
              Hearth
            </span>
            <span className="block text-xs tracking-[0.18em] text-parchment-500 uppercase">
              Email warmup
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-white/10 px-4 py-2.5 text-sm text-parchment-100 hover:bg-white/5"
          >
            Mailboxes
            {mailboxCount > 0 ? ` (${mailboxCount})` : ''}
          </Link>
          {showActions ? (
            <>
              <RunNowButton />
              <AddAccountDialog />
            </>
          ) : null}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16">{children}</main>
    </div>
  )
}
