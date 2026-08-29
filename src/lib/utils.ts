import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind class names while resolving conflicts.
 * @param inputs - Class values accepted by clsx
 */
export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs))
}

/**
 * Create a random URL-safe identifier.
 * @param size - Number of random bytes before encoding
 */
export const createId = (size = 12) => {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Return today's date key in YYYY-MM-DD (local time).
 */
export const todayKey = () => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Clamp a number between min and max.
 */
export const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value))
}

/**
 * Pick a random item from a non-empty array.
 */
export const pickRandom = <T>(items: T[]): T => {
  const index = Math.floor(Math.random() * items.length)
  return items[index] as T
}

/**
 * Sleep for the given milliseconds.
 */
export const sleep = (ms: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}
