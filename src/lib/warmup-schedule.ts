import { differenceInCalendarDays } from 'date-fns'

import { clamp } from '@/lib/utils'

/**
 * Compute today's send quota from a gentle ramp.
 * Day 1 starts at 4, then grows ~30% each day until dailyLimit.
 * @param startedAt - ISO timestamp when warmup began
 * @param dailyLimit - Maximum emails this mailbox may send per day
 */
export const getDailyQuota = (startedAt: string | null, dailyLimit: number) => {
  if (!startedAt) {
    return Math.min(4, dailyLimit)
  }
  const day = Math.max(1, differenceInCalendarDays(new Date(), new Date(startedAt)) + 1)
  const ramped = Math.round(4 * Math.pow(1.3, day - 1))
  return clamp(ramped, 2, dailyLimit)
}

/**
 * Estimate a 0-100 health score from warmup age and placement stats.
 * @param daysActive - Calendar days since warmup started
 * @param inboxPlacement - Fraction of warmup mail that landed in inbox
 * @param replyRate - Fraction of received warmup mail that was replied to
 */
export const getHealthScore = (
  daysActive: number,
  inboxPlacement: number,
  replyRate: number,
) => {
  const age = clamp(daysActive / 21, 0, 1) * 40
  const inbox = clamp(inboxPlacement, 0, 1) * 40
  const replies = clamp(replyRate, 0, 1) * 20
  return Math.round(age + inbox + replies)
}

/**
 * Decide whether this tick should send another warmup message.
 * Spreads sends through waking hours instead of bursting.
 */
export const shouldSendThisTick = () => {
  const hour = new Date().getHours()
  if (hour < 7 || hour > 21) {
    return Math.random() < 0.08
  }
  return Math.random() < 0.55
}
