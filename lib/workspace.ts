/**
 * Workspace operations - using thread-scoped storage
 * For server-side use (tools), directly accesses the workspace cache
 * For client-side use, use workspace-db.ts directly
 */

// Server-side workspace operations (used by tools) - direct cache access
import { 
  readFileFromCache, 
  writeFileToCache, 
  deleteFileFromCache, 
  listFilesFromCache 
} from '@/lib/workspace-cache'

export async function readFileInWorkspace(relPath: string, threadId: string): Promise<string> {
  const content = readFileFromCache(threadId, relPath)
  
  if (content === undefined) {
    throw new Error(`File not found: ${relPath}`)
  }
  
  return content
}

export async function writeFileInWorkspace(relPath: string, content: string, threadId: string): Promise<void> {
  writeFileToCache(threadId, relPath, content)
  
  // Log the write for debugging
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TOOLS === 'true') {
    console.log(`[Workspace] File written to cache: ${relPath}`, {
      threadId: threadId.substring(0, 8) + '...',
      path: relPath,
      contentLength: content.length
    })
  }
}

export async function deleteInWorkspace(relPath: string, threadId: string): Promise<void> {
  deleteFileFromCache(threadId, relPath)
}

export async function listFilesInWorkspace(threadId: string, directory?: string): Promise<string[]> {
  return listFilesFromCache(threadId, directory)
}

// Legacy functions for backwards compatibility (will be removed)
export async function ensureWorkspaceRoot(): Promise<string> {
  return '.workspace'
}

export function resolveWorkspacePath(rel: string): string {
  return rel.replace(/^\/+/, '')
}

export async function mkdirInWorkspace(relPath: string) {
  // No-op for API-based workspace
}

export async function moveInWorkspace(fromRel: string, toRel: string, threadId: string) {
  // Read, write, delete
  const content = await readFileInWorkspace(fromRel, threadId)
  await writeFileInWorkspace(toRel, content, threadId)
  await deleteInWorkspace(fromRel, threadId)
}


