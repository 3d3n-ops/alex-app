import fs from 'node:fs/promises'
import path from 'node:path'
import { z } from 'zod'

const ROOT = process.cwd()

export const editFileSchema = z.object({
	file: z.string().min(1),
	find: z.string().min(1),
	replace: z.string().default(''),
	previewOnly: z.boolean().optional()
})

export async function editFile(args: z.infer<typeof editFileSchema>) {
	const abs = path.isAbsolute(args.file) ? args.file : path.join(ROOT, args.file)
	const before = await fs.readFile(abs, 'utf8')
	const idx = before.indexOf(args.find)
	if (idx === -1) {
		return { file: path.relative(ROOT, abs), changed: false, message: 'Find string not found' }
	}
	const after = before.slice(0, idx) + args.replace + before.slice(idx + args.find.length)
	if (!args.previewOnly) {
		await fs.writeFile(abs, after, 'utf8')
	}
	return {
		file: path.relative(ROOT, abs),
		changed: !args.previewOnly,
		diffPreview: `--- a\n+++ b\n...`,
		bytesChanged: Math.abs(after.length - before.length)
	}
}

export const multiFileEditSchema = z.object({
	edits: z.array(
		z.object({ file: z.string(), find: z.string(), replace: z.string().default('') })
	),
	previewOnly: z.boolean().optional()
})

export async function multiFileEdit(args: z.infer<typeof multiFileEditSchema>) {
	const results = [] as Array<{ file: string; changed: boolean; message?: string }>
	for (const e of args.edits) {
		const r = await editFile({ ...e, previewOnly: args.previewOnly })
		results.push(r)
	}
	return { count: results.length, results }
}

