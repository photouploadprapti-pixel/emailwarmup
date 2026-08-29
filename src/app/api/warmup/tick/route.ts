export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Cron and manual entry point for one warmup pass on serverless hosts.
 */
export const GET = async (request: Request) => {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const header = request.headers.get('authorization')
    if (header !== `Bearer ${secret}`) {
      return Response.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }
  }

  const { runWarmupTick } = await import('@/lib/warmup-engine')
  await runWarmupTick()
  return Response.json({ ok: true, message: 'Warmup cycle finished.' })
}
