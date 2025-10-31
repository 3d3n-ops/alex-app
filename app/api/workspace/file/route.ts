import { ensureWorkspaceRoot, writeFileInWorkspace, deleteInWorkspace } from '@/lib/workspace'

export const runtime = 'nodejs'

export async function PUT(req: Request) {
  await ensureWorkspaceRoot()
  const body = await req.json().catch(() => ({} as any))
  const path = String(body.path || '')
  const content = String(body.content || '')
  if (!path) return new Response('Missing path', { status: 400 })
  await writeFileInWorkspace(path, content)
  return new Response('OK')
}

export async function DELETE(req: Request) {
  await ensureWorkspaceRoot()
  const url = new URL(req.url)
  const p = url.searchParams.get('path') || ''
  if (!p) return new Response('Missing path', { status: 400 })
  await deleteInWorkspace(p)
  return new Response('OK')
}


