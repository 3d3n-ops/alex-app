import { newThreadId, signThreadId } from '@/lib/thread'
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

  const id = newThreadId()
  const sig = signThreadId(id)
  return Response.json({ id, sig })
}

