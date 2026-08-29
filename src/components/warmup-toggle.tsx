'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { actionToggleWarmup } from '@/actions/action-accounts'
import { cn } from '@/lib/utils'

type WarmupToggleProps = {
  accountId: string
  enabled: boolean
}

/**
 * Pause or resume background warmup for one mailbox.
 */
export const WarmupToggle = ({ accountId, enabled }: WarmupToggleProps) => {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const toggle = async () => {
    setPending(true)
    await actionToggleWarmup(accountId, !enabled)
    router.refresh()
    setPending(false)
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={pending}
      className={cn(
        'relative h-7 w-12 rounded-full transition',
        enabled ? 'bg-ember-500' : 'bg-ink-600',
      )}
      aria-label={enabled ? 'Pause warmup' : 'Resume warmup'}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white transition',
          enabled ? 'left-6' : 'left-1',
        )}
      />
    </button>
  )
}
