import { mkdirSync } from 'fs'
import path from 'path'

import { createClient, type InValue } from '@libsql/client'

import { decryptSecret, encryptSecret } from '@/lib/encrypt'
import { createId, todayKey } from '@/lib/utils'
import type { AccountUpdateInput, EmailAccount, EmailAccountInput } from '@/types/account'
import type { ActivityItem, ActivityType, DashboardStats } from '@/types/activity'

const dataDir = path.join(process.cwd(), 'data')
mkdirSync(dataDir, { recursive: true })

const client = createClient({
  url: `file:${path.join(dataDir, 'hearth.db').replace(/\\/g, '/')}`,
})

let initialized = false

/**
 * Create tables on first use.
 */
export const initDb = async () => {
  if (initialized) {
    return
  }

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      provider TEXT NOT NULL,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL,
      smtp_secure INTEGER NOT NULL,
      imap_host TEXT NOT NULL,
      imap_port INTEGER NOT NULL,
      imap_secure INTEGER NOT NULL,
      password_encrypted TEXT NOT NULL,
      daily_limit INTEGER NOT NULL,
      warmup_enabled INTEGER NOT NULL,
      status TEXT NOT NULL,
      last_error TEXT,
      started_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      type TEXT NOT NULL,
      peer_email TEXT,
      subject TEXT,
      detail TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS warmup_sends (
      id TEXT PRIMARY KEY,
      from_account_id TEXT NOT NULL,
      to_account_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      opened_at TEXT,
      replied_at TEXT,
      rescued INTEGER NOT NULL DEFAULT 0
    );
  `)

  initialized = true
}

type AccountRow = {
  id: string
  email: string
  display_name: string
  provider: EmailAccount['provider']
  smtp_host: string
  smtp_port: number
  smtp_secure: number
  imap_host: string
  imap_port: number
  imap_secure: number
  password_encrypted: string
  daily_limit: number
  warmup_enabled: number
  status: EmailAccount['status']
  last_error: string | null
  started_at: string | null
  created_at: string
}

/**
 * Map a database row to the public account shape.
 */
const mapAccount = (row: AccountRow): EmailAccount => {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    provider: row.provider,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecure: Boolean(row.smtp_secure),
    imapHost: row.imap_host,
    imapPort: row.imap_port,
    imapSecure: Boolean(row.imap_secure),
    dailyLimit: row.daily_limit,
    warmupEnabled: Boolean(row.warmup_enabled),
    status: row.status,
    lastError: row.last_error,
    startedAt: row.started_at,
    createdAt: row.created_at,
  }
}

/**
 * Run a parameterized query against the local database.
 */
const query = async <T>(sql: string, args: InValue[] = []) => {
  await initDb()
  const result = await client.execute({ sql, args })
  return result.rows as unknown as T[]
}

/**
 * List every mailbox, newest first.
 */
export const listAccounts = async () => {
  const rows = await query<AccountRow>(
    'SELECT * FROM accounts ORDER BY created_at DESC',
  )
  return rows.map(mapAccount)
}

/**
 * Load one mailbox by id.
 * @param id - Account id
 */
export const getAccount = async (id: string) => {
  const rows = await query<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id])
  const row = rows[0]
  return row ? mapAccount(row) : null
}

/**
 * Load a mailbox plus its decrypted password. Server-only.
 * @param id - Account id
 */
export const getAccountWithSecret = async (id: string) => {
  const rows = await query<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id])
  const row = rows[0]
  if (!row) {
    return null
  }
  return {
    account: mapAccount(row),
    password: decryptSecret(row.password_encrypted),
  }
}

/**
 * Insert a new mailbox.
 * @param input - Connection details captured from the add-account form
 */
export const createAccount = async (input: EmailAccountInput) => {
  const id = createId()
  const createdAt = new Date().toISOString()
  await query(
    `INSERT INTO accounts (
      id, email, display_name, provider, smtp_host, smtp_port, smtp_secure,
      imap_host, imap_port, imap_secure, password_encrypted, daily_limit,
      warmup_enabled, status, last_error, started_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'warming', NULL, ?, ?)`,
    [
      id,
      input.email.trim().toLowerCase(),
      input.displayName.trim() || input.email.split('@')[0] || 'Inbox',
      input.provider,
      input.smtpHost.trim(),
      input.smtpPort,
      input.smtpSecure ? 1 : 0,
      input.imapHost.trim(),
      input.imapPort,
      input.imapSecure ? 1 : 0,
      encryptSecret(input.password),
      input.dailyLimit,
      createdAt,
      createdAt,
    ],
  )
  const account = await getAccount(id)
  if (!account) {
    throw new Error('Account was created but could not be reloaded')
  }
  return account
}

/**
 * Update mailbox settings or credentials.
 * @param id - Account id
 * @param input - Partial form values
 */
export const updateAccount = async (id: string, input: AccountUpdateInput) => {
  const current = await getAccount(id)
  if (!current) {
    throw new Error('Account not found')
  }

  const secretRow = await query<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id])
  const existing = secretRow[0]
  if (!existing) {
    throw new Error('Account not found')
  }

  const passwordEncrypted = input.password
    ? encryptSecret(input.password)
    : existing.password_encrypted

  await query(
    `UPDATE accounts SET
      display_name = ?,
      provider = ?,
      smtp_host = ?,
      smtp_port = ?,
      smtp_secure = ?,
      imap_host = ?,
      imap_port = ?,
      imap_secure = ?,
      password_encrypted = ?,
      daily_limit = ?,
      warmup_enabled = ?,
      status = ?
    WHERE id = ?`,
    [
      input.displayName ?? current.displayName,
      input.provider ?? current.provider,
      input.smtpHost ?? current.smtpHost,
      input.smtpPort ?? current.smtpPort,
      (input.smtpSecure ?? current.smtpSecure) ? 1 : 0,
      input.imapHost ?? current.imapHost,
      input.imapPort ?? current.imapPort,
      (input.imapSecure ?? current.imapSecure) ? 1 : 0,
      passwordEncrypted,
      input.dailyLimit ?? current.dailyLimit,
      (input.warmupEnabled ?? current.warmupEnabled) ? 1 : 0,
      input.warmupEnabled === false ? 'paused' : current.status === 'paused' && input.warmupEnabled
        ? 'warming'
        : current.status,
      id,
    ],
  )
}

/**
 * Remove a mailbox and its related rows.
 * @param id - Account id
 */
export const deleteAccount = async (id: string) => {
  await query('DELETE FROM warmup_sends WHERE from_account_id = ? OR to_account_id = ?', [id, id])
  await query('DELETE FROM activities WHERE account_id = ?', [id])
  await query('DELETE FROM accounts WHERE id = ?', [id])
}

/**
 * Persist a status and optional error on an account.
 */
export const setAccountStatus = async (
  id: string,
  status: EmailAccount['status'],
  lastError: string | null = null,
) => {
  await query('UPDATE accounts SET status = ?, last_error = ? WHERE id = ?', [
    status,
    lastError,
    id,
  ])
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
  await query(
    `INSERT INTO activities (id, account_id, type, peer_email, subject, detail, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      createId(),
      input.accountId,
      input.type,
      input.peerEmail ?? null,
      input.subject ?? null,
      input.detail ?? null,
      input.status ?? 'ok',
      new Date().toISOString(),
    ],
  )
}

/**
 * Recent activity across all mailboxes.
 * @param limit - Maximum rows to return
 */
export const listActivities = async (limit = 20) => {
  const rows = await query<ActivityItem & {
    account_id: string
    peer_email: string | null
    created_at: string
  }>(
    `SELECT id, account_id, type, peer_email, subject, detail, status, created_at
     FROM activities
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit],
  )

  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    peerEmail: row.peer_email,
    subject: row.subject,
    detail: row.detail,
    status: row.status,
    createdAt: row.created_at,
  }))
}

/**
 * Activity for a single mailbox.
 * @param accountId - Account id
 */
export const listAccountActivities = async (accountId: string, limit = 40) => {
  const rows = await query<{
    id: string
    account_id: string
    type: ActivityItem['type']
    peer_email: string | null
    subject: string | null
    detail: string | null
    status: ActivityItem['status']
    created_at: string
  }>(
    `SELECT id, account_id, type, peer_email, subject, detail, status, created_at
     FROM activities
     WHERE account_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [accountId, limit],
  )

  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    peerEmail: row.peer_email,
    subject: row.subject,
    detail: row.detail,
    status: row.status,
    createdAt: row.created_at,
  }))
}

/**
 * How many warmup messages an account has sent today.
 */
export const countSendsToday = async (accountId: string) => {
  const start = `${todayKey()}T00:00:00.000`
  const rows = await query<{ count: number }>(
    'SELECT COUNT(*) as count FROM warmup_sends WHERE from_account_id = ? AND sent_at >= ?',
    [accountId, start],
  )
  return Number(rows[0]?.count ?? 0)
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
  await query(
    `INSERT INTO warmup_sends (
      id, from_account_id, to_account_id, token, subject, sent_at, opened_at, replied_at, rescued
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0)`,
    [
      createId(),
      input.fromAccountId,
      input.toAccountId,
      input.token,
      input.subject,
      new Date().toISOString(),
    ],
  )
}

/**
 * Find a warmup send by its hidden token.
 */
export const getWarmupSendByToken = async (token: string) => {
  const rows = await query<{
    id: string
    from_account_id: string
    to_account_id: string
    token: string
    subject: string
    opened_at: string | null
    replied_at: string | null
    rescued: number
  }>('SELECT * FROM warmup_sends WHERE token = ?', [token])
  return rows[0] ?? null
}

/**
 * Mark a warmup message as opened, replied, or rescued from spam.
 */
export const markWarmupEvent = async (
  token: string,
  event: 'opened' | 'replied' | 'rescued',
) => {
  if (event === 'rescued') {
    await query('UPDATE warmup_sends SET rescued = 1, opened_at = COALESCE(opened_at, ?) WHERE token = ?', [
      new Date().toISOString(),
      token,
    ])
    return
  }

  const column = event === 'opened' ? 'opened_at' : 'replied_at'
  await query(
    `UPDATE warmup_sends SET ${column} = COALESCE(${column}, ?) WHERE token = ?`,
    [new Date().toISOString(), token],
  )
}

/**
 * Aggregate numbers for the dashboard header.
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  await initDb()
  const start = `${todayKey()}T00:00:00.000`

  const [accounts, warming, sent, totals, rescued] = await Promise.all([
    query<{ count: number }>('SELECT COUNT(*) as count FROM accounts'),
    query<{ count: number }>(
      "SELECT COUNT(*) as count FROM accounts WHERE warmup_enabled = 1 AND status != 'paused'",
    ),
    query<{ count: number }>(
      'SELECT COUNT(*) as count FROM warmup_sends WHERE sent_at >= ?',
      [start],
    ),
    query<{ total: number; opened: number; replied: number }>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN opened_at IS NOT NULL OR rescued = 1 THEN 1 ELSE 0 END) as opened,
         SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) as replied
       FROM warmup_sends`,
    ),
    query<{ count: number }>(
      'SELECT COUNT(*) as count FROM warmup_sends WHERE rescued = 1 AND sent_at >= ?',
      [start],
    ),
  ])

  const total = Number(totals[0]?.total ?? 0)
  const opened = Number(totals[0]?.opened ?? 0)
  const replied = Number(totals[0]?.replied ?? 0)

  return {
    accountCount: Number(accounts[0]?.count ?? 0),
    warmingCount: Number(warming[0]?.count ?? 0),
    sentToday: Number(sent[0]?.count ?? 0),
    inboxPlacement: total === 0 ? 100 : Math.round((opened / total) * 100),
    replyRate: total === 0 ? 0 : Math.round((replied / total) * 100),
    rescuedToday: Number(rescued[0]?.count ?? 0),
  }
}

/**
 * Per-account warmup counters used on cards and detail pages.
 */
export const getAccountStats = async (accountId: string) => {
  const start = `${todayKey()}T00:00:00.000`
  const [sentToday, totals] = await Promise.all([
    query<{ count: number }>(
      'SELECT COUNT(*) as count FROM warmup_sends WHERE from_account_id = ? AND sent_at >= ?',
      [accountId, start],
    ),
    query<{ total: number; opened: number; replied: number; rescued: number }>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN opened_at IS NOT NULL OR rescued = 1 THEN 1 ELSE 0 END) as opened,
         SUM(CASE WHEN replied_at IS NOT NULL THEN 1 ELSE 0 END) as replied,
         SUM(rescued) as rescued
       FROM warmup_sends
       WHERE from_account_id = ?`,
      [accountId],
    ),
  ])

  const total = Number(totals[0]?.total ?? 0)
  const opened = Number(totals[0]?.opened ?? 0)
  const replied = Number(totals[0]?.replied ?? 0)

  return {
    sentToday: Number(sentToday[0]?.count ?? 0),
    totalSent: total,
    inboxPlacement: total === 0 ? 100 : Math.round((opened / total) * 100),
    replyRate: total === 0 ? 0 : Math.round((replied / total) * 100),
    rescued: Number(totals[0]?.rescued ?? 0),
  }
}
