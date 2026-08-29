import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

import { createClient, type Client } from '@libsql/client/web'

import type { EmailAccount } from '@/types/account'
import type { ActivityItem } from '@/types/activity'

export type StoredAccount = EmailAccount & {
  passwordEncrypted: string
}

export type StoredSend = {
  id: string
  fromAccountId: string
  toAccountId: string
  token: string
  subject: string
  sentAt: string
  openedAt: string | null
  repliedAt: string | null
  rescued: boolean
}

export type AppStore = {
  accounts: StoredAccount[]
  activities: ActivityItem[]
  sends: StoredSend[]
  lastTickAt: string | null
}

export type StoreStatus = {
  backend: 'turso' | 'file' | 'memory'
  durable: boolean
  error: string | null
  accountCount: number
}

const emptyStore = (): AppStore => {
  return { accounts: [], activities: [], sends: [], lastTickAt: null }
}

/**
 * Strip quotes that sometimes get pasted into Vercel env values.
 */
const cleanEnv = (value: string | undefined) => {
  return value?.trim().replace(/^['"]+|['"]+$/g, '') ?? ''
}

/**
 * Auth token from TURSO_AUTH_TOKEN or ?authToken= on the database URL.
 */
const tursoToken = () => {
  const direct = cleanEnv(process.env.TURSO_AUTH_TOKEN)
  if (direct) {
    return direct
  }
  const raw = cleanEnv(process.env.TURSO_DATABASE_URL)
  if (!raw) {
    return ''
  }
  try {
    const href = raw.replace(/^libsql:/, 'https:')
    return new URL(href.startsWith('http') ? href : `https://${href}`).searchParams.get('authToken') ?? ''
  } catch {
    return ''
  }
}

/**
 * Turso URL for the official HTTP/web client.
 */
const tursoUrl = () => {
  return cleanEnv(process.env.TURSO_DATABASE_URL).split('?')[0] || ''
}

/**
 * Normalize a partial payload into a full store.
 */
const asStore = (value: unknown): AppStore => {
  if (!value || typeof value !== 'object') {
    return emptyStore()
  }
  const parsed = value as Partial<AppStore>
  return {
    accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    activities: Array.isArray(parsed.activities) ? parsed.activities : [],
    sends: Array.isArray(parsed.sends) ? parsed.sends : [],
    lastTickAt: parsed.lastTickAt ?? null,
  }
}

/**
 * Writable JSON path for local development.
 */
const jsonPath = () => {
  return path.join(process.cwd(), 'data', 'hearth.json')
}

/**
 * Read the local JSON file if it exists.
 */
const readJsonFile = (): AppStore => {
  try {
    const raw = readFileSync(jsonPath(), 'utf8')
    return asStore(JSON.parse(raw) as unknown)
  } catch {
    return emptyStore()
  }
}

/**
 * Persist the store to the local JSON file.
 */
const writeJsonFile = (store: AppStore) => {
  mkdirSync(path.dirname(jsonPath()), { recursive: true })
  writeFileSync(jsonPath(), JSON.stringify(store, null, 2), 'utf8')
}

let client: Client | null = null
let tablesReady = false
let fileCache: AppStore | null = null
let status: StoreStatus = {
  backend: tursoUrl() && tursoToken() ? 'turso' : process.env.VERCEL ? 'memory' : 'file',
  durable: Boolean(tursoUrl() && tursoToken()) || !process.env.VERCEL,
  error: null,
  accountCount: 0,
}

/**
 * HTTP Turso client. Null when env vars are missing.
 */
const getTurso = () => {
  const url = tursoUrl()
  const authToken = tursoToken()
  if (!url || !authToken) {
    return null
  }
  if (!client) {
    client = createClient({ url, authToken })
  }
  return client
}

/**
 * Run a parameterized statement on Turso.
 */
const exec = async (sql: string, args: Array<string | number> = []) => {
  const turso = getTurso()
  if (!turso) {
    throw new Error('Turso is not configured')
  }
  return turso.execute({ sql, args })
}

/**
 * Create mailbox tables once per process.
 */
const ensureTables = async () => {
  if (tablesReady) {
    return
  }
  await exec(`
    CREATE TABLE IF NOT EXISTS hearth_accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      payload TEXT NOT NULL
    )
  `)
  await exec(`
    CREATE TABLE IF NOT EXISTS hearth_activities (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL
    )
  `)
  await exec(`
    CREATE TABLE IF NOT EXISTS hearth_sends (
      id TEXT PRIMARY KEY,
      token TEXT UNIQUE,
      payload TEXT NOT NULL
    )
  `)
  await exec(`
    CREATE TABLE IF NOT EXISTS hearth_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)
  tablesReady = true
}

/**
 * Parse JSON payloads from a Turso text column.
 */
const parseRows = <T>(rows: Array<{ payload?: unknown }>): T[] => {
  return rows.flatMap((row) => {
    if (typeof row.payload !== 'string') {
      return []
    }
    try {
      return [JSON.parse(row.payload) as T]
    } catch {
      return []
    }
  })
}

/**
 * Load every mailbox from Turso.
 */
export const listStoredAccounts = async (): Promise<StoredAccount[]> => {
  const turso = getTurso()
  if (!turso) {
    return (await loadFileStore()).accounts
  }
  await ensureTables()
  const result = await exec('SELECT payload FROM hearth_accounts')
  const accounts = parseRows<StoredAccount>(result.rows as Array<{ payload?: unknown }>)
  status = { backend: 'turso', durable: true, error: null, accountCount: accounts.length }
  return accounts
}

/**
 * Insert or update one mailbox and verify it can be read back.
 */
export const upsertStoredAccount = async (account: StoredAccount) => {
  const turso = getTurso()
  if (!turso) {
    if (process.env.VERCEL) {
      throw new Error(
        'Mailboxes are not saving. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on Vercel.',
      )
    }
    const store = await loadFileStore()
    const index = store.accounts.findIndex((item) => item.id === account.id || item.email === account.email)
    if (index >= 0) {
      store.accounts[index] = account
    } else {
      store.accounts.push(account)
    }
    writeJsonFile(store)
    fileCache = store
    status = { backend: 'file', durable: true, error: null, accountCount: store.accounts.length }
    return
  }

  await ensureTables()
  await exec(
    'INSERT OR REPLACE INTO hearth_accounts (id, email, payload) VALUES (?, ?, ?)',
    [account.id, account.email, JSON.stringify(account)],
  )
  const check = await exec('SELECT payload FROM hearth_accounts WHERE id = ?', [account.id])
  if (check.rows.length === 0) {
    throw new Error('Mailbox write did not persist to Turso')
  }
  const count = await exec('SELECT COUNT(*) as count FROM hearth_accounts')
  status = {
    backend: 'turso',
    durable: true,
    error: null,
    accountCount: Number(count.rows[0]?.count ?? 1),
  }
}

/**
 * Delete one mailbox row.
 */
export const deleteStoredAccount = async (id: string) => {
  const turso = getTurso()
  if (!turso) {
    const store = await loadFileStore()
    store.accounts = store.accounts.filter((account) => account.id !== id)
    writeJsonFile(store)
    fileCache = store
    return
  }
  await ensureTables()
  await exec('DELETE FROM hearth_accounts WHERE id = ?', [id])
}

/**
 * Load recent activity rows.
 */
export const listStoredActivities = async (): Promise<ActivityItem[]> => {
  const turso = getTurso()
  if (!turso) {
    return (await loadFileStore()).activities
  }
  await ensureTables()
  const result = await exec(
    'SELECT payload FROM hearth_activities ORDER BY created_at DESC LIMIT 200',
  )
  return parseRows<ActivityItem>(result.rows as Array<{ payload?: unknown }>)
}

/**
 * Append one activity row.
 */
export const insertStoredActivity = async (item: ActivityItem) => {
  const turso = getTurso()
  if (!turso) {
    const store = await loadFileStore()
    store.activities.unshift(item)
    store.activities = store.activities.slice(0, 200)
    writeJsonFile(store)
    fileCache = store
    return
  }
  await ensureTables()
  await exec(
    'INSERT OR REPLACE INTO hearth_activities (id, created_at, payload) VALUES (?, ?, ?)',
    [item.id, item.createdAt, JSON.stringify(item)],
  )
}

/**
 * Remove activity for a mailbox.
 */
export const deleteStoredActivities = async (accountId: string) => {
  const turso = getTurso()
  if (!turso) {
    const store = await loadFileStore()
    store.activities = store.activities.filter((item) => item.accountId !== accountId)
    writeJsonFile(store)
    fileCache = store
    return
  }
  const items = await listStoredActivities()
  await ensureTables()
  for (const item of items.filter((row) => row.accountId === accountId)) {
    await exec('DELETE FROM hearth_activities WHERE id = ?', [item.id])
  }
}

/**
 * Load warmup send rows.
 */
export const listStoredSends = async (): Promise<StoredSend[]> => {
  const turso = getTurso()
  if (!turso) {
    return (await loadFileStore()).sends
  }
  await ensureTables()
  const result = await exec('SELECT payload FROM hearth_sends')
  return parseRows<StoredSend>(result.rows as Array<{ payload?: unknown }>)
}

/**
 * Insert or update one warmup send.
 */
export const upsertStoredSend = async (send: StoredSend) => {
  const turso = getTurso()
  if (!turso) {
    const store = await loadFileStore()
    const index = store.sends.findIndex((item) => item.id === send.id || item.token === send.token)
    if (index >= 0) {
      store.sends[index] = send
    } else {
      store.sends.push(send)
    }
    writeJsonFile(store)
    fileCache = store
    return
  }
  await ensureTables()
  await exec(
    'INSERT OR REPLACE INTO hearth_sends (id, token, payload) VALUES (?, ?, ?)',
    [send.id, send.token, JSON.stringify(send)],
  )
}

/**
 * Remove sends for a mailbox.
 */
export const deleteStoredSends = async (accountId: string) => {
  const sends = await listStoredSends()
  const turso = getTurso()
  if (!turso) {
    const store = await loadFileStore()
    store.sends = store.sends.filter(
      (send) => send.fromAccountId !== accountId && send.toAccountId !== accountId,
    )
    writeJsonFile(store)
    fileCache = store
    return
  }
  await ensureTables()
  for (const send of sends.filter(
    (item) => item.fromAccountId === accountId || item.toAccountId === accountId,
  )) {
    await exec('DELETE FROM hearth_sends WHERE id = ?', [send.id])
  }
}

/**
 * Read a meta value such as lastTickAt.
 */
export const getMeta = async (key: string) => {
  const turso = getTurso()
  if (!turso) {
    const store = await loadFileStore()
    return key === 'lastTickAt' ? store.lastTickAt : null
  }
  await ensureTables()
  const result = await exec('SELECT value FROM hearth_meta WHERE key = ?', [key])
  const value = result.rows[0]?.value
  return typeof value === 'string' ? value : null
}

/**
 * Write a meta value without touching mailbox rows.
 */
export const setMeta = async (key: string, value: string) => {
  const turso = getTurso()
  if (!turso) {
    const store = await loadFileStore()
    if (key === 'lastTickAt') {
      store.lastTickAt = value
    }
    writeJsonFile(store)
    fileCache = store
    return
  }
  await ensureTables()
  await exec('INSERT OR REPLACE INTO hearth_meta (key, value) VALUES (?, ?)', [key, value])
}

/**
 * Local-file store, used only when Turso is not configured.
 */
const loadFileStore = async (): Promise<AppStore> => {
  if (!fileCache) {
    fileCache = readJsonFile()
  }
  return fileCache
}

/**
 * Compatibility loader used by older helpers.
 */
export const loadStore = async (): Promise<AppStore> => {
  const turso = getTurso()
  if (turso) {
    const [accounts, activities, sends, lastTickAt] = await Promise.all([
      listStoredAccounts(),
      listStoredActivities(),
      listStoredSends(),
      getMeta('lastTickAt'),
    ])
    return { accounts, activities, sends, lastTickAt }
  }
  if (process.env.VERCEL) {
    status = {
      backend: 'memory',
      durable: false,
      error: 'Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN so mailboxes persist.',
      accountCount: 0,
    }
    throw new Error(status.error ?? 'No durable store')
  }
  const store = await loadFileStore()
  status = {
    backend: 'file',
    durable: true,
    error: null,
    accountCount: store.accounts.length,
  }
  return store
}

/**
 * Compatibility saver for the local JSON file.
 */
export const saveStore = async (store: AppStore) => {
  if (getTurso()) {
    for (const account of store.accounts) {
      await upsertStoredAccount(account)
    }
    return
  }
  writeJsonFile(store)
  fileCache = store
}

/**
 * Current persistence backend and mailbox count.
 */
export const getStoreStatus = async () => {
  try {
    const accounts = await listStoredAccounts()
    status = { ...status, accountCount: accounts.length }
  } catch (error) {
    status = {
      ...status,
      error: error instanceof Error ? error.message : 'Store unavailable',
    }
  }
  return status
}

/**
 * True when this host cannot keep mailboxes across restarts.
 */
export const isEphemeralStore = async () => {
  const current = await getStoreStatus()
  return !current.durable
}
