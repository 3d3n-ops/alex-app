// import { tool } from 'ai'
// import { z } from 'zod'
// import { grepFile, grepFileSchema } from './fs-tools'
// import { editFile, editFileSchema, multiFileEdit, multiFileEditSchema } from './edit-tools'
// import { webSearch, webSearchSchema } from './web-search'

import { z } from 'zod'
import { globFile, globFileSchema, grepFile, grepFileSchema, readFile, readFileSchema, listFiles, listFilesSchema, writeFile, writeFileSchema } from './fs-tools'
import { todos, todosSchema } from './todo-tools'
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

const todosJsonSchema = {
	type: 'object',
	properties: {
		merge: {
			type: 'boolean',
			description: 'If true, merge with existing todos (update existing by ID, add new ones). If false, replace all todos.'
		},
		todos: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: {
						type: 'string',
						description: 'Unique identifier for the todo item'
					},
					content: {
						type: 'string',
						description: 'Description of the task'
					},
					status: {
						type: 'string',
						enum: ['pending', 'in_progress', 'completed', 'cancelled'],
						description: 'Current status of the todo'
					}
				},
				required: ['id', 'content', 'status']
			},
			description: 'Array of todo items to create or update'
		}
	},
	required: ['merge', 'todos'],
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
		todos: {
			name: 'todos',
			description: 'Create or update a todo list to track multi-step tasks. ONLY use this AFTER asking the user clarifying questions to understand their goals. Once created, work through todos recursively one by one until all are completed. Each todo has an id, content, and status (pending, in_progress, completed, cancelled). Use merge=true to update existing todos. Use merge=false ONLY when creating the initial todo list after understanding user goals. CRITICAL: Before creating a new todo list, check if there are existing incomplete todos - if so, complete those first.',
			jsonSchema: todosJsonSchema,
			zodSchema: todosSchema,
			execute: wrapWithLogging('todos', todosSchema, (args) => todos(args, threadId)),
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
			description: 'Read a file from the editor (thread-scoped CodeEditorDB). Use this to read files that were created with editor_createFile. Files are scoped per chat thread. Use this when you need to see the current content of a file before editing it.',
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
			description: 'Search for and list files in the editor (thread-scoped CodeEditorDB). Use this to see what code files exist in the current chat thread. This is the PRIMARY tool for finding files. Use this before reading or editing files to see what\'s available.',
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
				name: 'editor_createFile',
				description: 'Create a new code file in the editor. This is the PRIMARY tool for writing new files. Files are automatically scoped to the current chat thread. CRITICAL: Always provide complete, runnable code with proper syntax. Never create empty files or files with just a filename - always include meaningful code content. Use this when the user asks you to create a new file or when you need to demonstrate code examples.',
				parameters: {
					type: 'object',
					properties: {
						name: { 
							type: 'string', 
							description: 'File name with extension (e.g., "hello.py", "main.js", "app.tsx"). Must be a code file, not a plain text file.' 
						},
						language: { 
							type: 'string', 
							description: 'Programming language (e.g., "python", "javascript", "typescript", "java", "cpp")' 
						},
						content: { 
							type: 'string', 
							description: 'REQUIRED: Complete file content with proper syntax. Never leave this empty. Always write meaningful, runnable code.' 
						}
					},
					required: ['name', 'language', 'content']
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'editor_editFile',
				description: 'Edit an existing file in the editor. Use this to modify code in files that were created with editor_createFile. First use editor_readFile to see the current content, then use this tool to update it. Provide the complete updated file content.',
				parameters: {
					type: 'object',
					properties: {
						path: { 
							type: 'string', 
							description: 'Path to the file to edit (e.g., "/hello.py" or "hello.py"). Must be a file that exists in the editor.' 
						},
						content: { 
							type: 'string', 
							description: 'REQUIRED: Complete updated file content. Replace the entire file with the new content.' 
						}
					},
					required: ['path', 'content']
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'editor_listFiles',
				description: 'Search for files in the editor. Use this to find what code files exist before reading or editing them. This is the PRIMARY tool for discovering files in the current chat thread.',
				parameters: {
					type: 'object',
					properties: {
						directory: { 
							type: 'string', 
							description: 'Optional directory to search (defaults to root "/")' 
						},
						recursive: { 
							type: 'boolean', 
							description: 'Whether to recursively search subdirectories', 
							default: false 
						}
					}
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'editor_spotlight',
				description: 'Highlight specific lines of code in the editor with a visual effect and sound. Use this to draw attention to important code for teaching, pointing out errors, or explaining concepts. Use after explaining code or when you want to focus the student\'s attention on specific lines.',
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

