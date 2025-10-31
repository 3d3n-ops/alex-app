import { loadAgentConfig, normalizeAgent, type AgentId } from '@/lib/agents'
import { streamOpenRouterChat, mapProviderToModel, type ORMessage, openRouterChatOnce } from '@/lib/openrouter'
import { buildTools, buildORToolsFromRegistry, buildClientUITools } from '@/lib/tools'

export const runtime = 'nodejs'

export async function POST(req: Request) {
	try {
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
    
    // Check for API errors in response or choice
    if (!choice || choice?.error) {
      const errorMsg = choice?.error?.message || resJson?.error?.message || 'Service temporarily unavailable'
      console.error('[Chat API] Provider error:', {
        choiceError: choice?.error,
        responseError: resJson?.error,
        fullResponse: JSON.stringify(resJson).substring(0, 1000)
      })
      return new Response(JSON.stringify({ 
        content: `Sorry, I encountered an error: ${errorMsg}. Please try again in a moment.`,
        toolIntents: []
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const msg = choice?.message
    let assistantContent: string = msg?.content || ''
    const toolCalls = Array.isArray(msg?.tool_calls) ? msg.tool_calls : []
    
    // Handle reasoning/chain-of-thought models that put content in reasoning field
    if (!assistantContent && msg) {
      // Some models use 'reasoning' field for chain-of-thought
      if (msg.reasoning && typeof msg.reasoning === 'string') {
        assistantContent = msg.reasoning
      } else if (msg.reasoning_details && typeof msg.reasoning_details === 'string') {
        assistantContent = msg.reasoning_details
      } else if (msg.refusal && typeof msg.refusal === 'string') {
        // Some models refuse with a message
        assistantContent = msg.refusal
      }
    }
    
    // Log for debugging empty responses
    if (!assistantContent && toolCalls.length === 0) {
      console.warn('[Chat API] Empty content and no tool calls:', {
        hasChoice: !!choice,
        hasMessage: !!msg,
        messageKeys: msg ? Object.keys(msg) : [],
        hasReasoning: !!(msg?.reasoning),
        hasRefusal: !!(msg?.refusal),
        rawResponse: JSON.stringify(resJson).substring(0, 500)
      })
    }
    
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
    turnMessages.push({ role: 'assistant', content: assistantContent || '', tool_calls: toolCalls })
    for (const call of toolCalls) {
      const name: string | undefined = call?.function?.name || call?.name
      const argsRaw: string | object | undefined = call?.function?.arguments || call?.arguments
      const callId: string | undefined = call?.id || call?.call_id
      const spec = name ? registry[name] : undefined
      if (!name || !spec) {
        turnMessages.push({ 
          role: 'tool', 
          content: `Tool not found: ${name || 'unknown'}`,
          tool_call_id: callId || 'unknown'
        })
        continue
      }
      let parsed: unknown = {}
      try {
        const asObj = typeof argsRaw === 'string' ? JSON.parse(argsRaw) : (argsRaw || {})
        parsed = spec.zodSchema.parse(asObj)
      } catch (e: any) {
        turnMessages.push({ 
          role: 'tool', 
          content: `Invalid args for ${name}: ${String(e?.message || e)}`,
          tool_call_id: callId || 'unknown'
        })
        continue
      }
      try {
        const out = await spec.execute(parsed)
        turnMessages.push({ 
          role: 'tool', 
          content: JSON.stringify(out),
          tool_call_id: callId || 'unknown'
        })
      } catch (e: any) {
        turnMessages.push({ 
          role: 'tool', 
          content: `Error executing ${name}: ${String(e?.message || e)}`,
          tool_call_id: callId || 'unknown'
        })
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
	} catch (error: any) {
		console.error('Chat API error:', error)
		return new Response(
			JSON.stringify({ 
				error: 'Internal server error', 
				message: error?.message || String(error),
				stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
			}), 
			{ 
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		)
	}
}

