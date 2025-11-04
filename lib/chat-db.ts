import Dexie, { type Table } from 'dexie'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessageRow {
  id?: number
  threadId: string
  role: ChatRole
  content: string
  createdAt: number
}

export interface ChatThreadRow {
  id?: number
  threadId: string
  title: string
  createdAt: number
  updatedAt: number
}

export class ChatDB extends Dexie {
  messages!: Table<ChatMessageRow>
  attachments!: Table<ChatAttachmentRow>
  threads!: Table<ChatThreadRow>
  streak!: Table<StreakRow>

  constructor() {
    super('AlexChatDB')
    this.version(3)
      .stores({
        messages: '++id, threadId, role, createdAt',
        attachments: '++id, threadId, type, createdAt',
        threads: '++id, threadId, createdAt, updatedAt'
      })
      .upgrade((trans) => {
        // Migration logic will run automatically for existing databases
      })
    this.version(4)
      .stores({
        messages: '++id, threadId, role, createdAt',
        attachments: '++id, threadId, type, createdAt',
        threads: '++id, threadId, createdAt, updatedAt',
        streak: '++id, date, lastActiveDate, currentStreak, longestStreak, createdAt, updatedAt'
      })
      .upgrade(async (trans) => {
        // Initialize streak data if it doesn't exist
        const streakTable = trans.table<StreakRow>('streak')
        const existing = await streakTable.toArray()
        if (existing.length === 0) {
          const today = new Date().toISOString().split('T')[0]
          await streakTable.add({
            date: today,
            lastActiveDate: Date.now(),
            currentStreak: 0,
            longestStreak: 0,
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
        }
      })
  }
}

export const chatDb = new ChatDB()

export type AttachmentType = 'file' | 'image'

export interface ChatAttachmentRow {
  id?: number
  threadId: string
  type: AttachmentType
  name: string
  mimeType: string
  contentBase64: string
  createdAt: number
}

export interface StreakRow {
  id?: number
  date: string // YYYY-MM-DD format
  lastActiveDate: number // timestamp
  currentStreak: number
  longestStreak: number
  createdAt: number
  updatedAt: number
}

