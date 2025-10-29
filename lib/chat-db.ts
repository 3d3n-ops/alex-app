import Dexie, { type Table } from 'dexie'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessageRow {
  id?: number
  threadId: string
  role: ChatRole
  content: string
  createdAt: number
}

export class ChatDB extends Dexie {
  messages!: Table<ChatMessageRow>

  constructor() {
    super('AlexChatDB')
    this.version(1).stores({
      messages: '++id, threadId, role, createdAt'
    })
  }
}

export const chatDb = new ChatDB()

