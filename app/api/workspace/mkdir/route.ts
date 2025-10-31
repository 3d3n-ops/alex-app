import { ensureWorkspaceRoot, mkdirInWorkspace } from '@/lib/workspace'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
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
  if (!path) return new Response('Missing path', { status: 400 })
  await mkdirInWorkspace(path)
  return new Response('OK')
}


