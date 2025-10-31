'use client'

/**
 * Simple Terminal Component
 * Works without PTY - uses command execution API
 * Suitable for most use cases except interactive programs
 */

import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useEffect, useRef, useState } from 'react'
import { executeCommand } from '@/lib/terminal-commands'

interface SimpleTerminalProps {
  className?: string
  onClose?: () => void
  initialOutput?: string
}

export function SimpleTerminal({ className, onClose, initialOutput }: SimpleTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const terminalInstanceRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [currentCommand, setCurrentCommand] = useState('')
  const [cwd, setCwd] = useState('.')

  useEffect(() => {
    if (!terminalRef.current || terminalInstanceRef.current) return

    const term = new Terminal({
      theme: {
        background: '#1a1816',
        foreground: '#ffffff',
        cursor: '#c9b59a',
      },
      fontSize: 14,
      fontFamily: 'Space Mono, monospace',
      cursorBlink: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    fitAddonRef.current = fitAddon
    terminalInstanceRef.current = term

    term.open(terminalRef.current)
    fitAddon.fit()

    // Define prompt function
    const prompt = (t: Terminal) => {
      t.write(`\x1b[32m${cwd}\x1b[0m $ `)
    }

    // Welcome message
    term.writeln('Welcome to Terminal (Command Mode)')
    term.writeln('Type commands and press Enter. Use "help" for available commands.\r\n')
    
    // Display initial output if provided (e.g., from Judge0 execution)
    if (initialOutput) {
      term.write(initialOutput)
      term.writeln('\r\n')
    }
    
    prompt(term)

    // Handle input
    let currentLine = ''
    term.onData(async (data) => {
      const code = data.charCodeAt(0)

      // Enter key
      if (code === 13) {
        term.write('\r\n')
        const command = currentLine.trim()
        
        if (command) {
          // Add to history
          setCommandHistory(prev => [...prev, command])
          setHistoryIndex(-1)

          // Handle special commands
          if (command === 'help') {
            term.writeln('Available commands:')
            term.writeln('  help           - Show this help')
            term.writeln('  clear          - Clear terminal')
            term.writeln('  pwd            - Show current directory')
            term.writeln('  ls [dir]       - List files')
            term.writeln('  cat <file>     - Read file')
            term.writeln('  cd <dir>       - Change directory')
            term.writeln('  exit           - Close terminal')
            term.writeln('Any other command will be executed via shell.\r\n')
            prompt(term)
            currentLine = ''
            return
          }

          if (command === 'clear') {
            term.clear()
            prompt(term)
            currentLine = ''
            return
          }

          if (command === 'exit') {
            onClose?.()
            return
          }

          // Execute command
          try {
            term.write('⏳ Executing...\r\n')
            const result = await executeCommand(command, cwd)

            if (result.stdout) {
              term.write(result.stdout)
              if (!result.stdout.endsWith('\n')) {
                term.write('\r\n')
              }
            }

            if (result.stderr) {
              term.write(`\x1b[31m${result.stderr}\x1b[0m`) // Red color for errors
              if (!result.stderr.endsWith('\n')) {
                term.write('\r\n')
              }
            }

            if (result.exitCode !== 0 && !result.stderr) {
              term.write(`\x1b[31mCommand failed with exit code ${result.exitCode}\x1b[0m\r\n`)
            }

            // Update CWD for cd commands
            if (command.startsWith('cd ')) {
              const newDir = command.slice(3).trim()
              if (newDir) {
                setCwd(newDir === '~' ? '.' : newDir)
              }
            }

          } catch (error: any) {
            term.write(`\x1b[31mError: ${error.message || 'Unknown error'}\x1b[0m\r\n`)
          }
        }

        prompt(term)
        currentLine = ''
      }
      // Backspace
      else if (code === 127) {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1)
          term.write('\b \b')
        }
      }
      // Other characters
      else {
        currentLine += data
        term.write(data)
      }
    })

    // Handle resize
    const handleResize = () => {
      fitAddon.fit()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [cwd, onClose])

  // Handle updates to initialOutput (e.g., from Judge0 execution)
  const previousOutputRef = useRef<string>('')
  useEffect(() => {
    if (initialOutput !== undefined && terminalInstanceRef.current) {
      // If output was cleared (empty string), reset ref
      if (initialOutput === '') {
        previousOutputRef.current = ''
        return
      }
      
      // Only write the new portion of output
      const newOutput = initialOutput.slice(previousOutputRef.current.length)
      if (newOutput) {
        terminalInstanceRef.current.write(newOutput)
        // Show prompt after output
        terminalInstanceRef.current.write(`\r\n\x1b[32m${cwd}\x1b[0m $ `)
      }
      previousOutputRef.current = initialOutput
    }
  }, [initialOutput, cwd])

  return <div ref={terminalRef} className={className} />
}

