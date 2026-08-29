import type { AccountProvider } from '@/types/account'

export type ProviderPreset = {
  id: AccountProvider
  label: string
  hint: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  imapHost: string
  imapPort: number
  imapSecure: boolean
}

/**
 * Built-in SMTP/IMAP presets for common mailbox providers.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'gmail',
    label: 'Gmail',
    hint: 'Use a Google App Password, not your normal password.',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapSecure: true,
  },
  {
    id: 'outlook',
    label: 'Outlook',
    hint: 'Works with Outlook, Hotmail, and Microsoft 365.',
    smtpHost: 'smtp.office365.com',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapSecure: true,
  },
  {
    id: 'yahoo',
    label: 'Yahoo',
    hint: 'Generate an app password in Yahoo account security.',
    smtpHost: 'smtp.mail.yahoo.com',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapSecure: true,
  },
  {
    id: 'custom',
    label: 'Custom',
    hint: 'Enter SMTP and IMAP settings from your host.',
    smtpHost: '',
    smtpPort: 587,
    smtpSecure: false,
    imapHost: '',
    imapPort: 993,
    imapSecure: true,
  },
]

/**
 * Find a provider preset by id.
 * @param id - Provider identifier
 */
export const getProviderPreset = (id: AccountProvider) => {
  const preset = PROVIDER_PRESETS.find((item) => item.id === id)
  if (!preset) {
    throw new Error(`Unknown provider: ${id}`)
  }
  return preset
}
