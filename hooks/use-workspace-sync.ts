'use client'

import { useEffect, useRef } from 'react'
import { workspaceDb, ClientWorkspace } from '@/lib/workspace-db'

/**
 * Hook to sync workspace between IndexedDB and server cache
 * 
 * Flow:
 * 1. On thread load: IndexedDB → Server cache (so tools can read files)
 * 2. Poll server cache for new files: Server cache → IndexedDB (so files persist)
 * 
 * This ensures readFile can access files stored in IndexedDB
 */
export function useWorkspaceSync(threadId: string | undefined) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!threadId) return

    const workspace = new ClientWorkspace(threadId)

    // Initial sync: IndexedDB → Server cache
    const syncToServer = async () => {
      try {
        const files = await workspace.listFiles()
        
        // Upload each file from IndexedDB to server cache (silently)
        for (const filePath of files) {
          try {
            const content = await workspace.readFile(filePath)
            await fetch('/api/workspace', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                threadId,
                path: filePath,
                content
              })
            })
          } catch (error) {
            // Only log errors, not every sync operation
            console.warn(`[Workspace Sync] Failed to sync file ${filePath} to server:`, error)
          }
        }
      } catch (error) {
        console.error(`[Workspace Sync] Error syncing to server:`, error)
      }
    }

    // Periodic sync: Server cache → IndexedDB (for files written by tools)
    const syncFromServer = async () => {
      try {
        const res = await fetch('/api/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, directory: '.' })
        })
        
        if (res.ok) {
          const data = await res.json()
          const serverFiles = data.files || []
          
          // Check each server file and sync to IndexedDB if missing or different
          for (const filePath of serverFiles) {
            try {
              const fileRes = await fetch(`/api/workspace?threadId=${encodeURIComponent(threadId)}&path=${encodeURIComponent(filePath)}`)
              if (fileRes.ok) {
                const fileData = await fileRes.json()
                const serverContent = fileData.content
                
                // Check if file exists in IndexedDB and if content differs
                const exists = await workspace.fileExists(filePath)
                if (!exists) {
                  // New file from server, write to IndexedDB
                  await workspace.writeFile(filePath, serverContent)
                } else {
                  // Check if content changed (optional optimization - could skip for performance)
                  const localContent = await workspace.readFile(filePath).catch(() => null)
                  if (localContent !== serverContent) {
                    await workspace.writeFile(filePath, serverContent)
                  }
                }
              }
            } catch (error) {
              console.warn(`Failed to sync file ${filePath} from server:`, error)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to sync from server:', error)
      }
    }

    // Initial sync
    syncToServer()

    // Poll server every 2 seconds for new files written by tools
    intervalRef.current = setInterval(syncFromServer, 2000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [threadId])
}


