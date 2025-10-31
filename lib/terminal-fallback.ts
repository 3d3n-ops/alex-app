/**
 * Terminal fallback utilities
 * Provides command execution when PTY is unavailable
 */

import { executeCommand } from './terminal-commands'

export interface TerminalMode {
  type: 'pty' | 'command'
  supportsInteractive: boolean
  supportsStreaming: boolean
}

/**
 * Detect if PTY is available
 */
export async function detectTerminalMode(): Promise<TerminalMode> {
  try {
    // Try to create a PTY session
    const response = await fetch('/api/pty/session', { method: 'POST' })
    if (response.ok) {
      return {
        type: 'pty',
        supportsInteractive: true,
        supportsStreaming: true
      }
    }
  } catch (error) {
    // PTY not available
  }

  // Fallback to command mode
  return {
    type: 'command',
    supportsInteractive: false,
    supportsStreaming: false
  }
}

/**
 * Execute command with automatic fallback
 */
export async function executeCommandWithFallback(
  command: string,
  onOutput?: (data: string) => void,
  cwd?: string
): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }> {
  const mode = await detectTerminalMode()

  if (mode.type === 'pty') {
    // Try PTY first, but it might fail
    try {
      // For now, fall through to command mode
      // In the future, could implement PTY streaming here
      throw new Error('PTY streaming not implemented')
    } catch (error) {
      // Fallback to command mode
    }
  }

  // Use command execution API
  const result = await executeCommand(command, cwd)
  
  // Stream output if callback provided
  if (onOutput) {
    if (result.stdout) {
      onOutput(result.stdout)
    }
    if (result.stderr) {
      onOutput(result.stderr)
    }
  }

  return result
}

