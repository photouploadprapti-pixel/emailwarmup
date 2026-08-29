import { decryptSecret, encryptSecret } from '@/lib/encrypt'
import {
  deleteStoredAccount,
  deleteStoredActivities,
  deleteStoredSends,
  getMeta,
  getStoreStatus,
  insertStoredActivity,
  isEphemeralStore,
  listStoredAccounts,
  listStoredActivities,
  listStoredSends,
  setMeta,
  upsertStoredAccount,
  upsertStoredSend,
  type StoredAccount,
} from '@/lib/store'
import { createId, todayKey } from '@/lib/utils'
import type { AccountUpdateInput, EmailAccount, EmailAccountInput } from '@/types/account'
import type { ActivityItem, ActivityType, DashboardStats } from '@/types/activity'

/**
 * Map a stored account to the public mailbox shape.
 */
const mapAccount = (row: StoredAccount): EmailAccount => {
  const { passwordEncrypted: _passwordEncrypted, ...account } = row
  return account
}

/**
 * Ensure the store is reachable.
 */
export const initDb = async () => {
  await listStoredAccounts()
}

/**
 * List every mailbox, newest first.
 */
export const listAccounts = async () => {
  const rows = await listStoredAccounts()
  return [...rows]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(mapAccount)
}

/**
 * Load one mailbox by id.
 * @param id - Account id
 */
export const getAccount = async (id: string) => {
  const row = (await listStoredAccounts()).find((account) => account.id === id)
  return row ? mapAccount(row) : null
}

/**
 * Load a mailbox plus its decrypted password. Server-only.
 * @param id - Account id
 */
export const getAccountWithSecret = async (id: string) => {
  const row = (await listStoredAccounts()).find((account) => account.id === id)
  if (!row) {
    return null
  }
  return {
    account: mapAccount(row),
    password: decryptSecret(row.passwordEncrypted),
  }
}

/**
 * Insert or update a mailbox and confirm it can be read back.
 */
export const createAccount = async (
  input: EmailAccountInput,
  options?: { connected?: boolean; lastError?: string | null },
) => {
  const createdAt = new Date().toISOString()
  const email = input.email.trim().toLowerCase()
  const connected = options?.connected ?? true
  const existing = (await listStoredAccounts()).find((account) => account.email === email)
  const account: StoredAccount = {
    id: existing?.id ?? createId(),
    email,
    displayName: input.displayName.trim() || email.split('@')[0] || 'Inbox',
    provider: input.provider,
    smtpHost: input.smtpHost.trim(),
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    imapHost: input.imapHost.trim(),
    imapPort: input.imapPort,
    imapSecure: input.imapSecure,
    dailyLimit: input.dailyLimit,
    warmupEnabled: connected,
    status: connected ? 'warming' : 'error',
    lastError: options?.lastError ?? null,
    startedAt: connected ? createdAt : existing?.startedAt ?? null,
    createdAt: existing?.createdAt ?? createdAt,
    passwordEncrypted: encryptSecret(input.password),
  }
  await upsertStoredAccount(account)
  const saved = (await listStoredAccounts()).find((item) => item.email === email)
  if (!saved) {
    throw new Error('Mailbox did not save. Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.')
  }
  return mapAccount(saved)
}

/**
 * Update mailbox settings or credentials.
 * @param id - Account id
 * @param input - Partial form values
 */
export const updateAccount = async (id: string, input: AccountUpdateInput) => {
  const existing = (await listStoredAccounts()).find((account) => account.id === id)
  if (!existing) {
    throw new Error('Account not found')
  }

  existing.displayName = input.displayName ?? existing.displayName
  existing.provider = input.provider ?? existing.provider
  existing.smtpHost = input.smtpHost ?? existing.smtpHost
  existing.smtpPort = input.smtpPort ?? existing.smtpPort
  existing.smtpSecure = input.smtpSecure ?? existing.smtpSecure
  existing.imapHost = input.imapHost ?? existing.imapHost
  existing.imapPort = input.imapPort ?? existing.imapPort
  existing.imapSecure = input.imapSecure ?? existing.imapSecure
  existing.dailyLimit = input.dailyLimit ?? existing.dailyLimit
  existing.warmupEnabled = input.warmupEnabled ?? existing.warmupEnabled
  if (input.password) {
    existing.passwordEncrypted = encryptSecret(input.password)
  }
  if (input.warmupEnabled === false) {
    existing.status = 'paused'
  } else if (existing.status === 'paused' && input.warmupEnabled) {
    existing.status = 'warming'
  }

  await upsertStoredAccount(existing)
}

/**
 * Remove a mailbox and its related rows.
 * @param id - Account id
 */
export const deleteAccount = async (id: string) => {
  await deleteStoredSends(id)
  await deleteStoredActivities(id)
  await deleteStoredAccount(id)
}

/**
 * Persist a status and optional error on an account.
 */
export const setAccountStatus = async (
  id: string,
  status: EmailAccount['status'],
  lastError: string | null = null,
) => {
  const account = (await listStoredAccounts()).find((item) => item.id === id)
  if (!account) {
    return
  }
  account.status = status
  account.lastError = lastError
  await upsertStoredAccount(account)
}

/**
 * Append an activity row for the dashboard feed.
 */
export const addActivity = async (input: {
  accountId: string
  type: ActivityType
  peerEmail?: string | null
  subject?: string | null
  detail?: string | null
  status?: ActivityItem['status']
}) => {
  await insertStoredActivity({
    id: createId(),
    accountId: input.accountId,
    type: input.type,
    peerEmail: input.peerEmail ?? null,
    subject: input.subject ?? null,
    detail: input.detail ?? null,
    status: input.status ?? 'ok',
    createdAt: new Date().toISOString(),
  })
}

/**
 * Recent activity across all mailboxes.
 * @param limit - Maximum rows to return
 */
export const listActivities = async (limit = 20) => {
  return (await listStoredActivities()).slice(0, limit)
}

/**
 * Activity for a single mailbox.
 * @param accountId - Account id
 */
export const listAccountActivities = async (accountId: string, limit = 40) => {
  return (await listStoredActivities())
    .filter((item) => item.accountId === accountId)
    .slice(0, limit)
}

/**
 * How many warmup messages an account has sent today.
 */
export const countSendsToday = async (accountId: string) => {
  const start = `${todayKey()}T00:00:00.000`
  return (await listStoredSends()).filter(
    (send) => send.fromAccountId === accountId && send.sentAt >= start,
  ).length
}

/**
 * Record an outbound warmup message.
 */
export const recordWarmupSend = async (input: {
  fromAccountId: string
  toAccountId: string
  token: string
  subject: string
}) => {
  await upsertStoredSend({
    id: createId(),
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    token: input.token,
    subject: input.subject,
    sentAt: new Date().toISOString(),
    openedAt: null,
    repliedAt: null,
    rescued: false,
  })
}

/**
 * Find a warmup send by its hidden token.
 */
export const getWarmupSendByToken = async (token: string) => {
  const send = (await listStoredSends()).find((item) => item.token === token)
  if (!send) {
    return null
  }
  return {
    id: send.id,
    from_account_id: send.fromAccountId,
    to_account_id: send.toAccountId,
    token: send.token,
    subject: send.subject,
    opened_at: send.openedAt,
    replied_at: send.repliedAt,
    rescued: send.rescued ? 1 : 0,
  }
}

/**
 * Mark a warmup message as opened, replied, or rescued from spam.
 */
export const markWarmupEvent = async (
  token: string,
  event: 'opened' | 'replied' | 'rescued',
) => {
  const send = (await listStoredSends()).find((item) => item.token === token)
  if (!send) {
    return
  }
  const now = new Date().toISOString()
  if (event === 'rescued') {
    send.rescued = true
    send.openedAt = send.openedAt ?? now
  } else if (event === 'opened') {
    send.openedAt = send.openedAt ?? now
  } else {
    send.repliedAt = send.repliedAt ?? now
  }
  await upsertStoredSend(send)
}

/**
 * Aggregate numbers for the dashboard header.
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const [accounts, sends] = await Promise.all([listStoredAccounts(), listStoredSends()])
  const start = `${todayKey()}T00:00:00.000`
  const total = sends.length
  const opened = sends.filter((send) => send.openedAt || send.rescued).length
  const replied = sends.filter((send) => send.repliedAt).length

  return {
    accountCount: accounts.length,
    warmingCount: accounts.filter(
      (account) => account.warmupEnabled && account.status !== 'paused',
    ).length,
    sentToday: sends.filter((send) => send.sentAt >= start).length,
    inboxPlacement: total === 0 ? 100 : Math.round((opened / total) * 100),
    replyRate: total === 0 ? 0 : Math.round((replied / total) * 100),
    rescuedToday: sends.filter((send) => send.rescued && send.sentAt >= start).length,
  }
}

/**
 * Per-account warmup counters used on cards and detail pages.
 */
export const getAccountStats = async (accountId: string) => {
  const start = `${todayKey()}T00:00:00.000`
  const sends = (await listStoredSends()).filter((send) => send.fromAccountId === accountId)
  const total = sends.length
  const opened = sends.filter((send) => send.openedAt || send.rescued).length
  const replied = sends.filter((send) => send.repliedAt).length

  return {
    sentToday: sends.filter((send) => send.sentAt >= start).length,
    totalSent: total,
    inboxPlacement: total === 0 ? 100 : Math.round((opened / total) * 100),
    replyRate: total === 0 ? 0 : Math.round((replied / total) * 100),
    rescued: sends.filter((send) => send.rescued).length,
  }
}

/**
 * Whether this host wipes mailbox data between serverless invocations.
 */
export const getStoreWarning = async () => {
  return isEphemeralStore()
}

/**
 * Persistence backend shown on the dashboard.
 */
export const getPersistenceStatus = async () => {
  return getStoreStatus()
}

/**
 * Record when the warmup worker last ran without rewriting mailboxes.
 */
export const recordWarmupTick = async () => {
  await setMeta('lastTickAt', new Date().toISOString())
}

/**
 * ISO timestamp of the last warmup pass, if any.
 */
export const getLastTickAt = async () => {
  return getMeta('lastTickAt')
}
