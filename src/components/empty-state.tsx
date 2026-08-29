import { Flame } from 'lucide-react'

import { AddAccountDialog } from '@/components/add-account-dialog'

/**
 * First-run dashboard when no mailboxes have been added.
 */
export const EmptyState = () => {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-ink-900/70 px-8 py-16 text-center shadow-card">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(224,122,31,0.18),transparent_42%)]" />
      <div className="relative mx-auto flex max-w-xl flex-col items-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-ember-500/15 text-ember-400 shadow-glow">
          <Flame className="h-8 w-8" />
        </span>
        <h1 className="mt-6 font-display text-4xl text-parchment-50 sm:text-5xl">
          Warm new inboxes the quiet way.
        </h1>
        <p className="mt-4 text-base leading-7 text-parchment-400">
          Add at least two of your addresses. Hearth sends short, human emails
          between them, opens what arrives, pulls mail out of spam, and slowly
          raises the daily volume.
        </p>
        <div className="mt-8">
          <AddAccountDialog />
        </div>
      </div>
    </section>
  )
}
