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

const emptyStore = (): AppStore => {
  return { accounts: [], activities: [], sends: [] }
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
    const parsed = JSON.parse(raw) as Partial<AppStore>
    return {
      accounts: parsed.accounts ?? [],
      activities: parsed.activities ?? [],
      sends: parsed.sends ?? [],
    }
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

let cache: AppStore | null = null
let usingTurso = false

/**
 * Load the app store from Turso when configured, otherwise from JSON.
 */
export const loadStore = async (): Promise<AppStore> => {
  if (cache) {
    return cache
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL
  if (tursoUrl) {
    try {
      const { createClient } = await import('@libsql/client')
      const client = createClient({
        url: tursoUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      })
      await client.execute(`
        CREATE TABLE IF NOT EXISTS hearth_store (
          id INTEGER PRIMARY KEY,
          payload TEXT NOT NULL
        )
      `)
      const result = await client.execute('SELECT payload FROM hearth_store WHERE id = 1')
      const payload = result.rows[0]?.payload
      if (typeof payload === 'string') {
        cache = JSON.parse(payload) as AppStore
      } else {
        cache = emptyStore()
      }
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

  if (usingTurso && process.env.TURSO_DATABASE_URL) {
    try {
      const { createClient } = await import('@libsql/client')
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      })
      await client.execute({
        sql: 'INSERT OR REPLACE INTO hearth_store (id, payload) VALUES (1, ?)',
        args: [JSON.stringify(store)],
      })
      return
    } catch {
      usingTurso = false
    }
  }

  writeJsonFile(store)
}

/**
 * True when this deploy has no durable remote database.
 */
export const isEphemeralStore = () => {
  return Boolean(process.env.VERCEL) && !process.env.TURSO_DATABASE_URL
}
