import Dexie, { type Table } from 'dexie'

export interface WorkspaceFile {
  id?: number
  threadId: string
  path: string // Relative path from workspace root (e.g., "main.py" or "src/utils.ts")
  content: string
  createdAt: number
  updatedAt: number
}

export class WorkspaceDB extends Dexie {
  files!: Table<WorkspaceFile>

  constructor() {
    super('WorkspaceDB')
    this.version(1).stores({
      files: '++id, threadId, path, createdAt, updatedAt'
    })
    
    // Create compound index for faster lookups by threadId + path
    this.version(2).stores({
      files: '++id, threadId, path, createdAt, updatedAt, [threadId+path]'
    })
  }
}

export const workspaceDb = new WorkspaceDB()

/**
 * Client-side workspace operations using IndexedDB
 */
export class ClientWorkspace {
  constructor(private threadId: string) {}

  async readFile(relPath: string): Promise<string> {
    const file = await workspaceDb.files
      .where('[threadId+path]')
      .equals([this.threadId, relPath])
      .first()
    
    if (!file) {
      throw new Error(`File not found: ${relPath}`)
    }
    return file.content
  }

  async writeFile(relPath: string, content: string): Promise<void> {
    const existing = await workspaceDb.files
      .where('[threadId+path]')
      .equals([this.threadId, relPath])
      .first()
    
    const now = Date.now()
    if (existing) {
      await workspaceDb.files.update(existing.id!, {
        content,
        updatedAt: now
      })
    } else {
      await workspaceDb.files.add({
        threadId: this.threadId,
        path: relPath,
        content,
        createdAt: now,
        updatedAt: now
      })
    }
  }

  async deleteFile(relPath: string): Promise<void> {
    const file = await workspaceDb.files
      .where('[threadId+path]')
      .equals([this.threadId, relPath])
      .first()
    
    if (file) {
      await workspaceDb.files.delete(file.id!)
    }
  }

  async listFiles(directory?: string): Promise<string[]> {
    let files = await workspaceDb.files
      .where('threadId')
      .equals(this.threadId)
      .toArray()
    
    // Filter by directory if specified
    if (directory) {
      const dirPath = directory.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
      files = files.filter(f => f.path.startsWith(dirPath))
    }
    
    return files.map(f => f.path).sort()
  }

  async fileExists(relPath: string): Promise<boolean> {
    const file = await workspaceDb.files
      .where('[threadId+path]')
      .equals([this.threadId, relPath])
      .first()
    return !!file
  }
}

