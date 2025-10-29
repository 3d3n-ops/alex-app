import { newThreadId, signThreadId } from '@/lib/thread'

export const runtime = 'nodejs'

export async function POST() {
  const id = newThreadId()
  const sig = signThreadId(id)
  return Response.json({ id, sig })
}

