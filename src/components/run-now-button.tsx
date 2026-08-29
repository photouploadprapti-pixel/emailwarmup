'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

import { actionRunWarmupTick } from '@/actions/action-warmup'

/**
 * Manually trigger one background warmup pass.
 */
export const RunNowButton = () => {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const run = async () => {
    setBusy(true)
    await actionRunWarmupTick()
    router.refresh()
    setBusy(false)
  }

  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2.5 text-sm text-parchment-100 hover:bg-white/5 disabled:opacity-60"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      Run now
    </button>
  )
}
