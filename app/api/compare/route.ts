import { loadAgentConfig, normalizeAgent, type AgentId } from '@/lib/agents'
import { buildClientUITools, buildORToolsFromRegistry, buildTools } from '@/lib/tools'
import { openRouterChatOnce, type ORMessage, type ORTool } from '@/lib/openrouter'
import { groqChatOnce, defaultGroqModel } from '@/lib/groq'

export const runtime = 'nodejs'

type CompareBody = {
	agent?: AgentId
	messages?: ORMessage[]
	enableTools?: boolean
	clientIntents?: boolean
	groqModel?: string
	openrouterModel?: string
	trials?: number
}

type ProviderResult = {
	provider: 'groq' | 'openrouter'
	model: string
	durationMs: number
	content: string
	toolCalls: any[]
}

export async function POST(req: Request) {
	const body = (await req.json().catch(() => ({}))) as CompareBody
	const agent: AgentId = normalizeAgent(body.agent)
	const enableTools: boolean = Boolean(body.enableTools)
	const clientIntents: boolean = Boolean(body.clientIntents)
	const trials = Math.max(1, Math.min(5, Number(body.trials) || 1))

	const { systemPrompt } = await loadAgentConfig(agent)
	const baseMessages: ORMessage[] = Array.isArray(body.messages) ? body.messages : []
	const seedMessages: ORMessage[] = [{ role: 'system', content: systemPrompt }, ...baseMessages]

	if (clientIntents) {
		const uiTools = buildClientUITools()
		const [openrouterOnce, groqOnce] = [
			async () => openRouterChatOnce({ model: body.openrouterModel || 'openai/gpt-5', messages: seedMessages, tools: uiTools, temperature: 0.2, maxTokens: 1200 }),
			async () => groqChatOnce({ model: defaultGroqModel(body.groqModel), messages: seedMessages, tools: uiTools, temperature: 0.2, maxTokens: 1200 }),
		]
		const [orStart, orRes] = await timeIt(openrouterOnce)
		const [grStart, grRes] = await timeIt(groqOnce)

		const orMsg = orRes?.choices?.[0]?.message
		const grMsg = grRes?.choices?.[0]?.message
		return json({
			mode: 'clientIntents',
			results: [
				{
					provider: 'openrouter',
					model: body.openrouterModel || 'openai/gpt-5',
					durationMs: Date.now() - orStart,
					content: orMsg?.content || '',
					toolCalls: Array.isArray(orMsg?.tool_calls) ? orMsg.tool_calls : []
				},
				{
					provider: 'groq',
					model: defaultGroqModel(body.groqModel),
					durationMs: Date.now() - grStart,
					content: grMsg?.content || '',
					toolCalls: Array.isArray(grMsg?.tool_calls) ? grMsg.tool_calls : []
				}
			]
		})
	}

	const registry = enableTools ? buildTools() : undefined
	const tools: ORTool[] | undefined = registry ? buildORToolsFromRegistry(registry) : undefined

	async function runToolLoop(chatOnce: (args: { model: string; messages: ORMessage[]; tools?: ORTool[]; temperature?: number; maxTokens?: number }) => Promise<any>, model: string): Promise<ProviderResult> {
		const start = Date.now()
		let turnMessages: ORMessage[] = [...seedMessages]
		const maxTurns = enableTools ? 4 : 1
		for (let i = 0; i < maxTurns; i++) {
			const resJson = await chatOnce({ model, messages: turnMessages, tools, temperature: 0.2, maxTokens: 1200 })
			const msg = resJson?.choices?.[0]?.message
			const assistantContent: string = msg?.content || ''
			const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : []
			if (!enableTools || toolCalls.length === 0) {
				return { provider: model.includes('/') ? 'openrouter' as const : 'groq', model, durationMs: Date.now() - start, content: assistantContent, toolCalls }
			}
			// Execute tools and append results
			turnMessages.push({ role: 'assistant', content: assistantContent || '' })
			for (const call of toolCalls) {
				const name: string | undefined = call?.function?.name || call?.name
				const argsRaw: string | object | undefined = call?.function?.arguments || call?.arguments
				const spec = name && registry ? registry[name] : undefined
				if (!name || !spec) {
					turnMessages.push({ role: 'tool', content: `Tool not found: ${name || 'unknown'}` })
					continue
				}
				let parsed: unknown = {}
				try {
					const asObj = typeof argsRaw === 'string' ? JSON.parse(argsRaw) : (argsRaw || {})
					parsed = spec.zodSchema.parse(asObj)
				} catch (e: any) {
					turnMessages.push({ role: 'tool', content: `Invalid args for ${name}: ${String(e?.message || e)}` })
					continue
				}
				try {
					const out = await spec.execute(parsed)
					turnMessages.push({ role: 'tool', content: JSON.stringify(out) })
				} catch (e: any) {
					turnMessages.push({ role: 'tool', content: `Error executing ${name}: ${String(e?.message || e)}` })
				}
			}
		}
		return { provider: model.includes('/') ? 'openrouter' as const : 'groq', model, durationMs: Date.now() - start, content: '', toolCalls: [] }
	}

	const orModel = body.openrouterModel || 'openai/gpt-5'
	const grModel = defaultGroqModel(body.groqModel)

	const results: ProviderResult[] = []
	for (let i = 0; i < trials; i++) {
		const [orRes, grRes] = await Promise.all([
			runToolLoop(openRouterChatOnce, orModel),
			runToolLoop(groqChatOnce as any, grModel),
		])
		results.push({ ...orRes, provider: 'openrouter' }, { ...grRes, provider: 'groq' })
	}

	return json({ mode: enableTools ? 'serverTools' : 'noTools', trials, results })
}

function json(data: unknown, init?: ResponseInit) {
	return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' }, ...init })
}

async function timeIt<T>(fn: () => Promise<T>): Promise<[number, T]> {
	const start = Date.now()
	const res = await fn()
	return [start, res]
}


