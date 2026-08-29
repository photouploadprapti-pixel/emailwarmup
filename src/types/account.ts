export type AccountProvider = 'gmail' | 'outlook' | 'yahoo' | 'custom'

export type AccountStatus = 'idle' | 'warming' | 'paused' | 'error'

export type EmailAccount = {
  id: string
  email: string
  displayName: string
  provider: AccountProvider
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  imapHost: string
  imapPort: number
  imapSecure: boolean
  dailyLimit: number
  warmupEnabled: boolean
  status: AccountStatus
  lastError: string | null
  startedAt: string | null
  createdAt: string
}

export type EmailAccountInput = {
  email: string
  displayName: string
  password: string
  provider: AccountProvider
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  imapHost: string
  imapPort: number
  imapSecure: boolean
  dailyLimit: number
}

export type AccountUpdateInput = Partial<
  Omit<EmailAccountInput, 'email' | 'password'>
> & {
  password?: string
  warmupEnabled?: boolean
}
