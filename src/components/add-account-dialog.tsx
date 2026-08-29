'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'

import { actionCreateAccount, actionTestAccount } from '@/actions/action-accounts'
import { PROVIDER_PRESETS } from '@/lib/providers'
import { cn } from '@/lib/utils'
import type { AccountProvider } from '@/types/account'

const emptyForm = {
  email: '',
  displayName: '',
  password: '',
  provider: 'gmail' as AccountProvider,
  smtpHost: 'smtp.gmail.com',
  smtpPort: 587,
  smtpSecure: false,
  imapHost: 'imap.gmail.com',
  imapPort: 993,
  imapSecure: true,
  dailyLimit: 25,
}

type AddAccountDialogProps = {
  label?: string
}

/**
 * Modal form for connecting a mailbox and starting warmup.
 */
export const AddAccountDialog = ({ label = 'Add mailbox' }: AddAccountDialogProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [busy, setBusy] = useState<'test' | 'save' | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const preset = useMemo(
    () => PROVIDER_PRESETS.find((item) => item.id === form.provider),
    [form.provider],
  )

  const applyProvider = (provider: AccountProvider) => {
    const next = PROVIDER_PRESETS.find((item) => item.id === provider)
    if (!next) {
      return
    }
    setForm((current) => ({
      ...current,
      provider,
      smtpHost: next.smtpHost || current.smtpHost,
      smtpPort: next.smtpPort,
      smtpSecure: next.smtpSecure,
      imapHost: next.imapHost || current.imapHost,
      imapPort: next.imapPort,
      imapSecure: next.imapSecure,
    }))
  }

  const close = () => {
    setOpen(false)
    setBusy(null)
    setMessage(null)
    setForm(emptyForm)
  }

  const submit = async (mode: 'test' | 'save') => {
    setBusy(mode)
    setMessage(null)
    const action = mode === 'test' ? actionTestAccount : actionCreateAccount
    const result = await action(form)
    setBusy(null)
    setMessage({ ok: result.ok, text: result.message })
    if (result.ok && mode === 'save') {
      router.refresh()
      close()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full bg-ember-500 px-5 py-2.5 text-sm font-medium text-ink-950 shadow-glow transition hover:bg-ember-400"
      >
        <Plus className="h-4 w-4" />
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
            aria-label="Close dialog"
          />
          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[1.75rem] border border-white/10 bg-ink-900 p-6 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-3xl text-parchment-50">Add a mailbox</h2>
                <p className="mt-1 text-sm text-parchment-400">
                  Hearth connects over SMTP and IMAP, then warms it automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-2 text-parchment-400 hover:bg-white/5 hover:text-parchment-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-2">
              {PROVIDER_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => applyProvider(item.id)}
                  className={cn(
                    'rounded-2xl border px-2 py-2.5 text-sm transition',
                    form.provider === item.id
                      ? 'border-ember-400/60 bg-ember-500/15 text-parchment-50'
                      : 'border-white/5 bg-ink-800 text-parchment-400 hover:border-white/10',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-parchment-500">{preset?.hint}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <input
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  type="email"
                  placeholder="you@company.com"
                  className={fieldClass}
                />
              </Field>
              <Field label="Display name">
                <input
                  value={form.displayName}
                  onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                  placeholder="Jordan"
                  className={fieldClass}
                />
              </Field>
              <Field label="Password or app password" className="sm:col-span-2">
                <input
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                  type="password"
                  placeholder="App password"
                  className={fieldClass}
                />
              </Field>
              <Field label="SMTP host">
                <input
                  value={form.smtpHost}
                  onChange={(event) => setForm({ ...form, smtpHost: event.target.value })}
                  className={fieldClass}
                />
              </Field>
              <Field label="SMTP port">
                <input
                  value={form.smtpPort}
                  onChange={(event) => setForm({
                    ...form,
                    smtpPort: Number(event.target.value) || 0,
                  })}
                  type="number"
                  className={fieldClass}
                />
              </Field>
              <Field label="IMAP host">
                <input
                  value={form.imapHost}
                  onChange={(event) => setForm({ ...form, imapHost: event.target.value })}
                  className={fieldClass}
                />
              </Field>
              <Field label="IMAP port">
                <input
                  value={form.imapPort}
                  onChange={(event) => setForm({
                    ...form,
                    imapPort: Number(event.target.value) || 0,
                  })}
                  type="number"
                  className={fieldClass}
                />
              </Field>
              <Field label="Daily send cap">
                <input
                  value={form.dailyLimit}
                  onChange={(event) => setForm({
                    ...form,
                    dailyLimit: Number(event.target.value) || 0,
                  })}
                  type="number"
                  min={2}
                  max={80}
                  className={fieldClass}
                />
              </Field>
              <div className="flex flex-col justify-end gap-2 pb-2 text-sm text-parchment-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.smtpSecure}
                    onChange={(event) => setForm({ ...form, smtpSecure: event.target.checked })}
                    className="h-4 w-4 accent-ember-500"
                  />
                  SMTP uses SSL
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.imapSecure}
                    onChange={(event) => setForm({ ...form, imapSecure: event.target.checked })}
                    className="h-4 w-4 accent-ember-500"
                  />
                  IMAP uses SSL
                </label>
              </div>
            </div>

            {message ? (
              <p className={cn(
                'mt-4 rounded-2xl px-3 py-2 text-sm',
                message.ok
                  ? 'bg-emerald-500/10 text-emerald-200'
                  : 'bg-rose-500/10 text-rose-200',
              )}
              >
                {message.text}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void submit('test')}
                className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-parchment-100 hover:bg-white/5 disabled:opacity-60"
              >
                {busy === 'test' ? <Busy label="Testing" /> : 'Test connection'}
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void submit('save')}
                className="rounded-full bg-ember-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-ember-400 disabled:opacity-60"
              >
                {busy === 'save' ? <Busy label="Connecting" /> : 'Start warmup'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

const fieldClass =
  'w-full rounded-2xl border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-parchment-50 outline-none placeholder:text-parchment-500 focus:border-ember-400/70'

type FieldProps = {
  label: string
  children: React.ReactNode
  className?: string
}

/**
 * Labeled form field wrapper.
 */
const Field = ({ label, children, className }: FieldProps) => {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1.5 block text-xs uppercase tracking-[0.14em] text-parchment-500">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * Compact spinner used on dialog buttons.
 */
const Busy = ({ label }: { label: string }) => {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </span>
  )
}
