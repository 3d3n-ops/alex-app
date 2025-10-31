// PTY API route commented out - node-pty doesn't work in Next.js production builds
// TODO: Re-enable when migrating to self-hosted solution or alternative
// Using SimpleTerminal component instead

/*
import { getPtySession } from '@/lib/pty-manager'
import { writePty } from '@/lib/pty-registry'
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
  const data = String(body.data || '')
  const session = getPtySession(sessionId, token)
  if (!session) return new Response('Invalid session', { status: 401 })
  writePty(sessionId, token, data)
  return new Response('OK')
}
*/

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

  // PTY is disabled - return error
  return new Response(JSON.stringify({ 
    error: 'PTY is disabled. Please use SimpleTerminal component instead.',
    message: 'This endpoint is temporarily disabled due to build compatibility issues with node-pty.'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  })
}
