'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import {
  addActivity,
  createAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  updateAccount,
} from '@/lib/db'
const accountSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  password: z.string().min(4),
  provider: z.enum(['gmail', 'outlook', 'yahoo', 'custom']),
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  imapHost: z.string().min(1),
  imapPort: z.coerce.number().int().min(1).max(65535),
  imapSecure: z.boolean(),
  dailyLimit: z.coerce.number().int().min(2).max(80),
})

export type ActionResult = {
  ok: boolean
  message: string
}

/**
 * Google App Passwords are shown with spaces; SMTP wants 16 characters.
 */
const normalizePassword = (password: string) => {
  return password.replace(/\s+/g, '')
}

/**
 * Turn provider login errors into a short, actionable message.
 */
const connectionMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : 'Connection failed'
  if (/535|BadCredentials|Username and Password not accepted/i.test(raw)) {
    return 'Gmail rejected this password. Turn on 2-Step Verification, then paste a 16-character App Password — not your normal Gmail password. https://myaccount.google.com/apppasswords'
  }
  if (/ECONNREFUSED|:445\b/i.test(raw)) {
    return 'Connection refused. Port 445 is not SMTP — it is Windows file sharing. Use 465 with SSL checked, or 587 with SSL unchecked.'
  }
  return raw
}

/**
 * Validate SMTP and IMAP credentials for a mailbox.
 */
const testConnection = async (input: z.infer<typeof accountSchema>) => {
  const { verifySmtp } = await import('@/lib/smtp')
  const { verifyImap } = await import('@/lib/imap')
  const password = normalizePassword(input.password)
  await verifySmtp({
    email: input.email,
    displayName: input.displayName,
    smtpHost: input.smtpHost,
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    password,
  })
  await verifyImap({
    email: input.email,
    imapHost: input.imapHost,
    imapPort: input.imapPort,
    imapSecure: input.imapSecure,
    password,
  })
}

/**
 * Add a mailbox after a live SMTP/IMAP check.
 */
export const actionCreateAccount = async (
  raw: unknown,
): Promise<ActionResult> => {
  const parsed = accountSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid form' }
  }

  const data = { ...parsed.data, password: normalizePassword(parsed.data.password) }

  try {
    await testConnection(data)
    const account = await createAccount(data, { connected: true })
    await addActivity({
      accountId: account.id,
      type: 'connected',
      detail: 'Mailbox connected and warmup started',
    })
    const accounts = await listAccounts()
    const warming = accounts.filter((item) => item.warmupEnabled && item.status === 'warming')
    if (warming.length >= 2) {
      const { runWarmupTick } = await import('@/lib/warmup-engine')
      await runWarmupTick()
    }
    revalidatePath('/')
    return { ok: true, message: 'Mailbox saved. Warmup is running in the background.' }
  } catch (error) {
    const message = connectionMessage(error)
    try {
      const account = await createAccount(data, { connected: false, lastError: message })
      await addActivity({
        accountId: account.id,
        type: 'error',
        detail: message,
        status: 'failed',
      })
    } catch {
      return { ok: false, message }
    }
    revalidatePath('/')
    return {
      ok: false,
      message: `${message} The mailbox was still saved on the dashboard so you can fix it.`,
    }
  }
}

/**
 * Check SMTP and IMAP without saving.
 */
export const actionTestAccount = async (raw: unknown): Promise<ActionResult> => {
  const parsed = accountSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid form' }
  }

  try {
    await testConnection(parsed.data)
    return { ok: true, message: 'SMTP and IMAP both look good.' }
  } catch (error) {
    return { ok: false, message: connectionMessage(error) }
  }
}

const updateSchema = accountSchema.extend({
  id: z.string().min(1),
  password: z.string().optional(),
  warmupEnabled: z.boolean().optional(),
})

/**
 * Update mailbox settings. Re-tests the connection if a password is supplied.
 */
export const actionUpdateAccount = async (
  raw: unknown,
): Promise<ActionResult> => {
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid form' }
  }

  const existing = await getAccount(parsed.data.id)
  if (!existing) {
    return { ok: false, message: 'Account not found' }
  }

  try {
    if (parsed.data.password) {
      await testConnection({
        ...parsed.data,
        password: parsed.data.password,
      })
    }

    await updateAccount(parsed.data.id, parsed.data)
    revalidatePath('/')
    revalidatePath(`/accounts/${parsed.data.id}`)
    return { ok: true, message: 'Saved.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save'
    return { ok: false, message }
  }
}

/**
 * Pause or resume warmup for one mailbox.
 */
export const actionToggleWarmup = async (
  id: string,
  warmupEnabled: boolean,
): Promise<ActionResult> => {
  try {
    await updateAccount(id, { warmupEnabled })
    revalidatePath('/')
    revalidatePath(`/accounts/${id}`)
    return {
      ok: true,
      message: warmupEnabled ? 'Warmup resumed.' : 'Warmup paused.',
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not update'
    return { ok: false, message }
  }
}

/**
 * Delete a mailbox and its warmup history.
 */
export const actionDeleteAccount = async (id: string): Promise<ActionResult> => {
  try {
    await deleteAccount(id)
    revalidatePath('/')
    return { ok: true, message: 'Mailbox removed.' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not delete'
    return { ok: false, message }
  }
}
