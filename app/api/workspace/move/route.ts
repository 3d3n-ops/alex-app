import { ensureWorkspaceRoot, moveInWorkspace } from '@/lib/workspace'
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
  const from = String(body.from || '')
  const to = String(body.to || '')
  if (!from || !to) return new Response('Missing from/to', { status: 400 })
  await moveInWorkspace(from, to)
  return new Response('OK')
}


