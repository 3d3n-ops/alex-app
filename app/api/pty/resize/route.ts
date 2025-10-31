import { getPtySession } from '@/lib/pty-manager'
import { resizePty } from '@/lib/pty-registry'
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

  const body = await req.json().catch(() => ({} as any))
  const sessionId = String(body.sessionId || '')
  const token = String(body.token || '')
  const cols = Number(body.cols || 80)
  const rows = Number(body.rows || 24)
  const session = getPtySession(sessionId, token)
  if (!session) return new Response('Invalid session', { status: 401 })
  resizePty(sessionId, token, cols, rows)
  return new Response('OK')
}


