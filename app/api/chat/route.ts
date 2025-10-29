import { streamText } from 'ai'
import { getModel } from '@/lib/models'
import { buildTools } from '@/lib/tools'
import { loadAgentConfig, normalizeAgent, type AgentId } from '@/lib/agents'

export const runtime = 'nodejs'

export async function POST(req: Request) {
	const body = await req.json().catch(() => ({}))
	const agent: AgentId = normalizeAgent(body.agent)
	const provider: string | undefined = body.provider || body.modelProvider
	const messages = Array.isArray(body.messages) ? body.messages : []

	const { systemPrompt } = await loadAgentConfig(agent)
	const model = getModel(provider as any)
	const tools = buildTools()

	const result = await streamText({
		model,
		system: systemPrompt,
		messages,
		maxTokens: 2000,
		temperature: 0.3,
		tools
	})

	return result.toDataStreamResponse()
}

