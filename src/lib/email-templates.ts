import { pickRandom } from '@/lib/utils'

export type WarmupLetter = {
  subject: string
  text: string
}

const OPENERS: WarmupLetter[] = [
  {
    subject: 'Quick check-in',
    text: 'Hey — just circling back on this. Does later this week still work on your side?',
  },
  {
    subject: 'Thought of this',
    text: 'Saw something this morning that reminded me of our last note. Wanted to send it over while it was fresh.',
  },
  {
    subject: 'Following up',
    text: 'Hope your week is going well. I had a few minutes and wanted to keep this thread moving.',
  },
  {
    subject: 'Tiny update',
    text: 'Nothing urgent — just a short update so this does not sit unread in your pile.',
  },
  {
    subject: 'Are you free Thursday?',
    text: 'I have a window Thursday afternoon if you want to compare notes. Totally fine if next week is better.',
  },
  {
    subject: 'The notes from yesterday',
    text: 'I cleaned up the notes from yesterday and wanted you to have a copy. Let me know if I missed anything.',
  },
  {
    subject: 'One more thought',
    text: 'One more thought before I close my laptop. I think the simpler version is the right call here.',
  },
  {
    subject: 'Checking the time',
    text: 'Wanted to confirm we are still aligned on timing. I can shift if you need more room.',
  },
  {
    subject: 'This made me laugh',
    text: 'This is not important, but it made me laugh and I figured you would get it immediately.',
  },
  {
    subject: 'Ready when you are',
    text: 'I am ready on my end whenever you are. No rush — just did not want you waiting on me.',
  },
  {
    subject: 'Can you glance at this?',
    text: 'When you have a spare minute, can you glance at this and tell me if it feels right?',
  },
  {
    subject: 'Monday plan',
    text: 'I sketched a light plan for Monday. Happy to adjust once you have had coffee.',
  },
]

const REPLIES: WarmupLetter[] = [
  {
    subject: 'Re: {subject}',
    text: 'Got this — thanks. I will take a proper look this afternoon and write back.',
  },
  {
    subject: 'Re: {subject}',
    text: 'Yes, that works for me. Appreciate you sending it over.',
  },
  {
    subject: 'Re: {subject}',
    text: 'Read this on my phone. Makes sense. I am good with the simpler version.',
  },
  {
    subject: 'Re: {subject}',
    text: 'Thanks for the nudge. I had this buried. I am free Thursday if you still are.',
  },
  {
    subject: 'Re: {subject}',
    text: 'Perfect timing. I was just about to write you. Let us keep this thread going.',
  },
]

const SIGN_OFFS = [
  'Talk soon',
  'Thanks',
  'More soon',
  'Appreciate it',
  'Catch you later',
]

/**
 * Build a natural-looking warmup email body.
 * @param fromName - Display name of the sender
 * @param token - Hidden warmup token used for IMAP matching
 */
export const composeWarmupEmail = (fromName: string, token: string): WarmupLetter => {
  const letter = pickRandom(OPENERS)
  const signOff = pickRandom(SIGN_OFFS)
  const text = `${letter.text}\n\n${signOff},\n${fromName}\n\n--\nref:${token}`
  return { subject: letter.subject, text }
}

/**
 * Build a short reply to a warmup thread.
 * @param fromName - Display name of the person replying
 * @param originalSubject - Subject of the inbound warmup mail
 * @param token - Hidden warmup token used for IMAP matching
 */
export const composeWarmupReply = (
  fromName: string,
  originalSubject: string,
  token: string,
): WarmupLetter => {
  const letter = pickRandom(REPLIES)
  const signOff = pickRandom(SIGN_OFFS)
  const subject = letter.subject.replace('{subject}', originalSubject.replace(/^re:\s*/i, ''))
  const text = `${letter.text}\n\n${signOff},\n${fromName}\n\n--\nref:${token}`
  return { subject, text }
}

/**
 * Extract a warmup token from a message body if present.
 * @param text - Plain-text email body
 */
export const extractWarmupToken = (text: string) => {
  const match = text.match(/ref:([a-f0-9]{16,})/i)
  return match?.[1] ?? null
}
