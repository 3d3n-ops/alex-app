import { getPtySession } from '@/lib/pty-manager'
import { writePty } from '@/lib/pty-registry'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any))
  const sessionId = String(body.sessionId || '')
  const token = String(body.token || '')
  const data = String(body.data || '')
  const session = getPtySession(sessionId, token)
  if (!session) return new Response('Invalid session', { status: 401 })
  writePty(sessionId, token, data)
  return new Response('OK')
}


