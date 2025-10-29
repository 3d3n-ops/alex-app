import Dexie, { type Table } from 'dexie'

export interface FileItem {
  id?: number
  name: string
  content: string
  language: string
  path: string
  parentId?: number
  isFolder: boolean
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
  }
}

export const db = new CodeEditorDB()

