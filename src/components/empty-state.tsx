import { AddAccountDialog } from '@/components/add-account-dialog'

/**
 * Placeholder inside the mailbox list when none are saved yet.
 */
export const EmptyState = () => {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-ink-900/50 px-6 py-14 text-center">
      <h3 className="font-display text-2xl text-parchment-50">No mailboxes yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-parchment-400">
        Add at least two addresses. A mailbox is saved even if SMTP fails, so you
        can fix the port or password and turn warmup on.
      </p>
      <div className="mt-6">
        <AddAccountDialog />
      </div>
    </div>
  )
}
