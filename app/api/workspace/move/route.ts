import { ensureWorkspaceRoot, moveInWorkspace } from '@/lib/workspace'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  await ensureWorkspaceRoot()
  const body = await req.json().catch(() => ({} as any))
  const from = String(body.from || '')
  const to = String(body.to || '')
  if (!from || !to) return new Response('Missing from/to', { status: 400 })
  await moveInWorkspace(from, to)
  return new Response('OK')
}


