import Link from 'next/link'

import { AppShell } from '@/components/app-shell'

/**
 * Fallback page when a mailbox id does not exist.
 */
const NotFoundPage = () => {
  return (
    <AppShell>
      <section className="rounded-[2rem] border border-white/5 bg-ink-900/70 px-8 py-16 text-center">
        <h1 className="font-display text-4xl text-parchment-50">That mailbox is gone.</h1>
        <p className="mt-3 text-parchment-400">It may have been removed from Hearth.</p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-ember-500 px-5 py-2.5 text-sm font-medium text-ink-950"
        >
          Back to the dashboard
        </Link>
      </section>
    </AppShell>
  )
}

export default NotFoundPage
