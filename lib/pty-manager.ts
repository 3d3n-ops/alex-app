import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { ensureWorkspaceRoot } from './workspace'

export type PtySession = {
  id: string
  token: string
  cwd: string
  createdAt: number
}

const sessions = new Map<string, PtySession>()

function randomId() {
  return crypto.randomBytes(16).toString('hex')
}

export async function createPtySession(): Promise<PtySession> {
  await ensureWorkspaceRoot()
  const id = randomId()
  const token = randomId()
  const cwd = path.join(process.cwd(), '.workspace')
  const session: PtySession = { id, token, cwd, createdAt: Date.now() }
  sessions.set(id, session)
  return session
}

export function getPtySession(id: string, token: string): PtySession | null {
  const s = sessions.get(id)
  if (!s) return null
  if (s.token !== token) return null
  return s
}

export function deletePtySession(id: string) {
  sessions.delete(id)
}


