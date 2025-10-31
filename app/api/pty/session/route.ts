import { createPtySession } from '@/lib/pty-manager'
import { auth } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const session = await createPtySession()
  return new Response(JSON.stringify({ sessionId: session.id, token: session.token }), {
    headers: { 'Content-Type': 'application/json' }
  })
}


