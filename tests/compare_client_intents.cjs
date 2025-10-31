'use strict'

// Benchmark Groq vs OpenRouter in clientIntents mode (no server tool execution)
// Requires the Next.js dev/server to be running (default: http://localhost:3000)

const endpoint = 'http://localhost:3000'

async function main() {
	const agent = 'alexTutor'
	const trials = 1
	const groqModel = 'llama-3.1-70b-versatile'
	const openrouterModel = 'openai/gpt-5'
	const userPrompt = 'Summarize this repo in 3 concise bullets.'

	const body = {
		agent,
		messages: [{ role: 'user', content: userPrompt }],
		clientIntents: true,
		trials,
		groqModel,
		openrouterModel
	}

	const url = `${endpoint}/api/compare`
	const started = Date.now()
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	})
	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(`Compare request failed: ${res.status} ${text}`)
	}
	const data = await res.json()

	console.log('\nMode:', data.mode)
	console.log('Trials:', data.trials)
	console.log('Prompt:', userPrompt)
	console.log('')

	const results = Array.isArray(data.results) ? data.results : []
	printResults(results)

	console.log(`\nTotal request time: ${Date.now() - started} ms`)
}

function printResults(results) {
	const grouped = groupBy(results, r => r.provider)
	for (const provider of Object.keys(grouped)) {
		console.log(`Provider: ${provider}`)
		const rows = grouped[provider]
		const times = rows.map(r => r.durationMs)
		const avg = Math.round(times.reduce((a, b) => a + b, 0) / Math.max(1, times.length))
		console.log(`  Model: ${rows[0]?.model}`)
		console.log(`  Avg latency: ${avg} ms  (runs: ${times.length})`)
		console.log('  Sample content:')
		console.log(indent(trimSample(rows[0]?.content || ''), 4))
		console.log('')
	}
}

function indent(text, spaces) {
	const pad = ' '.repeat(spaces)
	return String(text).split('\n').map(l => pad + l).join('\n')
}

function trimSample(text, maxLen = 500) {
	const t = String(text || '')
	return t.length > maxLen ? t.slice(0, maxLen) + '…' : t
}

function groupBy(arr, keyFn) {
	return arr.reduce((acc, item) => {
		const k = keyFn(item)
		acc[k] ||= []
		acc[k].push(item)
		return acc
	}, {})
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})


