import fg from 'fast-glob'
import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const ROOT = process.cwd()

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

