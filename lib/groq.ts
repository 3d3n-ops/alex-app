export type GRMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }

export type GRTool = {
	type: 'function'
	function: {
		name: string
		description?: string
		parameters: unknown
	}
}

export interface GroqChatParams {
	model: string
	messages: GRMessage[]
	tools?: GRTool[]
	temperature?: number
	maxTokens?: number
}

// Create a streaming Response that proxies Groq SSE chunks to the client
export async function streamGroqChat(params: GroqChatParams): Promise<Response> {
	const { model, messages, tools, temperature = 0.3, maxTokens } = params
	const apiKey = process.env.GROQ_API_KEY
	if (!apiKey) {
		return new Response('Missing GROQ_API_KEY', { status: 500 })
	}
	const body = {
		model,
		messages,
		stream: true,
		temperature,
		max_tokens: maxTokens,
		tools: tools && tools.length > 0 ? tools : undefined
	}
	const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		},
		body: JSON.stringify(body)
	})

	if (!res.ok || !res.body) {
		const text = await res.text().catch(() => '')
		return new Response(`Groq error: ${res.status} ${text}`, { status: 500 })
	}

	const stream = new ReadableStream({
		start(controller) {
			const reader = res.body!.getReader()
			const decoder = new TextDecoder()
			const encoder = new TextEncoder()

			function push() {
				reader.read().then(({ done, value }) => {
					if (done) {
						controller.close()
						return
					}
					controller.enqueue(encoder.encode(decoder.decode(value)))
					push()
				}).catch((err) => {
					controller.error(err)
				})
			}
			push()
		}
	})

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			'Connection': 'keep-alive'
		}
	})
}

// Non-streaming one-off chat completion (supports tools)
export async function groqChatOnce(params: GroqChatParams): Promise<any> {
	const { model, messages, tools, temperature = 0.3, maxTokens } = params
	const apiKey = process.env.GROQ_API_KEY
	if (!apiKey) {
		throw new Error('Missing GROQ_API_KEY')
	}
	const body = {
		model,
		messages,
		stream: false,
		temperature,
		max_tokens: maxTokens,
		tools: tools && tools.length > 0 ? tools : undefined
	}
	const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
		},
		body: JSON.stringify(body)
	})

	if (!res.ok) {
		const text = await res.text().catch(() => '')
		throw new Error(`Groq error: ${res.status} ${text}`)
	}
	return await res.json()
}

export function defaultGroqModel(input?: string) {
	const p = (input || '').toLowerCase()
	if (p.includes('70b')) return 'llama-3.1-70b-versatile'
	if (p.includes('8x7b') || p.includes('mixtral')) return 'mixtral-8x7b-32768'
	return 'llama-3.1-70b-versatile'
}


