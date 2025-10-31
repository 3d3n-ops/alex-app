/**
 * Terminal command utilities
 * Helper functions for common terminal operations
 */

export interface CommandResult {
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  error?: string
}

/**
 * Execute a shell command via the terminal API
 */
export async function executeCommand(command: string, cwd?: string, timeout = 30000): Promise<CommandResult> {
  try {
    const response = await fetch('/api/terminal/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd, timeout })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      return {
        success: false,
        stdout: '',
        stderr: error.error || 'Command execution failed',
        exitCode: 1,
        error: error.error || error.message
      }
    }

    return await response.json()
  } catch (error: any) {
    return {
      success: false,
      stdout: '',
      stderr: error.message || 'Network error',
      exitCode: 1,
      error: error.message
    }
  }
}

/**
 * Common terminal commands
 */
export const TerminalCommands = {
  // File operations
  listFiles: (dir = '.') => executeCommand(`ls -la "${dir}"`, dir),
  listFilesWindows: (dir = '.') => executeCommand(`Get-ChildItem "${dir}"`, dir),
  
  readFile: (file: string) => {
    const isWindows = typeof window !== 'undefined' && window.navigator.platform.includes('Win')
    return isWindows 
      ? executeCommand(`Get-Content "${file}"`)
      : executeCommand(`cat "${file}"`)
  },
  
  writeFile: async (file: string, content: string) => {
    // Use workspace API instead - safer
    return { success: false, stdout: '', stderr: 'Use workspace API for file writes', exitCode: 1 }
  },

  // Directory operations
  changeDirectory: (dir: string) => executeCommand(`cd "${dir}"`),
  createDirectory: (dir: string) => {
    const isWindows = typeof window !== 'undefined' && window.navigator.platform.includes('Win')
    return isWindows
      ? executeCommand(`New-Item -ItemType Directory -Force -Path "${dir}"`)
      : executeCommand(`mkdir -p "${dir}"`)
  },

  // Info commands
  pwd: () => executeCommand('pwd'),
  whoami: () => executeCommand('whoami'),
  
  // Package managers
  npmInstall: (packageName?: string) => 
    executeCommand(packageName ? `npm install ${packageName}` : 'npm install'),
  
  pipInstall: (packageName: string) => 
    executeCommand(`pip install ${packageName}`),
}

