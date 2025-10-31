import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const WORKSPACE_ROOT = path.join(ROOT, '.workspace')

export async function ensureWorkspaceRoot(): Promise<string> {
  await fs.mkdir(WORKSPACE_ROOT, { recursive: true })
  return WORKSPACE_ROOT
}

export function resolveWorkspacePath(rel: string): string {
  const safeRel = rel.replace(/^\/+/, '')
  const abs = path.join(WORKSPACE_ROOT, safeRel)
  const normalized = path.normalize(abs)
  if (!normalized.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Path escapes workspace root')
  }
  return normalized
}

export async function writeFileInWorkspace(relPath: string, content: string) {
  const abs = resolveWorkspacePath(relPath)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, content, 'utf8')
}

export async function mkdirInWorkspace(relPath: string) {
  const abs = resolveWorkspacePath(relPath)
  await fs.mkdir(abs, { recursive: true })
}

export async function deleteInWorkspace(relPath: string) {
  const abs = resolveWorkspacePath(relPath)
  await fs.rm(abs, { recursive: true, force: true })
}

export async function moveInWorkspace(fromRel: string, toRel: string) {
  const fromAbs = resolveWorkspacePath(fromRel)
  const toAbs = resolveWorkspacePath(toRel)
  await fs.mkdir(path.dirname(toAbs), { recursive: true })
  await fs.rename(fromAbs, toAbs)
}

export async function readFileInWorkspace(relPath: string): Promise<string> {
  const abs = resolveWorkspacePath(relPath)
  return await fs.readFile(abs, 'utf8')
}


