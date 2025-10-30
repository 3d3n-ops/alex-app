import Dexie, { type Table } from 'dexie'

export interface FileItem {
  id?: number
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
  }
}

export const db = new CodeEditorDB()

