import { loadAgentConfig, normalizeAgent, type AgentId } from '@/lib/agents'
import { streamOpenRouterChat, mapProviderToModel, type ORMessage, openRouterChatOnce } from '@/lib/openrouter'
import { buildTools, buildORToolsFromRegistry, buildClientUITools } from '@/lib/tools'

export const runtime = 'nodejs'

export async function POST(req: Request) {
	const body = await req.json().catch(() => ({}))
	const agent: AgentId = normalizeAgent(body.agent)
	const provider: string | undefined = body.provider || body.modelProvider
	const messages = Array.isArray(body.messages) ? body.messages : []
  const enableTools: boolean = Boolean(body.enableTools)
  const clientIntents: boolean = Boolean(body.clientIntents)

	const { systemPrompt } = await loadAgentConfig(agent)
	const orMessages: ORMessage[] = [
		{ role: 'system', content: systemPrompt },
		...messages
	]
  const model = mapProviderToModel(provider)

  if (!enableTools && !clientIntents) {
    return await streamOpenRouterChat({
      model,
      messages: orMessages,
      maxTokens: 2000,
      temperature: 0.3,
    })
  }

  if (clientIntents) {
    // UI intent path: do not execute tools on server; return tool calls as intents JSON
    const uiTools = buildClientUITools()
    const resJson = await openRouterChatOnce({ model, messages: orMessages, tools: uiTools, temperature: 0.2, maxTokens: 1200 })
    const choice = resJson?.choices?.[0]
    const msg = choice?.message
    const assistantContent: string = msg?.content || ''
    const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : []
    const intents = toolCalls.map((c: any) => ({
      name: c?.function?.name || c?.name,
      args: (() => { try { return JSON.parse(c?.function?.arguments || c?.arguments || '{}') } catch { return {} } })()
    }))
    return new Response(JSON.stringify({ content: assistantContent, toolIntents: intents }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Tool-enabled loop (non-stream with a synthetic SSE response)
  const registry = buildTools()
  const orTools = buildORToolsFromRegistry(registry)

  let turnMessages: ORMessage[] = [...orMessages]
  const maxTurns = 4
  for (let i = 0; i < maxTurns; i++) {
    const resJson = await openRouterChatOnce({ model, messages: turnMessages, tools: orTools, temperature: 0.2, maxTokens: 1200 })
    const choice = resJson?.choices?.[0]
    const msg = choice?.message
    const assistantContent: string = msg?.content || ''
    const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : []

    if (toolCalls.length === 0) {
      // No tool calls -> finalize; return as SSE with one delta followed by DONE
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          const send = (data: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          send({ choices: [{ delta: { content: assistantContent } }] })
          send('[DONE]')
          controller.close()
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

    // Execute tool calls and append tool results
    turnMessages.push({ role: 'assistant', content: assistantContent || '' })
    for (const call of toolCalls) {
      const name: string | undefined = call?.function?.name || call?.name
      const argsRaw: string | object | undefined = call?.function?.arguments || call?.arguments
      const spec = name ? registry[name] : undefined
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

  // Safety fallback if tool loop exceeded
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      send({ choices: [{ delta: { content: 'Tool loop exceeded without final answer.' } }] })
      send('[DONE]')
      controller.close()
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

