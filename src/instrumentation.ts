/**
 * Start the background warmup worker when the Next.js Node server boots.
 */
export const register = async () => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return
  }

  const { startWarmupWorker } = await import('@/lib/warmup-engine')
  startWarmupWorker()
}
