import { ImapFlow } from 'imapflow'

import { extractWarmupToken } from '@/lib/email-templates'
import type { EmailAccount } from '@/types/account'

export type ImapAccount = Pick<
  EmailAccount,
  'email' | 'imapHost' | 'imapPort' | 'imapSecure'
> & {
  password: string
}

export type InboundWarmup = {
  uid: number
  mailbox: string
  token: string
  from: string
  subject: string
}

const SPAM_FOLDERS = ['Junk', 'Spam', 'Junk Email', '[Gmail]/Spam']

/**
 * Open an IMAP session for one mailbox.
 */
const connect = async (account: ImapAccount) => {
  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure || account.imapPort === 993,
    auth: {
      user: account.email,
      pass: account.password,
    },
    logger: false,
  })
  await client.connect()
  return client
}

/**
 * Verify IMAP credentials by connecting and logging out.
 */
export const verifyImap = async (account: ImapAccount) => {
  const client = await connect(account)
  await client.logout()
}

/**
 * Collect warmup messages from inbox and common spam folders.
 */
export const findWarmupMessages = async (account: ImapAccount) => {
  const client = await connect(account)
  const found: InboundWarmup[] = []
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const folders = ['INBOX', ...SPAM_FOLDERS]

  try {
    for (const folder of folders) {
      try {
        await client.mailboxOpen(folder)
      } catch {
        continue
      }

      const uids = await client.search({ since }, { uid: true })
      if (!uids || uids.length === 0) {
        continue
      }

      const recent = uids.slice(-40)
      const messages = await client.fetchAll(
        recent,
        { source: true, envelope: true },
        { uid: true },
      )

      for (const message of messages) {
        const source = message.source?.toString('utf8') ?? ''
        const headerMatch = source.match(/X-Hearth-Warmup:\s*([a-f0-9]+)/i)
        const token = headerMatch?.[1] ?? extractWarmupToken(source)
        if (!token) {
          continue
        }

        found.push({
          uid: message.uid,
          mailbox: folder,
          token,
          from: message.envelope?.from?.[0]?.address ?? 'unknown',
          subject: message.envelope?.subject ?? '(no subject)',
        })
      }
    }
  } finally {
    if (client.usable) {
      await client.logout()
    }
  }

  return found
}

/**
 * Mark a message seen, optionally star it, and move it to the inbox if needed.
 */
export const engageWarmupMessage = async (
  account: ImapAccount,
  inbound: InboundWarmup,
) => {
  const client = await connect(account)
  let rescued = inbound.mailbox !== 'INBOX'

  try {
    await client.mailboxOpen(inbound.mailbox)
    await client.messageFlagsAdd(inbound.uid, ['\\Seen'], { uid: true })

    if (Math.random() < 0.35) {
      await client.messageFlagsAdd(inbound.uid, ['\\Flagged'], { uid: true })
    }

    if (rescued) {
      try {
        await client.messageMove(inbound.uid, 'INBOX', { uid: true })
      } catch {
        rescued = false
      }
    }
  } finally {
    if (client.usable) {
      await client.logout()
    }
  }

  return { rescued }
}
