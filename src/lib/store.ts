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
}

type TursoValue = {
  type?: string
  value?: string | null
}

type TursoPipelineResponse = {
  results?: Array<{
    type?: string
    response?: {
      result?: {
        rows?: TursoValue[][]
      }
    }
  }>
}

const emptyStore = (): AppStore => {
  return { accounts: [], activities: [], sends: [] }
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
  const raw = process.env.TURSO_DATABASE_URL?.trim()
  if (!raw) {
    return null
  }
  const withoutProtocol = raw.replace(/^libsql:/, 'https:').replace(/\/$/, '')
  if (!withoutProtocol.startsWith('https://')) {
    return `https://${withoutProtocol}`
  }
  return withoutProtocol
}

/**
 * Run statements against Turso over HTTP so no native client is needed.
 */
const tursoExecute = async (sql: string, args: string[] = []) => {
  const base = tursoHttpUrl()
  const token = process.env.TURSO_AUTH_TOKEN
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

  if (!response.ok) {
    throw new Error(`Turso HTTP ${response.status}`)
  }

  return (await response.json()) as TursoPipelineResponse
}

/**
 * Read the first column of the first row from a Turso execute result.
 */
const firstCell = (payload: TursoPipelineResponse) => {
  return payload.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value ?? null
}

let cache: AppStore | null = null
let usingTurso = false

/**
 * Load the app store from Turso when configured, otherwise from JSON.
 */
export const loadStore = async (): Promise<AppStore> => {
  if (cache) {
    return cache
  }

  if (tursoHttpUrl() && process.env.TURSO_AUTH_TOKEN) {
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
      usingTurso = true
      return cache
    } catch {
      usingTurso = false
    }
  }

  cache = readJsonFile()
  return cache
}

/**
 * Write the current store back to Turso or the JSON file.
 */
export const saveStore = async (store: AppStore) => {
  cache = store

  if (usingTurso && tursoHttpUrl() && process.env.TURSO_AUTH_TOKEN) {
    try {
      await tursoExecute(
        'INSERT OR REPLACE INTO hearth_store (id, payload) VALUES (1, ?)',
        [JSON.stringify(store)],
      )
      return
    } catch {
      usingTurso = false
    }
  }

  try {
    writeJsonFile(store)
  } catch {
    // Serverless disks can be ephemeral; keep the in-memory cache either way.
  }
}

/**
 * True when this deploy has no durable remote database.
 */
export const isEphemeralStore = () => {
  return Boolean(process.env.VERCEL) && !tursoHttpUrl()
}
