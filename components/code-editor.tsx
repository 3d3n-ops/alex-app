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
import { html } from '@codemirror/lang-html'
import { autocompletion } from '@codemirror/autocomplete'
import { searchKeymap } from '@codemirror/search'
import { keymap } from '@codemirror/view'
import { SimpleTerminal } from '@/components/simple-terminal'
import { db, type FileItem } from '@/lib/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { File, FileCode, Folder, FolderOpen, Plus, Trash2, Play, Save, X, Terminal as TerminalIcon, Globe } from 'lucide-react'
import { getLanguageIcon, detectLanguageFromFileName } from '@/lib/language-icons'
import { cn } from '@/lib/utils'

// Language configurations for judge0-extra-ce
const languageConfigs: Record<string, { extension: any; judge0Id: number }> = {
  python: { extension: python(), judge0Id: 8 }, // Python 3.7.7 (MPI) - can also use 25, 31, 32 for ML versions
  javascript: { extension: javascript({ jsx: true }), judge0Id: 0 }, // Not available in judge0-extra-ce
  java: { extension: java(), judge0Id: 4 }, // Java (OpenJDK 14.0.1)
  cpp: { extension: cpp(), judge0Id: 2 }, // C++ (Clang 10.0.1)
  c: { extension: cpp(), judge0Id: 1 }, // C (Clang 10.0.1)
  csharp: { extension: cpp(), judge0Id: 22 }, // C# (Mono 6.12.0.122)
  fsharp: { extension: cpp(), judge0Id: 24 }, // F# (.NET Core SDK 3.1.406)
  html: { extension: html(), judge0Id: 0 }, // HTML (browser preview only)
  css: { extension: json(), judge0Id: 0 }, // CSS (browser preview only)
  json: { extension: json(), judge0Id: 0 },
  markdown: { extension: markdown(), judge0Id: 0 },
  // Multi-file support
  multifile: { extension: json(), judge0Id: 89 }, // Multi-file program
}

export interface CodeEditorHandle {
  setCode: (code: string, language?: string) => void
  getCode: () => string
  insertCode: (code: string, position?: { line: number; column: number }) => void
  createFile: (name: string, language: string, content?: string) => Promise<void>
  runCode: () => Promise<void>
  openTerminal: () => void
  writeToTerminal: (text: string) => void
}

interface CodeEditorProps {
  className?: string
  initialLanguage?: string
  onCodeChange?: (code: string) => void
  threadId?: string // Thread-scoped files
}

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(
  ({ className, initialLanguage = 'python', onCodeChange, threadId = 'default' }, ref) => {
    const [code, setCode] = useState('')
    const [language, setLanguage] = useState(initialLanguage)
    const [files, setFiles] = useState<FileItem[]>([])
    const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set())
    const [isRunning, setIsRunning] = useState(false)
    const [terminalOutput, setTerminalOutput] = useState<string>('')
    const [showTerminal, setShowTerminal] = useState(false)
    const [showBrowser, setShowBrowser] = useState(false)
    const [showNewDialog, setShowNewDialog] = useState(false)
    const [newDialogType, setNewDialogType] = useState<'file' | 'folder'>('file')
    const [newDialogName, setNewDialogName] = useState('')
    const [ctxMenu, setCtxMenu] = useState<{ visible: boolean; x: number; y: number; targetId?: number }>(
      { visible: false, x: 0, y: 0 }
    )
    const [showRenameDialog, setShowRenameDialog] = useState(false)
    const [renameName, setRenameName] = useState('')
    const [renameTarget, setRenameTarget] = useState<FileItem | null>(null)
    // SimpleTerminal handles its own refs, no need for terminal refs
    const terminalOutputRef = useRef<string>('')
    const editorRef = useRef<any>(null)
    const browserRef = useRef<HTMLIFrameElement>(null)

    // Terminal is now handled by SimpleTerminal component
    // No initialization needed

    // Build combined HTML document from HTML, CSS, and JS files
    const buildCombinedHTML = useCallback((htmlContent: string): string => {
      // Find all CSS and JS files
      const cssFiles = files.filter(f => !f.isFolder && f.language === 'css' && f.content)
      const jsFiles = files.filter(f => !f.isFolder && f.language === 'javascript' && f.content)
      
      // Extract or create HTML structure
      let htmlDoc = htmlContent.trim()
      
      // If no <html> tag, wrap in basic structure
      if (!htmlDoc.includes('<html')) {
        htmlDoc = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
</head>
<body>
${htmlDoc}
</body>
</html>`
      }
      
      // Inject CSS files as <style> tags in <head>
      if (cssFiles.length > 0) {
        const cssContent = cssFiles.map(f => `/* ${f.name} */\n${f.content}`).join('\n\n')
        if (htmlDoc.includes('</head>')) {
          htmlDoc = htmlDoc.replace('</head>', `  <style>\n${cssContent}\n  </style>\n</head>`)
        } else if (htmlDoc.includes('<head>')) {
          htmlDoc = htmlDoc.replace('<head>', `<head>\n  <style>\n${cssContent}\n  </style>`)
        } else {
          // Insert before </html> if no head
          htmlDoc = htmlDoc.replace('</html>', `  <style>\n${cssContent}\n  </style>\n</html>`)
        }
      }
      
      // Inject JS files as <script> tags before </body> or </html>
      if (jsFiles.length > 0) {
        const jsContent = jsFiles.map(f => `/* ${f.name} */\n${f.content}`).join('\n\n')
        if (htmlDoc.includes('</body>')) {
          htmlDoc = htmlDoc.replace('</body>', `  <script>\n${jsContent}\n  </script>\n</body>`)
        } else if (htmlDoc.includes('</html>')) {
          htmlDoc = htmlDoc.replace('</html>', `  <script>\n${jsContent}\n  </script>\n</html>`)
        } else {
          htmlDoc += `\n<script>\n${jsContent}\n</script>\n`
        }
      }
      
      return htmlDoc
    }, [files])

    // Update browser preview when code or files change (for HTML/CSS/JS projects)
    useEffect(() => {
      if (browserRef.current && showBrowser) {
        let previewContent = ''
        
        if (language === 'html') {
          // Build combined HTML from HTML + CSS + JS files
          previewContent = buildCombinedHTML(code)
        } else if (language === 'css' || language === 'javascript') {
          // For CSS/JS files, try to find an HTML file to inject into
          const htmlFile = files.find(f => !f.isFolder && f.language === 'html')
          if (htmlFile && htmlFile.content) {
            previewContent = buildCombinedHTML(htmlFile.content)
          } else {
            // Create a minimal HTML wrapper for CSS/JS preview
            if (language === 'css') {
              previewContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${code}</style>
</head>
<body>
  <h1>CSS Preview</h1>
  <p>This is a preview of your CSS. Create an HTML file to see full styling.</p>
</body>
</html>`
            } else {
              previewContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script>${code}</script>
</head>
<body>
  <h1>JavaScript Preview</h1>
  <p>Check the browser console for JavaScript output.</p>
</body>
</html>`
            }
          }
        }
        
        if (previewContent) {
          browserRef.current.setAttribute('srcdoc', previewContent)
        }
      }
    }, [code, showBrowser, language, files, buildCombinedHTML])

    // Load files from database (thread-scoped)
    useEffect(() => {
      const loadFiles = async () => {
        if (!threadId) return // Wait for threadId
        
        // Filter files by threadId
        const threadFiles = await db.files
          .where('threadId')
          .equals(threadId)
          .toArray()
        setFiles(threadFiles)
        
        // If no files exist for this thread, create a default file
        if (threadFiles.length === 0) {
          const defaultFile: FileItem = {
            threadId,
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
        } else if (threadFiles.length > 0 && !selectedFileId) {
          // Select first file
          const firstFile = threadFiles[0]
          if (firstFile.id) {
            setSelectedFileId(firstFile.id)
            setCode(firstFile.content)
            setLanguage(firstFile.language)
          }
        }
      }
      loadFiles()
    }, [selectedFileId, threadId])

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
      if (selectedFileId && threadId) {
        const file = files.find((f) => f.id === selectedFileId)
        if (file && !file.isFolder) {
          await db.files.update(selectedFileId, {
            content: code,
            updatedAt: Date.now(),
          })
          const updatedFiles = await db.files
            .where('threadId')
            .equals(threadId)
            .toArray()
          setFiles(updatedFiles)
        }
      }
    }, [selectedFileId, files, code, threadId])

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
        if (!threadId) {
          console.error('Cannot create file: threadId is required')
          return
        }
        const newFile: FileItem = {
          threadId, // Thread-scoped
          name,
          content,
          language: fileLanguage,
          path: `/${name}`,
          isFolder: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        const id = await db.files.add(newFile)
        const updatedFiles = await db.files
          .where('threadId')
          .equals(threadId)
          .toArray()
        setFiles(updatedFiles)
        setSelectedFileId(Number(id))
        setCode(content)
        setLanguage(fileLanguage)
      },
      runCode: async () => {
        await executeCode()
      },
      openTerminal: () => {
        setShowTerminal(true)
      },
      writeToTerminal: (text: string) => {
        // Store output for later display
        terminalOutputRef.current += text
        setTerminalOutput(prev => prev + text)
        // Open terminal if not already open
        if (!showTerminal) {
          setShowTerminal(true)
        }
        // Note: SimpleTerminal will show output when commands are executed
        // This is mainly for programmatic output from Judge0 execution
      }
    }))

    // Execute code using Judge0 API
    const executeCode = async () => {
      setIsRunning(true)
      
      // Clear previous output and ensure terminal is visible
      setTerminalOutput('')
      terminalOutputRef.current = ''
      
      if (!showTerminal) {
        setShowTerminal(true)
      }
      
      // Helper to append output (will be displayed in SimpleTerminal)
      const appendOutput = (text: string) => {
        setTerminalOutput(prev => prev + text)
      }
      
      try {
        // Save current file to workspace
        if (selectedFileId) {
          const file = files.find((f) => f.id === selectedFileId)
          if (file && !file.isFolder) {
            await fetch('/api/workspace/file', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                path: file.path.replace(/^\//, ''), 
                content: code,
                threadId: threadId || 'default'
              })
            })
          }
        }

        // Get Judge0 language ID
        const languageConfig = languageConfigs[language]
        if (!languageConfig || !languageConfig.judge0Id) {
          appendOutput(`\r\n❌ Language "${language}" is not supported for code execution.\r\n`)
          return
        }

        // Validate code is not empty
        if (!code || code.trim().length === 0) {
          appendOutput(`❌ Error: Cannot execute empty code\r\n`)
          return
        }

        // Check if we should use multi-file mode
        // Collect all non-folder files in the same directory/root
        const allCodeFiles = files.filter(f => !f.isFolder && f.language === language && f.content && f.content.trim().length > 0)
        
        // Use multi-file if we have more than one file, or if user explicitly wants it
        const useMultiFile = allCodeFiles.length > 1 && languageConfig.judge0Id !== 0
        
        let response: Response
        
        if (useMultiFile) {
          appendOutput(`\r\n⏳ Executing ${language} project with ${allCodeFiles.length} files...\r\n`)
          
          // Prepare multi-file submission
          const additionalFiles = allCodeFiles
            .filter(f => f.id !== selectedFileId) // Exclude the main file (it goes in source_code)
            .map(f => ({
              content: f.content,
              name: f.name,
            }))
          
          // Submit to Judge0 API with multi-file support
          response = await fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code.trim(),
              languageId: 89, // Multi-file program
              stdin: '',
              additionalFiles: additionalFiles,
            })
          })
        } else {
          appendOutput(`\r\n⏳ Executing ${language} code...\r\n`)
          
          // Submit to Judge0 API (single file)
          response = await fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: code.trim(),
              languageId: languageConfig.judge0Id,
              stdin: '',
            })
          })
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }))
          appendOutput(`❌ Execution failed: ${error.error || error.message || 'Unknown error'}\r\n`)
          return
        }

        const result = await response.json()

        if (result.error) {
          appendOutput(`❌ ${result.error}\r\n`)
          if (result.token) {
            appendOutput(`Token: ${result.token}\r\n`)
          }
          return
        }

        // Display results
        if (result.compileOutput) {
          appendOutput(`📝 Compilation Output:\r\n${result.compileOutput}\r\n`)
        }

        if (result.stderr) {
          appendOutput(`⚠️  Error Output:\r\n${result.stderr}\r\n`)
        }

        if (result.stdout) {
          appendOutput(`✅ Output:\r\n${result.stdout}\r\n`)
        }

        if (result.success) {
          appendOutput(`✓ Execution completed successfully\r\n`)
          if (result.time) {
            appendOutput(`⏱️  Time: ${result.time}s\r\n`)
          }
          if (result.memory) {
            appendOutput(`💾 Memory: ${(result.memory / 1024).toFixed(2)} KB\r\n`)
          }
          appendOutput('\r\n')
        } else {
          appendOutput(`❌ Execution failed: ${result.status || 'Unknown error'}\r\n`)
          if (result.message) {
            appendOutput(`Message: ${result.message}\r\n`)
          }
          appendOutput('\r\n')
        }

      } catch (e: any) {
        appendOutput(`❌ Error: ${String(e?.message || e)}\r\n`)
      } finally {
        setIsRunning(false)
      }
    }

    // File tree helpers
    const getChildren = (parentId?: number | null) => {
      return files
        .filter((f) => (parentId ? f.parentId === parentId : !f.parentId))
        .sort((a, b) => {
          // Folders first, then order, then name
          if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
          const ao = a.order ?? 0, bo = b.order ?? 0
          if (ao !== bo) return ao - bo
          return a.name.localeCompare(b.name)
        })
    }

    const buildChildPath = (parentPath: string | undefined, name: string) => {
      const base = parentPath && parentPath !== '/' ? parentPath : ''
      return `${base}/${name}`
    }

    // File management functions (hierarchical)
    const createInFolder = async (parent: FileItem | null, name: string, isFolder: boolean) => {
      if (!threadId) return // ThreadId required
      const detectedLanguage = isFolder ? '' : detectLanguageFromFileName(name)
      const parentPath = parent?.path || '/'
      const newItem: FileItem = {
        threadId, // Thread-scoped
        name,
        content: isFolder ? '' : '',
        language: detectedLanguage,
        path: buildChildPath(parentPath, name),
        parentId: parent?.id || undefined,
        isFolder,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const id = await db.files.add(newItem)
      const updated = await db.files
        .where('threadId')
        .equals(threadId)
        .toArray()
      setFiles(updated)
      if (!isFolder) {
        setSelectedFileId(Number(id))
        setCode('')
        setLanguage(detectedLanguage)
      }
    }

    const renameItem = async (item: FileItem, newName: string) => {
      if (!item.id) return
      const oldPath = item.path
      const parentPath = item.parentId ? (files.find(f => f.id === item.parentId)?.path || '/') : '/'
      const newPath = buildChildPath(parentPath, newName)
      await db.files.update(item.id, { name: newName, path: newPath, updatedAt: Date.now() })
      if (item.isFolder) {
        // Update descendants paths
        const descendants = files.filter(f => f.path.startsWith(oldPath + '/'))
        for (const d of descendants) {
          const suffix = d.path.slice(oldPath.length)
          await db.files.update(d.id!, { path: newPath + suffix, updatedAt: Date.now() })
        }
      }
      if (threadId) {
        const updated = await db.files
          .where('threadId')
          .equals(threadId)
          .toArray()
        setFiles(updated)
      }
    }

    const deleteRecursive = async (item: FileItem) => {
      if (!item.id) return
      if (item.isFolder) {
        const descendants = files.filter(f => f.path.startsWith(item.path + '/'))
        for (const d of descendants) {
          await db.files.delete(d.id!)
        }
      }
      await db.files.delete(item.id)
      let updated: FileItem[] = []
      if (threadId) {
        updated = await db.files
          .where('threadId')
          .equals(threadId)
          .toArray()
        setFiles(updated)
      }
      if (selectedFileId === item.id) {
        const remainingFiles = updated.filter((f) => !f.isFolder)
        if (remainingFiles.length > 0 && remainingFiles[0].id) {
          setSelectedFileId(remainingFiles[0].id)
        } else {
          setSelectedFileId(null)
          setCode('')
        }
      }
    }

    const isDescendantPath = (parentPath: string, candidatePath: string) => {
      return candidatePath === parentPath || candidatePath.startsWith(parentPath + '/')
    }

    const moveItem = async (item: FileItem, newParent: FileItem | null) => {
      if (!item.id) return
      // Prevent moving a folder into itself or its descendants
      if (newParent && item.isFolder && isDescendantPath(item.path, newParent.path)) return
      const newParentPath = newParent?.path || '/'
      const newPath = buildChildPath(newParentPath, item.name)
      await db.files.update(item.id, { parentId: newParent?.id, path: newPath, updatedAt: Date.now() })
      if (item.isFolder) {
        // update descendants
        const oldPath = item.path
        const descendants = files.filter(f => f.path.startsWith(oldPath + '/'))
        for (const d of descendants) {
          const suffix = d.path.slice(oldPath.length)
          await db.files.update(d.id!, { path: newPath + suffix, updatedAt: Date.now() })
        }
      }
      setFiles(await db.files.toArray())
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

    const currentFile = files.find((f) => f.id === selectedFileId)

    // Recursive tree node component within scope to access helpers
    const TreeNode: React.FC<{ node: FileItem; depth: number }> = ({ node, depth }) => {
      const paddingLeft = 8 + depth * 12
      const children = node.isFolder ? getChildren(node.id!) : []
      const expanded = node.isFolder && node.id ? expandedFolders.has(node.id) : false
      return (
        <div className="mb-0.5">
          <div
            className={cn(
              'flex items-center gap-1.5 p-1 rounded text-xs cursor-pointer hover:bg-accent',
              selectedFileId === node.id && !node.isFolder && 'bg-accent'
            )}
            style={{ paddingLeft }}
            onClick={() => {
              if (node.isFolder && node.id) {
                setExpandedFolders((prev: Set<number>) => {
                  const next = new Set(prev)
                  if (next.has(node.id!)) next.delete(node.id!)
                  else next.add(node.id!)
                  return next
                })
              }
              else if (node.id) setSelectedFileId(node.id)
            }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/json', JSON.stringify({ id: node.id }))
              // allow move effect
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragOver={(e) => {
              // Allow dropping on folders only
              if (node.isFolder) {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }
            }}
            onDrop={async (e) => {
              if (!node.isFolder) return
              e.preventDefault()
              try {
                const data = e.dataTransfer.getData('application/json')
                const { id } = JSON.parse(data || '{}')
                const dragged = files.find(f => f.id === Number(id))
                if (!dragged) return
                // Prevent no-op drops
                if (dragged.parentId === node.id) return
                await moveItem(dragged, node)
                if (node.id) {
                  setExpandedFolders((prev: Set<number>) => new Set(prev).add(node.id!))
                }
              } catch {
                // ignore
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, targetId: node.id })
            }}
          >
            {node.isFolder ? (
              expanded ? <FolderOpen className="size-3.5" /> : <Folder className="size-3.5" />
            ) : (
              <div className="flex items-center">
                {getLanguageIcon(node.language || detectLanguageFromFileName(node.name), 14)}
              </div>
            )}
            <span className="flex-1 truncate text-xs">{node.name}</span>
            {!node.isFolder && node.id && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-5 w-5 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteRecursive(node)
                }}
              >
                <Trash2 className="size-2.5" />
              </Button>
            )}
          </div>
          {node.isFolder && expanded && (
            <div>
              {children.map((child) => (
                <TreeNode key={child.id} node={child} depth={depth + 1} />
              ))}
            </div>
          )}
        </div>
      )
    }

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
                  onClick={() => { setNewDialogType('file'); setNewDialogName(''); setShowNewDialog(true) }}
                  title="New File"
                  className="h-5 w-5"
                >
                  <File className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => { setNewDialogType('folder'); setNewDialogName(''); setShowNewDialog(true) }}
                  title="New Folder"
                  className="h-5 w-5"
                >
                  <Folder className="size-3" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1.5">
              {getChildren(null).map((node) => (
                <TreeNode key={node.id} node={node} depth={0} />
              ))}
              {getChildren(null).length === 0 && (
                <p className="text-xs text-muted-foreground p-1.5">
                  No files yet. Create one to get started!
                </p>
              )}
            </div>
          </div>
          {/* New Item Popup */}
          {showNewDialog && (
            <div className="absolute inset-0 z-50 flex items-center justify-center">
              <div className="fixed inset-0 bg-black/40" onClick={() => setShowNewDialog(false)} />
              <div className="relative bg-background border border-border rounded-md p-4 w-[320px] shadow-lg">
                <div className="mb-2 text-sm font-medium">
                  {newDialogType === 'file' ? 'Create New File' : 'Create New Folder'}
                </div>
                <div className="mb-3">
                  <Input
                    autoFocus
                    placeholder={newDialogType === 'file' ? 'e.g., main.py' : 'e.g., src'}
                    value={newDialogName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDialogName(e.target.value)}
                    onKeyDown={async (e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const name = newDialogName.trim()
                        if (!name) return
                        await createInFolder(null, name, newDialogType === 'folder')
                        setShowNewDialog(false)
                      } else if (e.key === 'Escape') {
                        e.preventDefault()
                        setShowNewDialog(false)
                      }
                    }}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowNewDialog(false)}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const name = newDialogName.trim()
                      if (!name) return
                      await createInFolder(null, name, newDialogType === 'folder')
                      setShowNewDialog(false)
                    }}
                  >
                    Create
                  </Button>
                </div>
              </div>
            </div>
          )}

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
                      disabled={isRunning || !selectedFileId}
                      className="h-7 px-2 text-xs"
                    >
                      {isRunning ? 'Running...' : 'Run'}
                    </Button>
                    {(language === 'html' || language === 'css' || language === 'javascript') && (
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
                    )}
                    <div className="flex-1" />
                    {currentFile && (
                      <span className="text-xs text-muted-foreground">
                        {currentFile.name}
                      </span>
                    )}
                  </div>

                  {/* Code Editor */}
                  <div className="flex-1 overflow-auto">
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
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="ml-auto h-6 w-6"
                      onClick={() => setShowTerminal(false)}
                      title="Close Terminal"
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <SimpleTerminal 
                      onClose={() => setShowTerminal(false)}
                      className="h-full w-full"
                      initialOutput={terminalOutput}
                    />
                  </div>
                </div>
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      {/* Context Menu */}
      {ctxMenu.visible && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setCtxMenu({ visible: false, x: 0, y: 0 })}
          onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ visible: false, x: 0, y: 0 }) }}
        >
          <div
            className="absolute bg-popover text-popover-foreground border border-border rounded-md shadow-md text-sm py-1"
            style={{ left: ctxMenu.x, top: ctxMenu.y, minWidth: 160 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-accent"
              onClick={() => {
                const target = files.find(f => f.id === ctxMenu.targetId)
                if (!target) return
                setRenameTarget(target)
                setRenameName(target.name)
                setShowRenameDialog(true)
                setCtxMenu({ visible: false, x: 0, y: 0 })
              }}
            >
              Rename
            </button>
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-accent text-red-400"
              onClick={async () => {
                const target = files.find(f => f.id === ctxMenu.targetId)
                setCtxMenu({ visible: false, x: 0, y: 0 })
                if (target) await deleteRecursive(target)
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Rename Dialog */}
      {showRenameDialog && renameTarget && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowRenameDialog(false)} />
          <div className="relative bg-background border border-border rounded-md p-4 w-[320px] shadow-lg">
            <div className="mb-2 text-sm font-medium">Rename</div>
            <div className="mb-3">
              <Input
                autoFocus
                value={renameName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRenameName(e.target.value)}
                onKeyDown={async (e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const name = renameName.trim()
                    if (!name || name === renameTarget!.name) { setShowRenameDialog(false); return }
                    await renameItem(renameTarget!, name)
                    setShowRenameDialog(false)
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setShowRenameDialog(false)
                  }
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowRenameDialog(false)}>Cancel</Button>
              <Button size="sm" onClick={async () => {
                const name = renameName.trim()
                if (!name || !renameTarget) { setShowRenameDialog(false); return }
                await renameItem(renameTarget!, name)
                setShowRenameDialog(false)
              }}>Rename</Button>
            </div>
          </div>
        </div>
      )}

      </div>
    )
  }
)

CodeEditor.displayName = 'CodeEditor'

export default CodeEditor


 
