/**
 * Workspace API - handles workspace file operations scoped by threadId
 * This API acts as a bridge between server-side tools and client-side IndexedDB
 * 
 * Flow:
 * 1. Tools read/write → API (in-memory cache)
 * 2. On thread load → IndexedDB syncs to server cache (via useWorkspaceSync)
 * 3. On file write → Server cache stores, client should sync to IndexedDB
 * 
 * The server cache is a temporary bridge - IndexedDB is the source of truth for persistence
 */

export const runtime = 'nodejs'

// In-memory cache for server-side tool access
// This is populated from IndexedDB when threads load and serves as a bridge
// for tools running server-side to access client-side IndexedDB data
const workspaceCache = new Map<string, Map<string, string>>() // threadId -> (path -> content)

function getThreadWorkspace(threadId: string): Map<string, string> {
  if (!workspaceCache.has(threadId)) {
    workspaceCache.set(threadId, new Map())
  }
  return workspaceCache.get(threadId)!
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const threadId = url.searchParams.get('threadId') || ''
  const path = url.searchParams.get('path') || ''
  
  if (!threadId || !path) {
    return new Response(JSON.stringify({ error: 'Missing threadId or path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  const workspace = getThreadWorkspace(threadId)
  const content = workspace.get(path)
  
  if (content === undefined) {
    return new Response(JSON.stringify({ error: 'File not found', content: null }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  return new Response(JSON.stringify({ content, path }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}))
  const threadId = String(body.threadId || '')
  const path = String(body.path || '')
  const content = String(body.content || '')
  
  if (!threadId || !path) {
    return new Response(JSON.stringify({ error: 'Missing threadId or path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  const workspace = getThreadWorkspace(threadId)
  workspace.set(path, content)
  
  return new Response(JSON.stringify({ success: true, path }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function DELETE(req: Request) {
  const url = new URL(req.url)
  const threadId = url.searchParams.get('threadId') || ''
  const path = url.searchParams.get('path') || ''
  
  if (!threadId || !path) {
    return new Response(JSON.stringify({ error: 'Missing threadId or path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  const workspace = getThreadWorkspace(threadId)
  workspace.delete(path)
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function POST(req: Request) {
  // List files
  const body = await req.json().catch(() => ({}))
  const threadId = String(body.threadId || '')
  const directory = String(body.directory || '.')
  
  if (!threadId) {
    return new Response(JSON.stringify({ error: 'Missing threadId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  const workspace = getThreadWorkspace(threadId)
  let files = Array.from(workspace.keys())
  
  // Filter by directory if specified
  if (directory !== '.' && directory !== '') {
    const dirPath = directory.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
    files = files.filter(f => f.startsWith(dirPath))
  }
  
  return new Response(JSON.stringify({ files, count: files.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

