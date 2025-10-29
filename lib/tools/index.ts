import { tool } from 'ai'
import { z } from 'zod'
import { globFile, globFileSchema, grepFile, grepFileSchema } from './fs-tools'
import { editFile, editFileSchema, multiFileEdit, multiFileEditSchema } from './edit-tools'
import { webSearch, webSearchSchema } from './web-search'

export function buildTools() {
	return {
		globFile: tool({
			parameters: globFileSchema,
			description: 'List or inspect files and directories within the project workspace.',
			execute: globFile
		}),
		grepFile: tool({
			parameters: grepFileSchema,
			description: 'Search project files for a string or regex pattern to locate code or references.',
			execute: grepFile
		}),
		editFile: tool({
			parameters: editFileSchema,
			description: 'Apply minimal edits to a single file with clean diffs.',
			execute: editFile
		}),
		multi_fileEdit: tool({
			parameters: multiFileEditSchema,
			description: 'Apply coordinated edits across multiple files for scaffolds or refactors.',
			execute: multiFileEdit
		}),
		webSearch: tool({
			parameters: webSearchSchema,
			description: 'Search web for docs/examples (requires SEARCH_API_URL/KEY).',
			execute: webSearch
		})
	}
}

