'use server'

import { revalidatePath } from 'next/cache'

import { runWarmupTick } from '@/lib/warmup-engine'

/**
 * Run one warmup pass immediately, used by the dashboard refresh control.
 */
export const actionRunWarmupTick = async () => {
  await runWarmupTick()
  revalidatePath('/')
  return { ok: true, message: 'Warmup cycle finished.' }
}
