import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'

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
}

type TursoValue = {
  type?: string
  value?: string | null
}

type TursoPipelineResponse = {
  results?: Array<{
    type?: string
    error?: { message?: string }
    response?: {
      result?: {
        rows?: TursoValue[][]
      }
    }
  }>
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
 * Writable JSON path: /tmp on Vercel, ./data locally.
 */
const jsonPath = () => {
  if (process.env.VERCEL) {
    return '/tmp/hearth.json'
  }
  return path.join(process.cwd(), 'data', 'hearth.json')
}

/**
 * Read the JSON file if it exists.
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
 * Persist the store to a writable JSON file.
 */
const writeJsonFile = (store: AppStore) => {
  const filePath = jsonPath()
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(store), 'utf8')
}

/**
 * Convert libsql://host to https://host for the HTTP API.
 */
const tursoHttpUrl = () => {
  const raw = cleanEnv(process.env.TURSO_DATABASE_URL)
  if (!raw) {
    return null
  }
  const withoutProtocol = raw.replace(/^libsql:/, 'https:')
  const href = withoutProtocol.startsWith('https://')
    ? withoutProtocol
    : `https://${withoutProtocol}`
  try {
    const parsed = new URL(href)
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return href.replace(/\/$/, '')
  }
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
 * Run statements against Turso over HTTP so no native client is needed.
 */
const tursoExecute = async (sql: string, args: string[] = []) => {
  const base = tursoHttpUrl()
  const token = tursoToken()
  if (!base || !token) {
    throw new Error('Turso is not configured')
  }

  const response = await fetch(`${base}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          type: 'execute',
          stmt:
            args.length > 0
              ? {
                sql,
                args: args.map((value) => ({ type: 'text', value })),
              }
              : { sql },
        },
        { type: 'close' },
      ],
    }),
  })

  const payload = (await response.json()) as TursoPipelineResponse
  if (!response.ok) {
    throw new Error(`Turso HTTP ${response.status}`)
  }
  const failed = payload.results?.find((item) => item.type === 'error')
  if (failed) {
    throw new Error(failed.error?.message ?? 'Turso query failed')
  }

  return payload
}

/**
 * Read the first column of the first row from a Turso execute result.
 */
const firstCell = (payload: TursoPipelineResponse) => {
  return payload.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value ?? null
}

let cache: AppStore | null = null
let status: StoreStatus = {
  backend: process.env.VERCEL ? 'memory' : 'file',
  durable: !process.env.VERCEL,
  error: null,
}

/**
 * Load the app store from Turso when configured, otherwise from JSON.
 */
export const loadStore = async (): Promise<AppStore> => {
  if (cache) {
    return cache
  }

  if (tursoHttpUrl() && tursoToken()) {
    try {
      await tursoExecute(`
        CREATE TABLE IF NOT EXISTS hearth_store (
          id INTEGER PRIMARY KEY,
          payload TEXT NOT NULL
        )
      `)
      const result = await tursoExecute('SELECT payload FROM hearth_store WHERE id = 1')
      const payload = firstCell(result)
      cache = payload ? asStore(JSON.parse(payload) as unknown) : emptyStore()
      status = { backend: 'turso', durable: true, error: null }
      return cache
    } catch (error) {
      status = {
        backend: process.env.VERCEL ? 'memory' : 'file',
        durable: !process.env.VERCEL,
        error: error instanceof Error ? error.message : 'Turso unavailable',
      }
    }
  } else if (process.env.VERCEL) {
    status = {
      backend: 'memory',
      durable: false,
      error: 'Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN so mailboxes persist.',
    }
  } else {
    status = { backend: 'file', durable: true, error: null }
  }

  cache = readJsonFile()
  return cache
}

/**
 * Write the current store back to Turso or the JSON file.
 */
export const saveStore = async (store: AppStore) => {
  cache = store

  if (tursoHttpUrl() && tursoToken()) {
    try {
      await tursoExecute(
        'INSERT OR REPLACE INTO hearth_store (id, payload) VALUES (1, ?)',
        [JSON.stringify(store)],
      )
      status = { backend: 'turso', durable: true, error: null }
      return
    } catch (error) {
      status = {
        backend: process.env.VERCEL ? 'memory' : 'file',
        durable: !process.env.VERCEL,
        error: error instanceof Error ? error.message : 'Turso save failed',
      }
    }
  }

  try {
    writeJsonFile(store)
    if (status.backend !== 'turso') {
      status = {
        ...status,
        backend: process.env.VERCEL ? 'memory' : 'file',
        durable: !process.env.VERCEL,
      }
    }
  } catch {
    status = {
      backend: 'memory',
      durable: false,
      error: status.error ?? 'Could not write local store',
    }
  }
}

/**
 * Current persistence backend and any store error.
 */
export const getStoreStatus = async () => {
  await loadStore()
  return status
}

/**
 * True when this host cannot keep mailboxes across restarts.
 */
export const isEphemeralStore = async () => {
  const current = await getStoreStatus()
  return !current.durable
}
