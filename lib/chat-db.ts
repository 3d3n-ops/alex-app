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
  attachments!: Table<ChatAttachmentRow>

  constructor() {
    super('AlexChatDB')
    this.version(2)
      .stores({
        messages: '++id, threadId, role, createdAt',
        attachments: '++id, threadId, type, createdAt'
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

