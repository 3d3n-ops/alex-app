import { createPtySession } from '@/lib/pty-manager'

export const runtime = 'nodejs'

export async function POST() {
  const session = await createPtySession()
  return new Response(JSON.stringify({ sessionId: session.id, token: session.token }), {
    headers: { 'Content-Type': 'application/json' }
  })
}


