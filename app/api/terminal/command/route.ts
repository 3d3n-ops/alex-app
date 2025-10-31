import { auth } from '@clerk/nextjs/server'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import os from 'node:os'

const execAsync = promisify(exec)

export const runtime = 'nodejs'

/**
 * Simple command execution API
 * Executes shell commands without PTY - suitable for one-off commands
 * 
 * NOT suitable for:
 * - Interactive programs (they'll hang waiting for input)
 * - Long-running processes (timeout after 30 seconds)
 * - Real-time streaming
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { command, cwd, timeout = 30000 } = body

    if (!command || typeof command !== 'string') {
      return new Response(JSON.stringify({ error: 'Command is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate command (prevent dangerous operations)
    const dangerousCommands = ['rm -rf', 'format', 'del /f', 'shutdown', 'reboot']
    const lowerCommand = command.toLowerCase()
    if (dangerousCommands.some(dangerous => lowerCommand.includes(dangerous))) {
      return new Response(JSON.stringify({ error: 'Command not allowed for security reasons' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Set working directory
    const workspaceRoot = path.join(process.cwd(), '.workspace')
    const workingDir = cwd && typeof cwd === 'string' ? path.resolve(workspaceRoot, cwd) : workspaceRoot

    // Determine shell based on platform
    const isWindows = os.platform() === 'win32'
    const shellCommand = isWindows 
      ? `powershell.exe -Command "${command.replace(/"/g, '\\"')}"`
      : command

    // Execute command with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const { stdout, stderr } = await execAsync(shellCommand, {
        cwd: workingDir,
        maxBuffer: 10 * 1024 * 1024, // 10MB max output
        signal: controller.signal,
        env: { ...process.env }
      })

      clearTimeout(timeoutId)

      return new Response(JSON.stringify({
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: stderr ? 1 : 0,
        cwd: workingDir,
      }), {
        headers: { 'Content-Type': 'application/json' }
      })

    } catch (error: any) {
      clearTimeout(timeoutId)

      // Handle timeout
      if (error.name === 'AbortError' || error.signal === 'SIGTERM') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Command timed out',
          stdout: '',
          stderr: `Command exceeded ${timeout / 1000} second timeout`,
          exitCode: 124, // Standard timeout exit code
        }), {
          status: 408,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Handle other errors
      return new Response(JSON.stringify({
        success: false,
        error: error.message || 'Command execution failed',
        stdout: error.stdout || '',
        stderr: error.stderr || error.message || '',
        exitCode: error.code || 1,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

  } catch (error: any) {
    console.error('Terminal command API error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error?.message || String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

