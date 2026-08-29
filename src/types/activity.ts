export type ActivityType =
  | 'sent'
  | 'received'
  | 'replied'
  | 'opened'
  | 'rescued'
  | 'error'
  | 'connected'

export type ActivityStatus = 'ok' | 'failed'

export type ActivityItem = {
  id: string
  accountId: string
  type: ActivityType
  peerEmail: string | null
  subject: string | null
  detail: string | null
  status: ActivityStatus
  createdAt: string
}

export type DashboardStats = {
  accountCount: number
  warmingCount: number
  sentToday: number
  inboxPlacement: number
  replyRate: number
  rescuedToday: number
}
