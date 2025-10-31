// PTY API route commented out - node-pty doesn't work in Next.js production builds
// TODO: Re-enable when migrating to self-hosted solution or alternative
// Using SimpleTerminal component instead

/*
import { getPtySession } from '@/lib/pty-manager'
import { spawnPty } from '@/lib/pty-registry'
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

  try {
    const body = await req.json().catch(() => ({} as any))
    const sessionId = String(body.sessionId || '')
    const token = String(body.token || '')
    const cols = Number(body.cols || 80)
    const rows = Number(body.rows || 24)
    const session = getPtySession(sessionId, token)
    if (!session) return new Response('Invalid session', { status: 401 })

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        try {
          const p = spawnPty(sessionId, token, session.cwd, cols, rows)
          const onData = (data: string) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'stdout', data })}\n\n`))
          }
          const onExit = (code: number) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'exit', code })}\n\n`))
            controller.enqueue(encoder.encode(`data: ["DONE"]\n\n`))
            controller.close()
          }
          p.onData(onData)
          p.onExit(({ exitCode }) => onExit(exitCode))
        } catch (err: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: String(err?.message || err) })}\n\n`))
          controller.enqueue(encoder.encode(`data: ["DONE"]\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive'
      }
    })
  } catch (e: any) {
    return new Response(`PTY connect error: ${String(e?.message || e)}`, { status: 500 })
  }
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


