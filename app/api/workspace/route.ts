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
    const workspace = getThreadWorkspace(threadId)
    const availableFiles = Array.from(workspace.keys())
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TOOLS === 'true') {
      console.log(`[Workspace API] File not found: ${path}`, {
        threadId: threadId.substring(0, 8) + '...',
        requestedPath: path,
        availableFiles: availableFiles.slice(0, 10),
        totalFiles: availableFiles.length
      })
    }
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
  
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TOOLS === 'true') {
    console.log(`[Workspace API] File written: ${path}`, {
      threadId: threadId.substring(0, 8) + '...',
      path,
      contentLength: content.length
    })
  }
  
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
  
  if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TOOLS === 'true') {
    console.log(`[Workspace API] listFiles request:`, {
      threadId: threadId.substring(0, 8) + '...',
      directory,
      filesFound: files.length,
      files: files.slice(0, 20) // Show first 20
    })
  }
  
  return new Response(JSON.stringify({ files, count: files.length }), {
    headers: { 'Content-Type': 'application/json' }
  })
}

