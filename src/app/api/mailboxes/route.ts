import { getPersistenceStatus, listAccounts } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Public mailbox count used to confirm saves without exposing passwords.
 */
export const GET = async () => {
  try {
    const [accounts, persistence] = await Promise.all([
      listAccounts(),
      getPersistenceStatus(),
    ])
    return Response.json({
      ok: true,
      count: accounts.length,
      emails: accounts.map((account) => account.email),
      persistence,
    })
  } catch (error) {
    return Response.json({
      ok: false,
      count: 0,
      emails: [],
      message: error instanceof Error ? error.message : 'Store unavailable',
    }, { status: 500 })
  }
}
