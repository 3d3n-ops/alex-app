import { z } from 'zod'

export const webSearchSchema = z.object({
	query: z.string().min(3),
	maxResults: z.number().int().min(1).max(10).optional()
})

export async function webSearch(args: z.infer<typeof webSearchSchema>) {
	const api = process.env.SEARCH_API_URL
	const key = process.env.SEARCH_API_KEY
	if (!api || !key) {
		return {
			message:
				'Web search not configured. Set SEARCH_API_URL and SEARCH_API_KEY to enable external search.',
			query: args.query
		}
	}
	const url = `${api}?q=${encodeURIComponent(args.query)}&n=${args.maxResults ?? 5}`
	const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })
	if (!res.ok) {
		return { message: `Search failed: ${res.status}`, query: args.query }
	}
	const data = await res.json()
	return { query: args.query, results: data.results ?? data }
}

