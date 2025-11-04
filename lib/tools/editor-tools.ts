import { z } from 'zod'
import { db, type FileItem } from '@/lib/db'

// Editor tools work with thread-scoped CodeEditorDB
// These are the PRIMARY file operations - simpler than workspace

export const editorReadFileSchema = z.object({
  path: z.string().describe('Path to the file (e.g., "/hello.py" or "hello.py")'),
})

export const editorListFilesSchema = z.object({
  directory: z.string().optional().describe('Optional directory to list (defaults to root "/")'),
  recursive: z.boolean().optional().default(false).describe('Whether to recursively list subdirectories'),
})

/**
 * Read a file from the editor DB (thread-scoped)
 */
export async function editorReadFile(
  params: z.infer<typeof editorReadFileSchema>,
  threadId?: string
): Promise<{ content: string; path: string; language?: string; error?: string }> {
  if (!threadId) {
    return {
      content: '',
      path: params.path,
      error: 'Thread ID is required. Files are scoped per chat thread.',
    }
  }

  try {
    // Check if IndexedDB is available (browser-only)
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      // Server-side: return error with helpful message
      return {
        content: '',
        path: params.path,
        error: 'IndexedDB not available. editor_readFile requires browser environment. Use readFile() for server-side workspace files instead.',
      }
    }

    // Normalize path (remove leading slash, ensure consistent format)
    const normalizedPath = params.path.replace(/^\/+/, '')
    
    // Search by threadId and path
    const files = await db.files
      .where('[threadId+path]')
      .equals([threadId, `/${normalizedPath}`])
      .toArray()
    
    // Also try with just the name
    if (files.length === 0) {
      const allThreadFiles = await db.files
        .where('threadId')
        .equals(threadId)
        .filter(f => !f.isFolder && (f.name === normalizedPath || f.path.endsWith(`/${normalizedPath}`)))
        .toArray()
      
      if (allThreadFiles.length > 0) {
        const file = allThreadFiles[0]
        return {
          content: file.content,
          path: file.path,
          language: file.language,
        }
      }
    } else {
      const file = files[0]
      return {
        content: file.content,
        path: file.path,
        language: file.language,
      }
    }

    // File not found - list available files
    const allFiles = await db.files
      .where('threadId')
      .equals(threadId)
      .filter(f => !f.isFolder)
      .toArray()
    
    const filePaths = allFiles.map(f => f.path).sort()
    const suggestions = filePaths
      .filter(p => p.toLowerCase().includes(normalizedPath.toLowerCase()) || normalizedPath.toLowerCase().includes(p.toLowerCase()))
      .slice(0, 5)

    return {
      content: '',
      path: params.path,
      error: `File not found: ${params.path}. Available files: ${filePaths.length > 0 ? filePaths.join(', ') : 'none'}.${suggestions.length > 0 ? ` Did you mean: ${suggestions.join(', ')}?` : ''}`,
    }
  } catch (error: any) {
    // Handle IndexedDB-specific errors gracefully
    const errorMsg = error?.message || String(error)
    if (errorMsg.includes('IndexedDB') || errorMsg.includes('indexedDB')) {
      return {
        content: '',
        path: params.path,
        error: 'IndexedDB not available. editor_readFile requires browser environment. Use readFile() for server-side workspace files instead.',
      }
    }
    return {
      content: '',
      path: params.path,
      error: `Error reading file: ${errorMsg}`,
    }
  }
}

/**
 * List files in the editor DB (thread-scoped)
 */
export async function editorListFiles(
  params: z.infer<typeof editorListFilesSchema>,
  threadId?: string
): Promise<{ files: string[]; count: number; error?: string }> {
  if (!threadId) {
    return {
      files: [],
      count: 0,
      error: 'Thread ID is required. Files are scoped per chat thread.',
    }
  }

  try {
    // Check if IndexedDB is available (browser-only)
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      // Server-side: return empty list with helpful error
      return {
        files: [],
        count: 0,
        error: 'IndexedDB not available. editor_listFiles requires browser environment. Use listFiles() for server-side workspace files instead.',
      }
    }

    let files = await db.files
      .where('threadId')
      .equals(threadId)
      .filter(f => !f.isFolder)
      .toArray()

    // Filter by directory if specified
    if (params.directory && params.directory !== '.' && params.directory !== '/') {
      const dirPath = params.directory.replace(/^\/+/, '').replace(/\/+$/, '') + '/'
      files = files.filter(f => f.path.startsWith(`/${dirPath}`))
    }

    const filePaths = files.map(f => f.path).sort()

    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TOOLS === 'true') {
      console.log(`[editor_listFiles] Found ${filePaths.length} files for thread ${threadId?.substring(0, 8)}...`, {
        threadId,
        directory: params.directory,
        files: filePaths.slice(0, 20), // Show first 20 files
        totalCount: filePaths.length,
      })
    }

    return {
      files: filePaths,
      count: filePaths.length,
    }
  } catch (error: any) {
    // Handle IndexedDB-specific errors gracefully
    const errorMsg = error?.message || String(error)
    if (errorMsg.includes('IndexedDB') || errorMsg.includes('indexedDB')) {
      return {
        files: [],
        count: 0,
        error: 'IndexedDB not available. editor_listFiles requires browser environment. Use listFiles() for server-side workspace files instead.',
      }
    }
    return {
      files: [],
      count: 0,
      error: `Error listing files: ${errorMsg}`,
    }
  }
}

