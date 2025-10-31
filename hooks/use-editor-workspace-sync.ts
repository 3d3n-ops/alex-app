'use client'

import { useEffect, useRef } from 'react'
import { db, type FileItem } from '@/lib/db'
import { ClientWorkspace } from '@/lib/workspace-db'

/**
 * Syncs CodeEditorDB (editor files) with WorkspaceDB (agent workspace)
 * 
 * Flow:
 * 1. Editor changes → Sync to WorkspaceDB and server cache
 * 2. Workspace changes (from tools) → Sync to CodeEditorDB
 */

export function useEditorWorkspaceSync(threadId: string | undefined, enabled: boolean = true) {
  const workspaceRef = useRef<ClientWorkspace | null>(null)
  const lastSyncRef = useRef<number>(0)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!threadId || !enabled) return

    workspaceRef.current = new ClientWorkspace(threadId)

    // Convert editor path to workspace path
    const editorToWorkspacePath = (editorPath: string): string => {
      // Editor: /hello.py -> Workspace: hello.py
      return editorPath.replace(/^\/+/, '')
    }

    // Convert workspace path to editor path
    const workspaceToEditorPath = (workspacePath: string): string => {
      // Workspace: hello.py -> Editor: /hello.py
      return '/' + workspacePath.replace(/^\/+/, '')
    }

    // Sync editor files → workspace
    const syncEditorToWorkspace = async () => {
      try {
        const editorFiles = await db.files.toArray()
        const nonFolderFiles = editorFiles.filter(f => !f.isFolder)

        for (const file of nonFolderFiles) {
          const workspacePath = editorToWorkspacePath(file.path)
          try {
            // Write to workspace IndexedDB
            await workspaceRef.current!.writeFile(workspacePath, file.content)
            // Also sync to server cache via API
            try {
              await fetch('/api/workspace', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  threadId,
                  path: workspacePath,
                  content: file.content
                })
              })
            } catch (error) {
              // Silently fail - the IndexedDB write succeeded
            }
          } catch (error) {
            console.warn(`[Editor-Workspace Sync] Failed to sync ${file.path}:`, error)
          }
        }

        // Find files deleted in editor and remove from workspace
        const workspaceFiles = await workspaceRef.current!.listFiles()
        const editorPaths = new Set(nonFolderFiles.map(f => editorToWorkspacePath(f.path)))
        
        for (const workspacePath of workspaceFiles) {
          if (!editorPaths.has(workspacePath)) {
            // File exists in workspace but not in editor - delete from workspace
            // This handles the case where user deletes a file in the editor
            try {
              await workspaceRef.current!.deleteFile(workspacePath)
              // Also delete from server cache via API
              await fetch(`/api/workspace?threadId=${encodeURIComponent(threadId)}&path=${encodeURIComponent(workspacePath)}`, {
                method: 'DELETE'
              })
              
              if (process.env.NODE_ENV === 'development' || (typeof process !== 'undefined' && process.env?.DEBUG_TOOLS === 'true')) {
                console.log(`[Editor-Workspace Sync] Deleted ${workspacePath} from workspace (was deleted in editor)`)
              }
            } catch (error) {
              console.warn(`[Editor-Workspace Sync] Failed to delete ${workspacePath} from workspace:`, error)
            }
          }
        }

        if (process.env.NODE_ENV === 'development' || (typeof process !== 'undefined' && process.env?.DEBUG_TOOLS === 'true')) {
          console.log(`[Editor-Workspace Sync] Synced ${nonFolderFiles.length} editor files to workspace`)
        }
      } catch (error) {
        console.error(`[Editor-Workspace Sync] Error syncing editor to workspace:`, error)
      }
    }

    // Sync workspace files → editor (for files created by tools)
    const syncWorkspaceToEditor = async () => {
      try {
        const workspaceFiles = await workspaceRef.current!.listFiles()
        const editorFiles = await db.files.toArray()
        const editorPaths = new Set(editorFiles.map(f => editorToWorkspacePath(f.path)))

        for (const workspacePath of workspaceFiles) {
          // Only add to editor if it doesn't already exist
          if (!editorPaths.has(workspacePath)) {
            try {
              const content = await workspaceRef.current!.readFile(workspacePath)
              const editorPath = workspaceToEditorPath(workspacePath)
              const name = workspacePath.split('/').pop() || workspacePath
              
              // Detect language from extension
              const ext = name.split('.').pop()?.toLowerCase() || ''
              const langMap: Record<string, string> = {
                'py': 'python',
                'js': 'javascript',
                'ts': 'typescript',
                'tsx': 'typescript',
                'jsx': 'javascript',
                'json': 'json',
                'md': 'markdown',
                'html': 'html',
                'css': 'css',
                'rs': 'rust',
                'go': 'go',
                'java': 'java',
                'cpp': 'cpp',
                'c': 'c',
              }
              const language = langMap[ext] || 'plaintext'

              // Create in editor
              const newFile: FileItem = {
                name,
                content,
                language,
                path: editorPath,
                isFolder: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }
              await db.files.add(newFile)

              if (process.env.NODE_ENV === 'development' || (typeof process !== 'undefined' && process.env?.DEBUG_TOOLS === 'true')) {
                console.log(`[Editor-Workspace Sync] Added workspace file to editor: ${workspacePath}`)
              }
            } catch (error) {
              console.warn(`[Editor-Workspace Sync] Failed to add workspace file ${workspacePath} to editor:`, error)
            }
          }
        }
      } catch (error) {
        console.error(`[Editor-Workspace Sync] Error syncing workspace to editor:`, error)
      }
    }

    // Initial sync
    syncEditorToWorkspace()

    // Periodic sync (every 2 seconds to keep things in sync)
    pollingIntervalRef.current = setInterval(() => {
      const now = Date.now()
      // Only sync if at least 2 seconds have passed since last sync
      if (now - lastSyncRef.current > 2000) {
        syncEditorToWorkspace()
        syncWorkspaceToEditor()
        lastSyncRef.current = now
      }
    }, 2000)

    // Also sync when editor DB changes (if Dexie supports hooks)
    // For now, we rely on polling

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [threadId, enabled])
}

/**
 * Helper to sync a specific editor file to workspace immediately
 */
export async function syncEditorFileToWorkspace(threadId: string, editorFile: FileItem) {
  const workspace = new ClientWorkspace(threadId)
  const workspacePath = editorFile.path.replace(/^\/+/, '')
  
  try {
    await workspace.writeFile(workspacePath, editorFile.content)
    // Also sync to server cache via API
    await fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId,
        path: workspacePath,
        content: editorFile.content
      })
    })
  } catch (error) {
    console.warn(`[Editor-Workspace Sync] Failed to sync file ${editorFile.path}:`, error)
  }
}

/**
 * Helper to remove a file from workspace when deleted in editor
 */
export async function removeEditorFileFromWorkspace(threadId: string, editorPath: string) {
  const workspace = new ClientWorkspace(threadId)
  const workspacePath = editorPath.replace(/^\/+/, '')
  
  try {
    await workspace.deleteFile(workspacePath)
    // Also delete from server cache via API
    await fetch(`/api/workspace?threadId=${encodeURIComponent(threadId)}&path=${encodeURIComponent(workspacePath)}`, {
      method: 'DELETE'
    })
  } catch (error) {
    console.warn(`[Editor-Workspace Sync] Failed to remove file ${editorPath} from workspace:`, error)
  }
}

