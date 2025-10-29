'use client'

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { rust } from '@codemirror/lang-rust'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { autocompletion } from '@codemirror/autocomplete'
import { searchKeymap } from '@codemirror/search'
import { keymap } from '@codemirror/view'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { db, type FileItem } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { File, FileCode, Folder, FolderOpen, Plus, Trash2, Play, Save, X, Terminal as TerminalIcon, Globe } from 'lucide-react'
import { getLanguageIcon, detectLanguageFromFileName } from '@/lib/language-icons'
import { cn } from '@/lib/utils'

// Language configurations
const languageConfigs: Record<string, { extension: any; judge0Id: number }> = {
  python: { extension: python(), judge0Id: 71 }, // Python 3
  javascript: { extension: javascript({ jsx: true }), judge0Id: 63 }, // Node.js
  java: { extension: java(), judge0Id: 62 }, // OpenJDK 13.0.1
  cpp: { extension: cpp(), judge0Id: 54 }, // GCC 9.2.0
  rust: { extension: rust(), judge0Id: 73 }, // Rust 1.40.0
  json: { extension: json(), judge0Id: 0 },
  markdown: { extension: markdown(), judge0Id: 0 },
}

export interface CodeEditorHandle {
  setCode: (code: string, language?: string) => void
  getCode: () => string
  insertCode: (code: string, position?: { line: number; column: number }) => void
  createFile: (name: string, language: string, content?: string) => Promise<void>
  runCode: () => Promise<void>
}

interface CodeEditorProps {
  className?: string
  initialLanguage?: string
  onCodeChange?: (code: string) => void
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  ({ className, initialLanguage = 'python', onCodeChange }, ref) => {
    const [code, setCode] = useState('')
    const [language, setLanguage] = useState(initialLanguage)
    const [files, setFiles] = useState<FileItem[]>([])
    const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
    const [isRunning, setIsRunning] = useState(false)
    const [terminalOutput, setTerminalOutput] = useState<string>('')
    const [showTerminal, setShowTerminal] = useState(false)
    const [showBrowser, setShowBrowser] = useState(false)
    const terminalRef = useRef<HTMLDivElement>(null)
    const terminalInstanceRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const editorRef = useRef<any>(null)
    const browserRef = useRef<HTMLIFrameElement>(null)

    // Initialize terminal when shown
    useEffect(() => {
      if (showTerminal && terminalRef.current && !terminalInstanceRef.current) {
        const term = new Terminal({
          theme: {
            background: '#1a1816',
            foreground: '#ffffff',
            cursor: '#c9b59a',
          },
          fontSize: 14,
          fontFamily: 'Space Mono, monospace',
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        fitAddonRef.current = fitAddon
        terminalInstanceRef.current = term

        term.open(terminalRef.current)
        fitAddon.fit()

        term.writeln('Welcome to Code Editor Terminal!')
        term.writeln('Type "help" for available commands.\r\n')

        // Handle window resize
        const handleResize = () => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit()
          }
        }
        window.addEventListener('resize', handleResize)

        return () => {
          window.removeEventListener('resize', handleResize)
        }
      }
    }, [showTerminal])

    // Update terminal size when shown or resized
    useEffect(() => {
      if (showTerminal && fitAddonRef.current) {
        setTimeout(() => {
          fitAddonRef.current?.fit()
        }, 100)
      }
    }, [showTerminal])

    // Update browser preview when code changes (for HTML files)
    useEffect(() => {
      if (browserRef.current && showBrowser && language === 'html') {
        // Use setAttribute for TypeScript compatibility
        browserRef.current.setAttribute('srcdoc', code)
      }
    }, [code, showBrowser, language])

    // Load files from database
    useEffect(() => {
      const loadFiles = async () => {
        const allFiles = await db.files.toArray()
        setFiles(allFiles)
        
        // If no files exist, create a default file
        if (allFiles.length === 0) {
          const defaultFile: FileItem = {
            name: 'main.py',
            content: '# Welcome to the Code Editor!\nprint("Hello, World!")',
            language: 'python',
            path: '/main.py',
            isFolder: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
          const id = await db.files.add(defaultFile)
          const fileId = Number(id)
          setFiles([{ ...defaultFile, id: fileId }])
          setSelectedFileId(fileId)
          setCode(defaultFile.content)
          setLanguage(defaultFile.language)
        } else if (allFiles.length > 0 && !selectedFileId) {
          // Select first file
          const firstFile = allFiles[0]
          if (firstFile.id) {
            setSelectedFileId(firstFile.id)
            setCode(firstFile.content)
            setLanguage(firstFile.language)
          }
        }
      }
      loadFiles()
    }, [selectedFileId])

    // Update code when file changes and auto-detect language
    useEffect(() => {
      if (selectedFileId) {
        const file = files.find((f) => f.id === selectedFileId)
        if (file && !file.isFolder) {
          setCode(file.content)
          // Auto-detect language from filename if not set or update if changed
          const detectedLanguage = detectLanguageFromFileName(file.name)
          if (file.language !== detectedLanguage) {
            // Update language in database
            db.files.update(selectedFileId, { language: detectedLanguage })
          }
          setLanguage(detectedLanguage)
        }
      }
    }, [selectedFileId, files])

    // Save current file
    const saveFile = useCallback(async () => {
      if (selectedFileId) {
        const file = files.find((f) => f.id === selectedFileId)
        if (file && !file.isFolder) {
          await db.files.update(selectedFileId, {
            content: code,
            updatedAt: Date.now(),
          })
          const updatedFiles = await db.files.toArray()
          setFiles(updatedFiles)
        }
      }
    }, [selectedFileId, files, code])

    // Auto-save after debounce
    useEffect(() => {
      const timer = setTimeout(() => {
        saveFile()
      }, 1000)
      return () => clearTimeout(timer)
    }, [code, saveFile])

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      setCode: (newCode: string, newLanguage?: string) => {
        setCode(newCode)
        if (newLanguage) {
          setLanguage(newLanguage)
        }
        onCodeChange?.(newCode)
      },
      getCode: () => code,
      insertCode: (newCode: string, position?: { line: number; column: number }) => {
        // This would require CodeMirror view access - simplified for now
        const currentCode = code
        if (position) {
          const lines = currentCode.split('\n')
          const line = lines[position.line - 1] || ''
          const before = line.slice(0, position.column)
          const after = line.slice(position.column)
          lines[position.line - 1] = before + newCode + after
          setCode(lines.join('\n'))
        } else {
          setCode(currentCode + '\n' + newCode)
        }
        onCodeChange?.(code + '\n' + newCode)
      },
      createFile: async (name: string, fileLanguage: string, content: string = '') => {
        const newFile: FileItem = {
          name,
          content,
          language: fileLanguage,
          path: `/${name}`,
          isFolder: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        const id = await db.files.add(newFile)
        const updatedFiles = await db.files.toArray()
        setFiles(updatedFiles)
        setSelectedFileId(Number(id))
        setCode(content)
        setLanguage(fileLanguage)
      },
      runCode: async () => {
        await executeCode()
      },
    }))

    // Execute code using Judge0 API
    const executeCode = async () => {
      if (!language || languageConfigs[language].judge0Id === 0) {
        terminalInstanceRef.current?.writeln('\r\nError: Cannot execute this file type.\r\n')
        return
      }

      setIsRunning(true)
      const term = terminalInstanceRef.current
      if (term) {
        term.writeln('\r\n--- Running code ---\r\n')
      }

      try {
        // Judge0 API endpoint (you'll need to configure this)
        const JUDGE0_API_URL = process.env.NEXT_PUBLIC_JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com'
        
        const response = await fetch(`${JUDGE0_API_URL}/submissions?base64_encoded=false&wait=true`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Key': process.env.NEXT_PUBLIC_JUDGE0_API_KEY || '',
            'X-RapidAPI-Host': 'judge0-ce.p.rapidapi.com',
          },
          body: JSON.stringify({
            source_code: code,
            language_id: languageConfigs[language].judge0Id,
            stdin: '',
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to execute code')
        }

        const result = await response.json()
        
        if (term) {
          if (result.stdout) {
            term.writeln(`\r\nOutput:\r\n${result.stdout}\r\n`)
          }
          if (result.stderr) {
            term.writeln(`\r\nError:\r\n${result.stderr}\r\n`)
          }
          if (result.compile_output) {
            term.writeln(`\r\nCompile Output:\r\n${result.compile_output}\r\n`)
          }
          if (result.status?.id === 3) {
            term.writeln('\r\n✓ Execution completed successfully\r\n')
          } else {
            term.writeln(`\r\n✗ Execution failed with status: ${result.status?.description || 'Unknown'}\r\n`)
          }
        }
      } catch (error: any) {
        if (term) {
          term.writeln(`\r\nError executing code: ${error.message}\r\n`)
          term.writeln('Note: Make sure JUDGE0_API_URL and JUDGE0_API_KEY are configured in your environment variables.\r\n')
        }
      } finally {
        setIsRunning(false)
      }
    }

    // File management functions
    const createNewFile = async () => {
      const name = prompt('Enter file name (e.g., main.py):')
      if (!name) return

      const detectedLanguage = detectLanguageFromFileName(name)

      const newFile: FileItem = {
        name,
        content: '',
        language: detectedLanguage,
        path: `/${name}`,
        isFolder: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const id = await db.files.add(newFile)
      const fileId = Number(id)
      const updatedFiles = await db.files.toArray()
      setFiles(updatedFiles)
      setSelectedFileId(fileId)
      setCode('')
      setLanguage(detectedLanguage)
    }

    const createNewFolder = async () => {
      const name = prompt('Enter folder name:')
      if (!name) return

      const newFolder: FileItem = {
        name,
        content: '',
        language: '',
        path: `/${name}`,
        isFolder: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await db.files.add(newFolder)
      const updatedFiles = await db.files.toArray()
      setFiles(updatedFiles)
    }

    const deleteFile = async (fileId: number) => {
      if (!confirm('Are you sure you want to delete this file?')) return
      await db.files.delete(fileId)
      const updatedFiles = await db.files.toArray()
      setFiles(updatedFiles)
      if (selectedFileId === fileId) {
        const remainingFiles = updatedFiles.filter((f) => !f.isFolder)
        if (remainingFiles.length > 0 && remainingFiles[0].id) {
          setSelectedFileId(remainingFiles[0].id)
        } else {
          setSelectedFileId(null)
          setCode('')
        }
      }
    }

    const toggleFolder = (folderId: number) => {
      const newExpanded = new Set(expandedFolders)
      if (newExpanded.has(folderId)) {
        newExpanded.delete(folderId)
      } else {
        newExpanded.add(folderId)
      }
      setExpandedFolders(newExpanded)
    }

    // Filter files to show only root level files
    const rootFiles = files.filter((f) => !f.parentId)
    const currentFile = files.find((f) => f.id === selectedFileId)

    return (
      <div className={cn('flex h-full flex-col border border-border bg-card', className)}>
        <div className="flex h-full">
          {/* File Sidebar - Fixed Width */}
          <div className="w-64 border-r border-border bg-background flex flex-col shrink-0">
            <div className="p-1.5 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Files</h3>
              <div className="flex gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={createNewFile}
                  title="New File"
                  className="h-5 w-5"
                >
                  <File className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={createNewFolder}
                  title="New Folder"
                  className="h-5 w-5"
                >
                  <Folder className="size-3" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {rootFiles.map((file) => (
                <div key={file.id} className="mb-0.5 group">
                  <div
                    className={cn(
                      'flex items-center gap-1.5 p-1 rounded text-xs cursor-pointer hover:bg-accent',
                      selectedFileId === file.id && 'bg-accent'
                    )}
                    onClick={() => !file.isFolder && file.id && setSelectedFileId(file.id)}
                  >
                    {file.isFolder ? (
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          if (file.id) toggleFolder(file.id)
                        }}
                      >
                        {expandedFolders.has(file.id!) ? (
                          <FolderOpen className="size-3.5" />
                        ) : (
                          <Folder className="size-3.5" />
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center">
                        {getLanguageIcon(file.language || detectLanguageFromFileName(file.name), 14)}
                      </div>
                    )}
                    <span className="flex-1 truncate text-xs">{file.name}</span>
                    {!file.isFolder && file.id && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteFile(file.id!)
                        }}
                      >
                        <Trash2 className="size-2.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {rootFiles.length === 0 && (
                <p className="text-xs text-muted-foreground p-1.5">
                  No files yet. Create one to get started!
                </p>
              )}
            </div>
          </div>

          {/* Main Editor Area */}
          <ResizablePanelGroup direction="vertical" className="flex-1">
            <ResizablePanel 
              defaultSize={showTerminal ? (showBrowser ? 60 : 75) : 100} 
              minSize={30}
            >
              <ResizablePanelGroup direction="horizontal" className="h-full">
                {/* Editor Content */}
                <ResizablePanel 
                  defaultSize={showBrowser ? 60 : 100} 
                  minSize={40} 
                  className="flex flex-col"
                >
                  {/* Top Toolbar */}
                  <div className="h-9 border-b border-border flex items-center gap-3 px-3 bg-background">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTerminal(!showTerminal)}
                      className={cn(
                        'h-7 px-2 text-xs',
                        showTerminal && 'bg-accent'
                      )}
                    >
                      Terminal
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={executeCode}
                      disabled={isRunning || !selectedFileId || languageConfigs[language]?.judge0Id === 0}
                      className="h-7 px-2 text-xs"
                    >
                      {isRunning ? 'Running...' : 'Run'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBrowser(!showBrowser)}
                      className={cn(
                        'h-7 px-2 text-xs',
                        showBrowser && 'bg-accent'
                      )}
                    >
                      Browser
                    </Button>
                    <div className="flex-1" />
                    {currentFile && (
                      <span className="text-xs text-muted-foreground">
                        {currentFile.name}
                      </span>
                    )}
                  </div>

                  {/* Code Editor */}
                  <div className="flex-1 overflow-hidden">
                    <CodeMirror
                      ref={editorRef}
                      value={code}
                      height="100%"
                      theme={oneDark}
                      extensions={[
                        languageConfigs[language]?.extension || python(),
                        autocompletion(),
                        keymap.of(searchKeymap),
                      ]}
                      onChange={(value) => {
                        setCode(value)
                        onCodeChange?.(value)
                      }}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        dropCursor: false,
                        allowMultipleSelections: false,
                      }}
                    />
                  </div>
                </ResizablePanel>

                {/* Browser Preview */}
                {showBrowser && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel 
                      defaultSize={40} 
                      minSize={20}
                      className="border-l border-border bg-background"
                    >
                      <div className="h-full flex flex-col">
                        <div className="h-9 border-b border-border flex items-center px-3 bg-muted/30">
                          <Globe className="size-4 mr-2" />
                          <span className="text-xs font-medium">Browser Preview</span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <iframe
                            ref={browserRef}
                            className="w-full h-full border-0"
                            srcDoc={code}
                            title="Browser Preview"
                          />
                        </div>
                      </div>
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </ResizablePanel>

            {/* Terminal Drawer */}
            {showTerminal && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel 
                  defaultSize={25} 
                  minSize={15} 
                  maxSize={60}
                  className="border-t border-border bg-background"
                >
                <div className="h-full flex flex-col">
                  <div className="h-9 border-b border-border flex items-center px-3 bg-muted/30">
                    <TerminalIcon className="size-4 mr-2" />
                    <span className="text-xs font-medium">Terminal</span>
                  </div>
                  <div className="flex-1 overflow-hidden p-2">
                    <div ref={terminalRef} className="h-full w-full" />
                  </div>
                </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>
    )
  }
)

CodeEditor.displayName = 'CodeEditor'

export default CodeEditor


