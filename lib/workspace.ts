/**
 * Workspace operations - now using thread-scoped storage via API
 * For server-side use (tools), this calls the workspace API
 * For client-side use, use workspace-db.ts directly
 */

const WORKSPACE_API_URL = process.env.WORKSPACE_API_URL || '/api/workspace'

// Server-side workspace operations (used by tools)
export async function readFileInWorkspace(relPath: string, threadId: string): Promise<string> {
  const url = new URL(`${WORKSPACE_API_URL}?threadId=${encodeURIComponent(threadId)}&path=${encodeURIComponent(relPath)}`)
  const res = await fetch(url.toString(), {
    method: 'GET',
  })
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to read file: ${relPath}`)
  }
  
  const data = await res.json()
  return data.content
}

export async function writeFileInWorkspace(relPath: string, content: string, threadId: string): Promise<void> {
  const res = await fetch(WORKSPACE_API_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, path: relPath, content })
  })
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to write file: ${relPath}`)
  }
}

export async function deleteInWorkspace(relPath: string, threadId: string): Promise<void> {
  const url = new URL(`${WORKSPACE_API_URL}?threadId=${encodeURIComponent(threadId)}&path=${encodeURIComponent(relPath)}`)
  const res = await fetch(url.toString(), {
    method: 'DELETE',
  })
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Failed to delete file: ${relPath}`)
  }
}

export async function listFilesInWorkspace(threadId: string, directory?: string): Promise<string[]> {
  const res = await fetch(WORKSPACE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ threadId, directory: directory || '.' })
  })
  
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to list files')
  }
  
  const data = await res.json()
  return data.files || []
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


