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

import { auth } from '@clerk/nextjs/server'
import { 
  getThreadWorkspace,
  readFileFromCache, 
  writeFileToCache, 
  deleteFileFromCache, 
  listFilesFromCache 
} from '@/lib/workspace-cache'

export const runtime = 'nodejs'

// Re-export cache functions for backward compatibility (server-side only)
export { 
  getThreadWorkspace,
  readFileFromCache, 
  writeFileToCache, 
  deleteFileFromCache, 
  listFilesFromCache 
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const url = new URL(req.url)
  const threadId = url.searchParams.get('threadId') || ''
  const path = url.searchParams.get('path') || ''
  
  if (!threadId || !path) {
    return new Response(JSON.stringify({ error: 'Missing threadId or path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  const content = readFileFromCache(threadId, path)
  
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
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

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
  
  writeFileToCache(threadId, path, content)
  
  return new Response(JSON.stringify({ success: true, path }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const url = new URL(req.url)
  const threadId = url.searchParams.get('threadId') || ''
  const path = url.searchParams.get('path') || ''
  
  if (!threadId || !path) {
    return new Response(JSON.stringify({ error: 'Missing threadId or path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })
  }
  
  deleteFileFromCache(threadId, path)
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

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
  
  const files = listFilesFromCache(threadId, directory)
  
  return new Response(JSON.stringify({ files, count: files.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

