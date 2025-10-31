import Dexie, { type Table } from 'dexie'

export interface FileItem {
  id?: number
  threadId: string // Thread-scoped files
  name: string
  content: string
  language: string
  path: string
  parentId?: number
  isFolder: boolean
  order?: number
  createdAt: number
  updatedAt: number
}

export class CodeEditorDB extends Dexie {
  files!: Table<FileItem>

  constructor() {
    super('CodeEditorDB')
    this.version(1).stores({
      files: '++id, name, path, parentId, isFolder, createdAt, updatedAt',
    })
    this.version(2)
      .stores({
        files: '++id, name, path, parentId, isFolder, order, createdAt, updatedAt',
      })
      .upgrade(async (tx) => {
        const table = tx.table<FileItem>('files')
        const rows = await table.toArray()
        for (const row of rows) {
          if (typeof row.order !== 'number') (row as any).order = 0
          await table.put(row)
        }
      })
    // Version 3: Add threadId for thread-scoped files
    this.version(3)
      .stores({
        files: '++id, threadId, name, path, parentId, isFolder, order, createdAt, updatedAt, [threadId+path]',
      })
      .upgrade(async (tx) => {
        const table = tx.table<FileItem>('files')
        const rows = await table.toArray()
        for (const row of rows) {
          // Set default threadId for existing files (migrate to 'default' thread)
          if (!(row as any).threadId) {
            (row as any).threadId = 'default'
            await table.put(row)
          }
        }
      })
  }
}

export const db = new CodeEditorDB()

