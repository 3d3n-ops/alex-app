import { ensureWorkspaceRoot, mkdirInWorkspace } from '@/lib/workspace'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  await ensureWorkspaceRoot()
  const body = await req.json().catch(() => ({} as any))
  const path = String(body.path || '')
  if (!path) return new Response('Missing path', { status: 400 })
  await mkdirInWorkspace(path)
  return new Response('OK')
}


