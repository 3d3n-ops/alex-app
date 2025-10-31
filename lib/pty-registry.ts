// PTY code commented out - node-pty doesn't work in Next.js production builds
// TODO: Re-enable when migrating to self-hosted solution or alternative

/*
import type { IPty } from 'node-pty'
// Defer requiring node-pty to runtime to avoid bundling/edge issues
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pty: typeof import('node-pty') = require('node-pty')
import os from 'node:os'
import { getPtySession } from './pty-manager'

type PtyRecord = {
  pty: IPty
}

const idToPty = new Map<string, PtyRecord>()

export function hasPty(sessionId: string) {
  return idToPty.has(sessionId)
}

export function spawnPty(sessionId: string, token: string, cwd: string, cols = 80, rows = 24) {
  if (idToPty.has(sessionId)) return idToPty.get(sessionId)!.pty
  const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'
  const child = pty.spawn(shell, [], { name: 'xterm-color', cols, rows, cwd, env: process.env as any })
  idToPty.set(sessionId, { pty: child })
  child.onExit(() => {
    idToPty.delete(sessionId)
  })
  return child
}

export function writePty(sessionId: string, token: string, data: string) {
  const rec = idToPty.get(sessionId)
  if (!rec) throw new Error('PTY not found')
  rec.pty.write(data)
}

export function resizePty(sessionId: string, token: string, cols: number, rows: number) {
  const rec = idToPty.get(sessionId)
  if (!rec) throw new Error('PTY not found')
  rec.pty.resize(cols, rows)
}
*/

// Stub implementations to prevent import errors
export function hasPty(_sessionId: string) {
  return false
}

export function spawnPty(_sessionId: string, _token: string, _cwd: string, _cols = 80, _rows = 24) {
  throw new Error('PTY is disabled. Using SimpleTerminal instead.')
}

export function writePty(_sessionId: string, _token: string, _data: string) {
  throw new Error('PTY is disabled. Using SimpleTerminal instead.')
}

export function resizePty(_sessionId: string, _token: string, _cols: number, _rows: number) {
  throw new Error('PTY is disabled. Using SimpleTerminal instead.')
}


