import fg from 'fast-glob'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const ROOT = process.cwd()
const WORKSPACE_ROOT = path.join(ROOT, '.workspace')

export const globFileSchema = z
	.object({
		pattern: z.string().min(0).describe('Glob pattern (e.g. **/*.ts). Use **/* to list all files'),
		ignore: z.array(z.string()).optional().describe('Glob patterns to ignore'),
		limit: z.number().int().min(1).max(5000).optional().describe('Max results')
	})

export async function globFile({ pattern, ignore, limit }: z.infer<typeof globFileSchema>) {
	const pat = pattern || '**/*'
	const results = await fg(pat, {
		cwd: ROOT,
		ignore: [
			'**/node_modules/**',
			'**/.next/**',
			'**/.git/**',
			...(ignore ?? [])
		],
		dot: false,
		onlyFiles: true
	})
	return (limit ? results.slice(0, limit) : results)
}

export const grepFileSchema = z.object({
	pattern: z.string().min(1).describe('String or regex to search for'),
	path: z.string().optional().describe('Directory or file to scope the search'),
	glob: z.string().optional().describe('Glob to filter files'),
	multiline: z.boolean().optional().default(false),
	ignoreCase: z.boolean().optional().default(false),
	maxResults: z.number().int().min(1).max(10000).optional()
})

export async function grepFile(params: z.infer<typeof grepFileSchema>) {
	const { pattern, path: startPath, glob, multiline, ignoreCase, maxResults } = params
	const base = startPath ? (path.isAbsolute(startPath) ? startPath : path.join(ROOT, startPath)) : ROOT
	const filePatterns = glob ? [glob] : ['**/*']
	const files = await fg(filePatterns, {
		cwd: base,
		ignore: ['**/node_modules/**', '**/.next/**', '**/.git/**'],
		onlyFiles: true
	})
	const flags = `${ignoreCase ? 'i' : ''}${multiline ? 'm' : ''}`
	const regex = new RegExp(pattern, flags)
	const results: Array<{ file: string; line: number; match: string }> = []
	for (const rel of files) {
		const abs = path.join(base, rel)
		try {
			const content = await fs.readFile(abs, 'utf8')
			const lines = content.split(/\r?\n/)
			for (let i = 0; i < lines.length; i++) {
				if (regex.test(lines[i])) {
					results.push({ file: path.relative(ROOT, abs), line: i + 1, match: lines[i] })
					if (maxResults && results.length >= maxResults) return results
				}
			}
		} catch {
			// ignore unreadable files
		}
	}
	return results
}

export const readFileSchema = z.object({
	path: z.string().min(1).describe('Relative path to the file from workspace root (e.g., "main.py" or "src/utils.ts"). Do not include leading slash.')
})

export async function readFile(params: z.infer<typeof readFileSchema>, threadId?: string) {
	if (!threadId) {
		return {
			path: params.path,
			error: 'Thread ID is required. Workspace files are scoped per chat thread.',
			content: null
		}
	}
	
	const { readFileInWorkspace, listFilesInWorkspace } = await import('@/lib/workspace')
	try {
		const content = await readFileInWorkspace(params.path, threadId)
		return { 
			path: params.path, 
			content,
			size: content.length,
			lines: content.split(/\r?\n/).length
		}
	} catch (error: any) {
		// Try to suggest similar files
		let suggestions: string[] = []
		try {
			const allFiles = await listFilesInWorkspace(threadId)
			const requestedName = path.basename(params.path).toLowerCase()
			
			// Find files with similar names
			suggestions = allFiles
				.filter(f => {
					const fileName = path.basename(f).toLowerCase()
					return fileName.includes(requestedName) || requestedName.includes(fileName)
				})
				.slice(0, 5)
			
			// If no similar names, just show recent files
			if (suggestions.length === 0) {
				suggestions = allFiles.slice(0, 10)
			}
		} catch {
			// Ignore errors in suggestion gathering
		}
		
		return { 
			path: params.path, 
			error: error.message || 'File not found or could not be read',
			content: null,
			suggestions: suggestions.length > 0 ? suggestions : undefined,
			hint: suggestions.length > 0 
				? `Did you mean one of these files? Use listFiles() to see all files.`
				: 'Use listFiles() to see available files in the workspace.'
		}
	}
}

export const listFilesSchema = z.object({
	directory: z.string().optional().describe('Directory to list (relative to workspace root). Empty string or "." for root.'),
	recursive: z.boolean().optional().default(false).describe('Whether to recursively list subdirectories'),
	maxDepth: z.number().int().min(1).max(10).optional().describe('Maximum depth for recursive listing')
})

export async function listFiles(params: z.infer<typeof listFilesSchema>, threadId?: string) {
	if (!threadId) {
		return {
			directory: params.directory || '.',
			error: 'Thread ID is required. Workspace files are scoped per chat thread.',
			files: [],
			count: 0
		}
	}
	
	const { listFilesInWorkspace } = await import('@/lib/workspace')
	const { directory = '.', recursive = false, maxDepth = 5 } = params
	
	try {
		const allFiles = await listFilesInWorkspace(threadId, recursive ? undefined : directory)
		
		// Log what we found (subtle logging)
		if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TOOLS === 'true') {
			console.log(`[listFiles] Found ${allFiles.length} files in workspace for thread ${threadId?.substring(0, 8)}...`, {
				threadId,
				directory,
				recursive,
				files: allFiles.slice(0, 20), // Show first 20 files
				totalCount: allFiles.length
			})
		}
		
		if (!recursive && directory !== '.' && directory !== '') {
			// Filter to show only files in the specified directory
			const dirPath = directory.replace(/^\/+/, '').replace(/\/+$/, '')
			const dirPrefix = dirPath ? `${dirPath}/` : ''
			const filtered = allFiles
				.filter(f => f.startsWith(dirPrefix) && !f.substring(dirPrefix.length).includes('/'))
				.map(f => f.substring(dirPrefix.length || 0))
			
			return {
				directory: directory || '.',
				files: filtered,
				count: filtered.length
			}
		}
		
		return {
			directory: directory || '.',
			files: allFiles,
			count: allFiles.length
		}
	} catch (error: any) {
		// Log the error
		if (process.env.NODE_ENV === 'development' || process.env.DEBUG_TOOLS === 'true') {
			console.error(`[listFiles] Error:`, { threadId, directory, error: error.message || error })
		}
		return {
			directory: directory || '.',
			error: error.message || 'Failed to list files',
			files: [],
			count: 0
		}
	}
}

export const writeFileSchema = z.object({
	path: z.string().min(1).describe('Relative path to the file from workspace root (e.g., "main.py" or "src/utils.ts"). Do not include leading slash.'),
	content: z.string().describe('Content to write to the file')
})

export async function writeFile(params: z.infer<typeof writeFileSchema>, threadId?: string) {
	if (!threadId) {
		return {
			path: params.path,
			success: false,
			error: 'Thread ID is required. Workspace files are scoped per chat thread.'
		}
	}
	
	const { writeFileInWorkspace } = await import('@/lib/workspace')
	try {
		await writeFileInWorkspace(params.path, params.content, threadId)
		return {
			path: params.path,
			success: true,
			message: 'File written successfully'
		}
	} catch (error: any) {
		return {
			path: params.path,
			success: false,
			error: error.message || 'Failed to write file'
		}
	}
}

