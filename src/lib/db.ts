import { decryptSecret, encryptSecret } from '@/lib/encrypt'
import {
  getStoreStatus,
  isEphemeralStore,
  loadStore,
  saveStore,
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
 * Ensure the store is loaded. Kept so existing callers stay valid.
 */
export const initDb = async () => {
  await loadStore()
}

/**
 * List every mailbox, newest first.
 */
export const listAccounts = async () => {
  const store = await loadStore()
  return [...store.accounts]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(mapAccount)
}

/**
 * Load one mailbox by id.
 * @param id - Account id
 */
export const getAccount = async (id: string) => {
  const store = await loadStore()
  const row = store.accounts.find((account) => account.id === id)
  return row ? mapAccount(row) : null
}

/**
 * Load a mailbox plus its decrypted password. Server-only.
 * @param id - Account id
 */
export const getAccountWithSecret = async (id: string) => {
  const store = await loadStore()
  const row = store.accounts.find((account) => account.id === id)
  if (!row) {
    return null
  }
  return {
    account: mapAccount(row),
    password: decryptSecret(row.passwordEncrypted),
  }
}

/**
 * Insert a new mailbox.
 * @param input - Connection details captured from the add-account form
 */
export const createAccount = async (
  input: EmailAccountInput,
  options?: { connected?: boolean; lastError?: string | null },
) => {
  const store = await loadStore()
  const createdAt = new Date().toISOString()
  const email = input.email.trim().toLowerCase()
  const connected = options?.connected ?? true
  const existing = store.accounts.find((account) => account.email === email)
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
  if (existing) {
    Object.assign(existing, account)
  } else {
    store.accounts.push(account)
  }
  await saveStore(store)
  return mapAccount(account)
}

/**
 * Update mailbox settings or credentials.
 * @param id - Account id
 * @param input - Partial form values
 */
export const updateAccount = async (id: string, input: AccountUpdateInput) => {
  const store = await loadStore()
  const existing = store.accounts.find((account) => account.id === id)
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

  await saveStore(store)
}

/**
 * Remove a mailbox and its related rows.
 * @param id - Account id
 */
export const deleteAccount = async (id: string) => {
  const store = await loadStore()
  store.accounts = store.accounts.filter((account) => account.id !== id)
  store.activities = store.activities.filter((item) => item.accountId !== id)
  store.sends = store.sends.filter(
    (send) => send.fromAccountId !== id && send.toAccountId !== id,
  )
  await saveStore(store)
}

/**
 * Persist a status and optional error on an account.
 */
export const setAccountStatus = async (
  id: string,
  status: EmailAccount['status'],
  lastError: string | null = null,
) => {
  const store = await loadStore()
  const account = store.accounts.find((item) => item.id === id)
  if (!account) {
    return
  }
  account.status = status
  account.lastError = lastError
  await saveStore(store)
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
  const store = await loadStore()
  store.activities.unshift({
    id: createId(),
    accountId: input.accountId,
    type: input.type,
    peerEmail: input.peerEmail ?? null,
    subject: input.subject ?? null,
    detail: input.detail ?? null,
    status: input.status ?? 'ok',
    createdAt: new Date().toISOString(),
  })
  store.activities = store.activities.slice(0, 200)
  await saveStore(store)
}

/**
 * Recent activity across all mailboxes.
 * @param limit - Maximum rows to return
 */
export const listActivities = async (limit = 20) => {
  const store = await loadStore()
  return store.activities.slice(0, limit)
}

/**
 * Activity for a single mailbox.
 * @param accountId - Account id
 */
export const listAccountActivities = async (accountId: string, limit = 40) => {
  const store = await loadStore()
  return store.activities.filter((item) => item.accountId === accountId).slice(0, limit)
}

/**
 * How many warmup messages an account has sent today.
 */
export const countSendsToday = async (accountId: string) => {
  const store = await loadStore()
  const start = `${todayKey()}T00:00:00.000`
  return store.sends.filter(
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
  const store = await loadStore()
  store.sends.push({
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
  await saveStore(store)
}

/**
 * Find a warmup send by its hidden token.
 */
export const getWarmupSendByToken = async (token: string) => {
  const store = await loadStore()
  const send = store.sends.find((item) => item.token === token)
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
  const store = await loadStore()
  const send = store.sends.find((item) => item.token === token)
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
  await saveStore(store)
}

/**
 * Aggregate numbers for the dashboard header.
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const store = await loadStore()
  const start = `${todayKey()}T00:00:00.000`
  const total = store.sends.length
  const opened = store.sends.filter((send) => send.openedAt || send.rescued).length
  const replied = store.sends.filter((send) => send.repliedAt).length

  return {
    accountCount: store.accounts.length,
    warmingCount: store.accounts.filter(
      (account) => account.warmupEnabled && account.status !== 'paused',
    ).length,
    sentToday: store.sends.filter((send) => send.sentAt >= start).length,
    inboxPlacement: total === 0 ? 100 : Math.round((opened / total) * 100),
    replyRate: total === 0 ? 0 : Math.round((replied / total) * 100),
    rescuedToday: store.sends.filter((send) => send.rescued && send.sentAt >= start).length,
  }
}

/**
 * Per-account warmup counters used on cards and detail pages.
 */
export const getAccountStats = async (accountId: string) => {
  const store = await loadStore()
  const start = `${todayKey()}T00:00:00.000`
  const sends = store.sends.filter((send) => send.fromAccountId === accountId)
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
 * Record when the warmup worker last ran.
 */
export const recordWarmupTick = async () => {
  const store = await loadStore()
  store.lastTickAt = new Date().toISOString()
  await saveStore(store)
}

/**
 * ISO timestamp of the last warmup pass, if any.
 */
export const getLastTickAt = async () => {
  const store = await loadStore()
  return store.lastTickAt
}
