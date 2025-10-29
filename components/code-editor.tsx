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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { File, FileCode, Folder, FolderOpen, Plus, Trash2, Play, Save, X } from 'lucide-react'
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
    const terminalRef = useRef<HTMLDivElement>(null)
    const terminalInstanceRef = useRef<Terminal | null>(null)
    const fitAddonRef = useRef<FitAddon | null>(null)
    const editorRef = useRef<any>(null)

    // Initialize terminal
    useEffect(() => {
      if (terminalRef.current && !terminalInstanceRef.current) {
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
          fitAddon.fit()
        }
        window.addEventListener('resize', handleResize)

        return () => {
          window.removeEventListener('resize', handleResize)
          term.dispose()
        }
      }
    }, [])

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

    // Update code when file changes
    useEffect(() => {
      if (selectedFileId) {
        const file = files.find((f) => f.id === selectedFileId)
        if (file && !file.isFolder) {
          setCode(file.content)
          setLanguage(file.language)
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

      const fileExt = name.split('.').pop() || ''
      const detectedLanguage = Object.keys(languageConfigs).find(
        (lang) => fileExt === lang || (lang === 'javascript' && ['js', 'jsx'].includes(fileExt))
      ) || 'python'

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

    return (
      <div className={cn('flex h-full flex-col border border-border rounded-lg overflow-hidden bg-card', className)}>
        <div className="flex h-full">
          {/* File Sidebar */}
          <div className="w-64 border-r border-border bg-muted/30 flex flex-col">
            <div className="p-2 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold">Files</h3>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={createNewFile}
                title="New File"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {rootFiles.map((file) => (
                <div key={file.id} className="mb-1 group">
                  <div
                    className={cn(
                      'flex items-center gap-2 p-1.5 rounded text-sm cursor-pointer hover:bg-accent',
                      selectedFileId === file.id && 'bg-accent'
                    )}
                    onClick={() => !file.isFolder && file.id && setSelectedFileId(file.id)}
                  >
                    {file.isFolder ? (
                      expandedFolders.has(file.id!) ? (
                        <FolderOpen className="size-4" />
                      ) : (
                        <Folder className="size-4" />
                      )
                    ) : (
                      <FileCode className="size-4" />
                    )}
                    <span className="flex-1 truncate">{file.name}</span>
                    {!file.isFolder && file.id && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteFile(file.id!)
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {rootFiles.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">
                  No files yet. Create one to get started!
                </p>
              )}
            </div>
          </div>

          {/* Main Editor Area */}
          <div className="flex-1 flex flex-col">
            {/* Toolbar */}
            <div className="h-12 border-b border-border flex items-center gap-2 px-4 bg-muted/30">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(languageConfigs).map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={saveFile}
                disabled={!selectedFileId}
              >
                <Save className="size-4 mr-1" />
                Save
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={executeCode}
                disabled={isRunning || !selectedFileId || languageConfigs[language]?.judge0Id === 0}
              >
                <Play className="size-4 mr-1" />
                {isRunning ? 'Running...' : 'Run'}
              </Button>
              <div className="flex-1" />
              {selectedFileId && (
                <div className="text-xs text-muted-foreground">
                  {files.find((f) => f.id === selectedFileId)?.name}
                </div>
              )}
            </div>

            {/* Editor and Terminal Tabs */}
            <Tabs defaultValue="editor" className="flex-1 flex flex-col">
              <TabsList className="mx-2 mt-2 w-fit">
                <TabsTrigger value="editor">Editor</TabsTrigger>
                <TabsTrigger value="terminal">Terminal</TabsTrigger>
              </TabsList>
              <TabsContent value="editor" className="flex-1 mt-0 p-4 overflow-hidden">
                <div className="h-full">
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
              </TabsContent>
              <TabsContent value="terminal" className="flex-1 mt-0 p-2 overflow-hidden">
                <div ref={terminalRef} className="h-full w-full" />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    )
  }
)

CodeEditor.displayName = 'CodeEditor'

export default CodeEditor

