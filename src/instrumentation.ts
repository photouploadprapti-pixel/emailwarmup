/**
 * Start the background warmup worker on long-lived Node hosts.
 * Vercel uses /api/warmup/tick plus cron instead of a process interval.
 */
export const register = async () => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return
  }
  if (process.env.VERCEL) {
    return
  }

  const { startWarmupWorker } = await import('@/lib/warmup-engine')
  startWarmupWorker()
}
