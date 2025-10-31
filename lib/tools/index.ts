// import { tool } from 'ai'
// import { z } from 'zod'
// import { grepFile, grepFileSchema } from './fs-tools'
// import { editFile, editFileSchema, multiFileEdit, multiFileEditSchema } from './edit-tools'
// import { webSearch, webSearchSchema } from './web-search'

import { z } from 'zod'
import { globFile, globFileSchema, grepFile, grepFileSchema } from './fs-tools'
import type { ORTool } from '@/lib/openrouter'

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

export function buildTools(): ToolRegistry {
	return {
		globFile: {
			name: 'globFile',
			description: 'List files matching a glob pattern relative to repo root',
			jsonSchema: globFileJsonSchema,
			zodSchema: globFileSchema,
			execute: async (args: unknown) => globFile(globFileSchema.parse(args)),
		},
		grepFile: {
			name: 'grepFile',
			description: 'Search files for a string/regex, optionally scoped to a path',
			jsonSchema: grepFileJsonSchema,
			zodSchema: grepFileSchema,
			execute: async (args: unknown) => grepFile(grepFileSchema.parse(args)),
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
				description: 'Create a new file in the editor/files db',
				parameters: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						language: { type: 'string' },
						content: { type: 'string' }
					},
					required: ['name', 'language']
				}
			}
		},
		{
			type: 'function',
			function: {
				name: 'editor_runCode',
				description: 'Run the current file in the editor terminal',
				parameters: { type: 'object', properties: {}, additionalProperties: false }
			}
		},
		{
			type: 'function',
			function: {
				name: 'terminal_write',
				description: 'Open terminal if needed and write a line of output',
				parameters: {
					type: 'object',
					properties: { text: { type: 'string' } },
					required: ['text']
				}
			}
		}
	]
}

