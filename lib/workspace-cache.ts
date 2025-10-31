/**
 * Server-only workspace cache utilities
 * These functions provide in-memory cache access for server-side tools
 * Client components should use the /api/workspace endpoints instead
 * 
 * Note: This file should only be imported by server-side code (API routes, server components, tools)
 */

// In-memory cache for server-side tool access
// This is populated from IndexedDB when threads load and serves as a bridge
// for tools running server-side to access client-side IndexedDB data
const workspaceCache = new Map<string, Map<string, string>>() // threadId -> (path -> content)

export function getThreadWorkspace(threadId: string): Map<string, string> {
  if (!workspaceCache.has(threadId)) {
    workspaceCache.set(threadId, new Map())
  }
  return workspaceCache.get(threadId)!
}

// Export direct cache access functions for server-side use (tools)
export function readFileFromCache(threadId: string, path: string): string | undefined {
  const workspace = getThreadWorkspace(threadId)
  return workspace.get(path)
}

export function writeFileToCache(threadId: string, path: string, content: string): void {
  const workspace = getThreadWorkspace(threadId)
  workspace.set(path, content)
}

export function deleteFileFromCache(threadId: string, path: string): void {
  const workspace = getThreadWorkspace(threadId)
  workspace.delete(path)
}

export function listFilesFromCache(threadId: string, directory?: string): string[] {
  const workspace = getThreadWorkspace(threadId)
  let files = Array.from(workspace.keys())
  
  // Filter by directory if specified
  if (directory && directory !== '.' && directory !== '') {
    const dirPath = directory.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
    files = files.filter(f => f.startsWith(dirPath))
  }
  
  return files
}

