import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

/**
 * Resolve a 32-byte key from ENCRYPTION_KEY, or a stable project-based fallback.
 */
const getKey = () => {
  const hex = process.env.ENCRYPTION_KEY
  if (hex && hex.length === 64) {
    return Buffer.from(hex, 'hex')
  }

  const seed =
    process.env.VERCEL_PROJECT_ID ??
    process.env.VERCEL_URL ??
    'hearth-local-dev-key'
  return createHash('sha256').update(`hearth:${seed}`).digest()
}

/**
 * Encrypt a mailbox password for storage.
 * @param plaintext - The raw password or app password
 */
export const encryptSecret = (plaintext: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypt a stored mailbox password.
 * @param payload - The iv:tag:ciphertext string produced by encryptSecret
 */
export const decryptSecret = (payload: string) => {
  const [ivHex, tagHex, dataHex] = payload.split(':')
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Stored secret is malformed')
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}
