'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { actionDeleteAccount, actionUpdateAccount } from '@/actions/action-accounts'
import type { EmailAccount } from '@/types/account'

type AccountSettingsProps = {
  account: EmailAccount
}

/**
 * Lightweight settings for daily cap and mailbox removal.
 */
export const AccountSettings = ({ account }: AccountSettingsProps) => {
  const router = useRouter()
  const [dailyLimit, setDailyLimit] = useState(account.dailyLimit)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const result = await actionUpdateAccount({
      id: account.id,
      email: account.email,
      displayName: account.displayName,
      provider: account.provider,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpSecure: account.smtpSecure,
      imapHost: account.imapHost,
      imapPort: account.imapPort,
      imapSecure: account.imapSecure,
      dailyLimit,
    })
    setBusy(false)
    setMessage(result.message)
    if (result.ok) {
      router.refresh()
    }
  }

  const remove = async () => {
    if (!window.confirm(`Remove ${account.email} from Hearth?`)) {
      return
    }
    setBusy(true)
    const result = await actionDeleteAccount(account.id)
    setBusy(false)
    if (result.ok) {
      router.push('/')
      router.refresh()
      return
    }
    setMessage(result.message)
  }

  return (
    <section className="rounded-[1.75rem] border border-white/5 bg-ink-900/80 p-6 shadow-card">
      <h2 className="font-display text-2xl text-parchment-50">Settings</h2>
      <p className="mt-1 text-sm text-parchment-400">
        Warmup ramps toward this daily cap. Passwords stay encrypted on disk.
      </p>

      <label className="mt-5 block">
        <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-parchment-500">
          Daily send cap
        </span>
        <input
          type="number"
          min={2}
          max={80}
          value={dailyLimit}
          onChange={(event) => setDailyLimit(Number(event.target.value) || 0)}
          className="w-40 rounded-2xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-parchment-50 outline-none focus:border-ember-400/70"
        />
      </label>

      {message ? <p className="mt-3 text-sm text-parchment-300">{message}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-full bg-ember-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-ember-400 disabled:opacity-60"
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="rounded-full border border-rose-400/30 px-5 py-2.5 text-sm text-rose-200 hover:bg-rose-500/10 disabled:opacity-60"
        >
          Remove mailbox
        </button>
      </div>
    </section>
  )
}
