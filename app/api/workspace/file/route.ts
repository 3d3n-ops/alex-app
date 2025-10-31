import { ensureWorkspaceRoot, writeFileInWorkspace, deleteInWorkspace, readFileInWorkspace } from '@/lib/workspace'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  await ensureWorkspaceRoot()
  const url = new URL(req.url)
  const p = url.searchParams.get('path') || ''
  if (!p) return new Response('Missing path', { status: 400 })
  try {
    const content = await readFileInWorkspace(p)
    return new Response(JSON.stringify({ content }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'File not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function PUT(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  await ensureWorkspaceRoot()
  const body = await req.json().catch(() => ({} as any))
  const path = String(body.path || '')
  const content = String(body.content || '')
  if (!path) return new Response('Missing path', { status: 400 })
  await writeFileInWorkspace(path, content)
  return new Response('OK')
}

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  await ensureWorkspaceRoot()
  const url = new URL(req.url)
  const p = url.searchParams.get('path') || ''
  if (!p) return new Response('Missing path', { status: 400 })
  await deleteInWorkspace(p)
  return new Response('OK')
}


