// import { tool } from 'ai'
// import { z } from 'zod'
// import { grepFile, grepFileSchema } from './fs-tools'
// import { editFile, editFileSchema, multiFileEdit, multiFileEditSchema } from './edit-tools'
// import { webSearch, webSearchSchema } from './web-search'

import { z } from 'zod'
import { globFile, globFileSchema, grepFile, grepFileSchema, readFile, readFileSchema, listFiles, listFilesSchema, writeFile, writeFileSchema } from './fs-tools'
import type { ORTool } from '@/lib/openrouter'
import { logTool } from '@/lib/tool-logger'

export type ToolExecutor = (args: unknown) => Promise<unknown>

export type ToolSpec = {
	name: string
	description: string
	jsonSchema: unknown
	zodSchema: z.ZodTypeAny
	execute: ToolExecutor
}

export type ToolRegistry = Record<string, ToolSpec>

// Minimal JSON Schemas (kept in sync with zod definitions)
const globFileJsonSchema = {
	type: 'object',
	properties: {
		pattern: { type: 'string', description: 'Glob pattern (e.g. **/*.ts). Use **/* to list all files' },
		ignore: { type: 'array', items: { type: 'string' }, description: 'Glob patterns to ignore' },
		limit: { type: 'integer', minimum: 1, maximum: 5000, description: 'Max results' }
	},
	required: ['pattern'],
}

const grepFileJsonSchema = {
	type: 'object',
	properties: {
		pattern: { type: 'string', description: 'String or regex to search for' },
		path: { type: 'string', description: 'Directory or file to scope the search' },
		glob: { type: 'string', description: 'Glob to filter files' },
		multiline: { type: 'boolean' },
		ignoreCase: { type: 'boolean' },
		maxResults: { type: 'integer', minimum: 1, maximum: 10000 }
	},
	required: ['pattern'],
}

const readFileJsonSchema = {
	type: 'object',
	properties: {
		path: { 
			type: 'string', 
			description: 'Relative path to the file from workspace root (e.g., "main.py" or "src/utils.ts"). Do not include leading slash.'
		}
	},
	required: ['path'],
}

const listFilesJsonSchema = {
	type: 'object',
	properties: {
		directory: {
			type: 'string',
			description: 'Directory to list (relative to workspace root). Empty string or "." for root.'
		},
		recursive: {
			type: 'boolean',
			description: 'Whether to recursively list subdirectories'
		},
		maxDepth: {
			type: 'integer',
			minimum: 1,
			maximum: 10,
			description: 'Maximum depth for recursive listing'
		}
	},
}

const writeFileJsonSchema = {
	type: 'object',
	properties: {
		path: {
			type: 'string',
			description: 'Relative path to the file from workspace root (e.g., "main.py" or "src/utils.ts"). Do not include leading slash.'
		},
		content: {
			type: 'string',
			description: 'Content to write to the file'
		}
	},
	required: ['path', 'content'],
}

export function buildTools(threadId?: string): ToolRegistry {
	const wrapWithLogging = <T extends z.ZodTypeAny>(
		toolName: string,
		schema: T,
		executor: (args: z.infer<T>) => Promise<unknown>
	) => {
		return async (args: unknown) => {
			const startTime = Date.now()
			let parsedArgs: z.infer<T>
			let result: unknown
			let error: string | undefined
			
			try {
				parsedArgs = schema.parse(args)
				result = await executor(parsedArgs)
				const duration = Date.now() - startTime
				logTool(toolName, parsedArgs, result, undefined, duration, threadId)
				return result
			} catch (e: any) {
				error = e?.message || String(e)
				const duration = Date.now() - startTime
				logTool(toolName, args, undefined, error, duration, threadId)
				throw e
			}
		}
	}

	return {
		globFile: {
			name: 'globFile',
			description: 'List files matching a glob pattern relative to repo root',
			jsonSchema: globFileJsonSchema,
			zodSchema: globFileSchema,
			execute: wrapWithLogging('globFile', globFileSchema, globFile),
		},
		grepFile: {
			name: 'grepFile',
			description: 'Search files for a string/regex, optionally scoped to a path',
			jsonSchema: grepFileJsonSchema,
			zodSchema: grepFileSchema,
			execute: wrapWithLogging('grepFile', grepFileSchema, grepFile),
		},
		readFile: {
			name: 'readFile',
			description: 'Read the contents of a file from the workspace. Returns file content, size, and line count. If file is not found, provides suggestions for similar files.',
			jsonSchema: readFileJsonSchema,
			zodSchema: readFileSchema,
			execute: wrapWithLogging('readFile', readFileSchema, (args) => readFile(args, threadId)),
		},
		listFiles: {
			name: 'listFiles',
			description: 'List all files in the workspace directory. Use this to see what files are available before reading them. Can list files in a specific directory or recursively scan the entire workspace.',
			jsonSchema: listFilesJsonSchema,
			zodSchema: listFilesSchema,
			execute: wrapWithLogging('listFiles', listFilesSchema, (args) => listFiles(args, threadId)),
		},
		writeFile: {
			name: 'writeFile',
			description: 'Write content to a file in the workspace filesystem. This creates or overwrites a file that can then be read with readFile. Use this instead of editor.createFile if you need the file to be accessible via readFile.',
			jsonSchema: writeFileJsonSchema,
			zodSchema: writeFileSchema,
			execute: wrapWithLogging('writeFile', writeFileSchema, (args) => writeFile(args, threadId)),
		},
	}
}

export function buildORToolsFromRegistry(reg: ToolRegistry): ORTool[] {
	return Object.values(reg).map((spec) => ({
		type: 'function' as const,
		function: {
			name: spec.name,
			description: spec.description,
			parameters: spec.jsonSchema,
		},
	}))
}

// Editor tools: server-side operations on thread-scoped CodeEditorDB
// These are executed server-side, not returned as intents
import { editorReadFile, editorReadFileSchema, editorListFiles, editorListFilesSchema } from './editor-tools'

export function buildEditorTools(threadId?: string): ToolRegistry {
	const wrapWithLogging = <T extends z.ZodTypeAny>(
		toolName: string,
		schema: T,
		executor: (args: z.infer<T>) => Promise<unknown>
	) => {
		return async (args: unknown) => {
			const startTime = Date.now()
			let parsedArgs: z.infer<T>
			let result: unknown
			let error: string | undefined

			try {
				parsedArgs = schema.parse(args)
				result = await executor(parsedArgs)
				const duration = Date.now() - startTime
				logTool(toolName, parsedArgs, result, undefined, duration, threadId)
				return result
			} catch (e: any) {
				error = e?.message || String(e)
				const duration = Date.now() - startTime
				logTool(toolName, args, undefined, error, duration, threadId)
				throw e
			}
		}
	}

	return {
		editor_readFile: {
			name: 'editor_readFile',
			description: 'Read a file from the editor (thread-scoped CodeEditorDB). This is the PRIMARY way to read files created with editor_createFile. Files are scoped per chat thread.',
			jsonSchema: {
				type: 'object',
				properties: {
					path: { type: 'string', description: 'Path to the file (e.g., "/hello.py" or "hello.py")' },
				},
				required: ['path'],
			},
			zodSchema: editorReadFileSchema,
			execute: wrapWithLogging('editor_readFile', editorReadFileSchema, (args) => editorReadFile(args, threadId)),
		},
		editor_listFiles: {
			name: 'editor_listFiles',
			description: 'List all files in the editor (thread-scoped CodeEditorDB). Use this to see what files exist in the current chat thread before reading them. Files are scoped per chat thread.',
			jsonSchema: {
				type: 'object',
				properties: {
					directory: { type: 'string', description: 'Optional directory to list (defaults to root "/")' },
					recursive: { type: 'boolean', description: 'Whether to recursively list subdirectories', default: false },
				},
			},
			zodSchema: editorListFilesSchema,
			execute: wrapWithLogging('editor_listFiles', editorListFilesSchema, (args) => editorListFiles(args, threadId)),
		},
	}
}

// UI tools: intended for client execution only; server will return these tool_calls as intents
// Note: Tool names use underscores instead of dots for Anthropic compatibility
export function buildClientUITools(): ORTool[] {
	return [
		{
			type: 'function',
			function: {
				name: 'editor_setCode',
				description: 'Replace the entire editor content with optional language',
				parameters: {
					type: 'object',
					properties: {
						code: { type: 'string' },
						language: { type: 'string' }
					},
					required: ['code']
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'editor_insertCode',
				description: 'Insert code at the current cursor or specified position',
				parameters: {
					type: 'object',
					properties: {
						code: { type: 'string' },
						position: {
							type: 'object',
							properties: { line: { type: 'integer' }, column: { type: 'integer' } }
						}
					},
					required: ['code']
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'editor_createFile',
				description: 'Create a new file in the editor (thread-scoped CodeEditorDB). This is the PRIMARY tool for creating code files. Files are automatically scoped to the current chat thread. Write complete, runnable code with proper syntax.',
				parameters: {
					type: 'object',
					properties: {
						name: { type: 'string', description: 'File name (e.g., "hello.py", "main.js")' },
						language: { type: 'string', description: 'Programming language (e.g., "python", "javascript")' },
						content: { type: 'string', description: 'Complete file content with proper syntax' }
					},
					required: ['name', 'language']
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'editor_spotlight',
				description: 'Highlight specific lines of code in the editor with a visual halo effect and play a sound. Use this when you want to draw the student\'s attention to specific code for teaching or correction purposes.',
				parameters: {
					type: 'object',
					properties: {
						lineStart: { 
							type: 'integer', 
							description: 'Starting line number (1-based) to highlight',
							minimum: 1
						},
						lineEnd: { 
							type: 'integer', 
							description: 'Ending line number (1-based) to highlight. If omitted, only lineStart is highlighted.',
							minimum: 1
						},
						message: {
							type: 'string',
							description: 'Optional message to display with the highlight (for context or explanation)'
						}
					},
					required: ['lineStart']
				}
			}
		}
	]
}

