import { differenceInCalendarDays } from 'date-fns'

import {
  addActivity,
  countSendsToday,
  getAccountStats,
  getAccountWithSecret,
  getWarmupSendByToken,
  listAccounts,
  markWarmupEvent,
  recordWarmupSend,
  recordWarmupTick,
  setAccountStatus,
} from '@/lib/db'
import { composeWarmupEmail, composeWarmupReply } from '@/lib/email-templates'
import { engageWarmupMessage, findWarmupMessages } from '@/lib/imap'
import { sendWarmupMail } from '@/lib/smtp'
import { createId, pickRandom } from '@/lib/utils'
import { getDailyQuota, shouldSendThisTick } from '@/lib/warmup-schedule'

const TICK_MS = 2 * 60 * 1000

const globalForWorker = globalThis as unknown as {
  hearthWorkerStarted?: boolean
  hearthTickRunning?: boolean
}

/**
 * Start the background warmup loop once per Node process.
 */
export const startWarmupWorker = () => {
  if (globalForWorker.hearthWorkerStarted) {
    return
  }
  globalForWorker.hearthWorkerStarted = true
  void runWarmupTick()
  setInterval(() => {
    void runWarmupTick()
  }, TICK_MS)
}

/**
 * One worker pass: process inboxes, then send the next warmup emails.
 */
export const runWarmupTick = async () => {
  if (globalForWorker.hearthTickRunning) {
    return
  }

  globalForWorker.hearthTickRunning = true
  try {
    const accounts = await listAccounts()
    await recordWarmupTick()
    const enabled = accounts.filter(
      (account) => account.warmupEnabled && account.status !== 'error',
    )

    for (const account of enabled) {
      try {
        await processInbox(account.id)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Inbox check failed'
        await setAccountStatus(account.id, 'error', message)
        await addActivity({
          accountId: account.id,
          type: 'error',
          detail: message,
          status: 'failed',
        })
      }
    }

    const warming = enabled.filter((account) => account.status !== 'paused')
    if (warming.length < 2) {
      return
    }

    for (const account of warming) {
      try {
        await maybeSendWarmup(account.id, warming.map((item) => item.id))
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Send failed'
        await setAccountStatus(account.id, 'error', message)
        await addActivity({
          accountId: account.id,
          type: 'error',
          detail: message,
          status: 'failed',
        })
      }
    }
  } finally {
    globalForWorker.hearthTickRunning = false
  }
}

/**
 * Open warmup mail, rescue it from spam, and sometimes reply.
 */
const processInbox = async (accountId: string) => {
  const secret = await getAccountWithSecret(accountId)
  if (!secret) {
    return
  }

  const inbound = await findWarmupMessages({
    email: secret.account.email,
    imapHost: secret.account.imapHost,
    imapPort: secret.account.imapPort,
    imapSecure: secret.account.imapSecure,
    password: secret.password,
  })

  for (const message of inbound) {
    const send = await getWarmupSendByToken(message.token)
    if (!send || send.to_account_id !== accountId) {
      continue
    }

    const { rescued } = await engageWarmupMessage(
      {
        email: secret.account.email,
        imapHost: secret.account.imapHost,
        imapPort: secret.account.imapPort,
        imapSecure: secret.account.imapSecure,
        password: secret.password,
      },
      message,
    )

    await markWarmupEvent(message.token, 'opened')
    await addActivity({
      accountId,
      type: 'opened',
      peerEmail: message.from,
      subject: message.subject,
      detail: 'Marked as read',
    })

    if (rescued) {
      await markWarmupEvent(message.token, 'rescued')
      await addActivity({
        accountId,
        type: 'rescued',
        peerEmail: message.from,
        subject: message.subject,
        detail: `Moved out of ${message.mailbox}`,
      })
    }

    const alreadyReplied = Boolean(send.replied_at)
    if (!alreadyReplied && Math.random() < 0.45) {
      const letter = composeWarmupReply(
        secret.account.displayName,
        message.subject,
        message.token,
      )
      const fromSecret = await getAccountWithSecret(send.from_account_id)
      if (fromSecret) {
        await sendWarmupMail(
          {
            email: secret.account.email,
            displayName: secret.account.displayName,
            smtpHost: secret.account.smtpHost,
            smtpPort: secret.account.smtpPort,
            smtpSecure: secret.account.smtpSecure,
            password: secret.password,
          },
          {
            to: fromSecret.account.email,
            subject: letter.subject,
            text: letter.text,
            token: message.token,
          },
        )
        await markWarmupEvent(message.token, 'replied')
        await addActivity({
          accountId,
          type: 'replied',
          peerEmail: fromSecret.account.email,
          subject: letter.subject,
        })
      }
    }
  }

  if (secret.account.status === 'error') {
    await setAccountStatus(accountId, 'warming', null)
  }
}

/**
 * Send at most one warmup email this tick if the daily quota allows it.
 */
const maybeSendWarmup = async (accountId: string, poolIds: string[]) => {
  const secret = await getAccountWithSecret(accountId)
  if (!secret) {
    return
  }

  const quota = getDailyQuota(secret.account.startedAt, secret.account.dailyLimit)
  const sentToday = await countSendsToday(accountId)
  if (sentToday >= quota) {
    return
  }
  if (!shouldSendThisTick()) {
    return
  }

  const peers = poolIds.filter((id) => id !== accountId)
  const peerId = pickRandom(peers)
  const peer = await getAccountWithSecret(peerId)
  if (!peer) {
    return
  }

  const token = createId(16)
  const letter = composeWarmupEmail(secret.account.displayName, token)

  await sendWarmupMail(
    {
      email: secret.account.email,
      displayName: secret.account.displayName,
      smtpHost: secret.account.smtpHost,
      smtpPort: secret.account.smtpPort,
      smtpSecure: secret.account.smtpSecure,
      password: secret.password,
    },
    {
      to: peer.account.email,
      subject: letter.subject,
      text: letter.text,
      token,
    },
  )

  await recordWarmupSend({
    fromAccountId: accountId,
    toAccountId: peer.account.id,
    token,
    subject: letter.subject,
  })
  await addActivity({
    accountId,
    type: 'sent',
    peerEmail: peer.account.email,
    subject: letter.subject,
  })
  await setAccountStatus(accountId, 'warming', null)
}

/**
 * Build the progress model used by account cards and the detail page.
 */
export const getAccountProgress = async (accountId: string) => {
  const accountSecret = await getAccountWithSecret(accountId)
  if (!accountSecret) {
    return null
  }

  const stats = await getAccountStats(accountId)
  const quota = getDailyQuota(
    accountSecret.account.startedAt,
    accountSecret.account.dailyLimit,
  )
  const daysActive = accountSecret.account.startedAt
    ? Math.max(
      1,
      differenceInCalendarDays(new Date(), new Date(accountSecret.account.startedAt)) + 1,
    )
    : 1

  return {
    account: accountSecret.account,
    stats,
    quota,
    daysActive,
  }
}
