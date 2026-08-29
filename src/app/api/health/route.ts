export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Lightweight deploy check that does not touch the database.
 */
export const GET = async () => {
  return Response.json({ ok: true })
}
