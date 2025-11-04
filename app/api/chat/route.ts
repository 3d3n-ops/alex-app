import { loadAgentConfig, normalizeAgent, type AgentId } from '@/lib/agents'
import { streamOpenRouterChat, mapProviderToModel, type ORMessage, openRouterChatOnce } from '@/lib/openrouter'
import { buildTools, buildORToolsFromRegistry, buildClientUITools, buildEditorTools } from '@/lib/tools'
import { auth, currentUser } from '@clerk/nextjs/server'
import { formatUserProfileAsContext } from '@/lib/user-profile'

export const runtime = 'nodejs'

// Add GET handler for testing/health check
export async function GET() {
	return new Response(JSON.stringify({ 
		status: 'ok', 
		message: 'Chat API is available',
		endpoint: '/api/chat',
		methods: ['POST']
	}), {
		status: 200,
		headers: { 'Content-Type': 'application/json' }
	})
}

export async function POST(req: Request) {
	// TODO: Re-enable authentication for production
	// Temporarily disabled for stress testing
	const { userId } = await auth()
	// if (!userId) {
	// 	return new Response(JSON.stringify({ error: 'Unauthorized' }), {
	// 		status: 401,
	// 		headers: { 'Content-Type': 'application/json' }
	// 	})
	// }

	try {
		const body = await req.json().catch(() => ({}))
		const agent: AgentId = normalizeAgent(body.agent)
		const provider: string | undefined = body.provider || body.modelProvider
		const messages = Array.isArray(body.messages) ? body.messages : []
	  const enableTools: boolean = Boolean(body.enableTools)
	  const clientIntents: boolean = Boolean(body.clientIntents)
	  const threadId: string | undefined = body.threadId

	// Load agent config and user profile
	const { systemPrompt } = await loadAgentConfig(agent)
	
	// Get user profile context
	const user = await currentUser()
	const userProfileContext = user ? formatUserProfileAsContext({
		programmingLevel: user.publicMetadata?.programmingLevel as any,
		languages: Array.isArray(user.publicMetadata?.languages) 
			? user.publicMetadata.languages as string[]
			: [],
		onboardingCompleted: Boolean(user.publicMetadata?.onboardingCompleted),
	}) : ''

	// Combine system prompt with user profile context
	const enhancedSystemPrompt = systemPrompt + userProfileContext

	// Clean and validate messages to ensure tool_calls and tool_call_id are properly paired
	// Anthropic requires that tool_result messages have a corresponding tool_use in the previous assistant message
	// Tool messages from client history might not be properly paired, so we validate them
	const cleanedMessages: ORMessage[] = []
	let lastAssistantToolCalls: string[] = [] // Track tool call IDs from the most recent assistant message
	
	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i] as any
		
		if (msg.role === 'assistant') {
			// Store tool call IDs from this assistant message for validation
			lastAssistantToolCalls = []
			
			// Extract tool call IDs from tool_calls array
			if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
				for (const call of msg.tool_calls) {
					const callId = call?.id || call?.call_id || call?.tool_use_id
					if (callId) {
						lastAssistantToolCalls.push(callId)
					}
				}
			}
			
			// Handle content as string (OpenRouter format) or array (Anthropic format)
			let content = msg.content || ''
			if (Array.isArray(content)) {
				// Extract only text content from Anthropic-style content array
				// Filter out tool_use and tool_result blocks (these should be separate messages)
				content = content
					.filter((block: any) => block.type === 'text')
					.map((block: any) => block.text)
					.join('')
			}
			
			// Only include tool_calls if they exist and are valid
			const toolCalls = msg.tool_calls && Array.isArray(msg.tool_calls) && msg.tool_calls.length > 0
				? msg.tool_calls
				: undefined
			
			cleanedMessages.push({
				role: 'assistant',
				content: content,
				...(toolCalls ? { tool_calls: toolCalls } : {})
			})
		} else if (msg.role === 'tool') {
			// Only include tool messages if they have a valid tool_call_id that matches the previous assistant's tool_use
			const toolCallId = msg.tool_call_id || msg.tool_use_id
			if (toolCallId && lastAssistantToolCalls.includes(toolCallId)) {
				cleanedMessages.push({
					role: 'tool',
					content: msg.content || '',
					tool_call_id: toolCallId
				})
				// Remove this tool call ID from the list (each tool call should only have one result)
				lastAssistantToolCalls = lastAssistantToolCalls.filter(id => id !== toolCallId)
			} else {
				// Skip tool messages without valid tool_call_id or with unmatched IDs
				// This prevents the "unexpected tool_use_id" error from Anthropic
				if (process.env.NODE_ENV === 'development') {
					console.warn('[Chat API] Skipping orphaned tool message:', {
						toolCallId,
						expectedIds: lastAssistantToolCalls,
						hasValidId: !!toolCallId && lastAssistantToolCalls.includes(toolCallId),
						messageIndex: i
					})
				}
			}
		} else {
			// User or system messages - add as-is
			// Handle content as string or array
			let content = msg.content || ''
			if (Array.isArray(content)) {
				// Extract only text content, filter out any tool blocks
				content = content
					.filter((block: any) => block.type === 'text')
					.map((block: any) => block.text)
					.join('')
			}
			
			cleanedMessages.push({
				role: msg.role as 'user' | 'system',
				content: content
			})
			// Reset tool calls when we hit a user message (conversation boundary)
			lastAssistantToolCalls = []
		}
	}

	const orMessages: ORMessage[] = [
		{ role: 'system', content: enhancedSystemPrompt },
		...cleanedMessages
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
    // ReAct-style loop: Execute editor tools (editor_readFile, editor_listFiles) and other tools automatically,
    // return client UI tool intents (editor_createFile) when agent is ready to take actions
    const uiTools = buildClientUITools()
    const editorRegistry = buildEditorTools(threadId) // Editor tools (server-side, thread-scoped)
    const editorTools = buildORToolsFromRegistry(editorRegistry)
    const serverRegistry = buildTools(threadId) // Other server tools (globFile, grepFile, etc.)
    const serverTools = buildORToolsFromRegistry(serverRegistry)
    // Combine editor tools, server tools, and UI tools - agent can use any
    const allTools = [...editorTools, ...serverTools, ...uiTools]
    
    let turnMessages: ORMessage[] = [...orMessages]
    const maxTurns = 6 // Allow more turns for ReAct reasoning
    let finalContent = ''
    let finalUIIntents: any[] = []
    
    for (let turn = 0; turn < maxTurns; turn++) {
      const resJson = await openRouterChatOnce({ model, messages: turnMessages, tools: allTools, temperature: 0.2, maxTokens: 1200 })
      const choice = resJson?.choices?.[0]
      
      // Check for API errors
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
      
      // Handle reasoning fields
      if (!assistantContent && msg) {
        if (msg.reasoning && typeof msg.reasoning === 'string') {
          assistantContent = msg.reasoning
        } else if (msg.reasoning_details && typeof msg.reasoning_details === 'string') {
          assistantContent = msg.reasoning_details
        } else if (msg.refusal && typeof msg.refusal === 'string') {
          assistantContent = msg.refusal
        }
      }
      
      // Accumulate assistant content across turns
      if (assistantContent) {
        finalContent += (finalContent ? '\n\n' : '') + assistantContent
      }
      
      if (toolCalls.length === 0) {
        // No more tool calls - finalize and return
        break
      }
      
      // Separate editor tools (auto-execute), server tools (auto-execute), and UI tools (return as intents)
      const editorToolCalls: any[] = []
      const serverToolCalls: any[] = []
      const uiToolCalls: any[] = []
      
      for (const call of toolCalls) {
        const name = call?.function?.name || call?.name
        if (editorRegistry[name]) {
          editorToolCalls.push(call)
        } else if (serverRegistry[name]) {
          serverToolCalls.push(call)
        } else {
          uiToolCalls.push(call)
        }
      }
      
      // Execute editor tools automatically (same as server tools)
      for (const call of editorToolCalls) {
        const name: string | undefined = call?.function?.name || call?.name
        const argsRaw: string | object | undefined = call?.function?.arguments || call?.arguments
        const callId: string | undefined = call?.id || call?.call_id
        const spec = name ? editorRegistry[name] : undefined
        
        if (!name || !spec) {
          console.warn(`[Chat API] Editor tool not found: ${name || 'unknown'}`)
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
          console.error(`[Chat API] Invalid args for ${name}:`, { argsRaw, error: e?.message || e, threadId })
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
          const errorMsg = `Error executing ${name}: ${String(e?.message || e)}`
          console.error(`[Chat API] Editor tool execution error:`, { tool: name, args: parsed, error: errorMsg, threadId })
          turnMessages.push({ 
            role: 'tool', 
            content: errorMsg,
            tool_call_id: callId || 'unknown'
          })
        }
      }
      
      // If there are UI tool calls, collect them as intents and finalize
      if (uiToolCalls.length > 0) {
        finalUIIntents = uiToolCalls.map((c: any) => ({
          name: c?.function?.name || c?.name,
          args: (() => { try { return JSON.parse(c?.function?.arguments || c?.arguments || '{}') } catch { return {} } })()
        }))
        // Still execute any server tools that were called in the same turn
        turnMessages.push({ role: 'assistant', content: assistantContent || '', tool_calls: toolCalls })
      } else {
        // Only server tools - continue ReAct loop
        turnMessages.push({ role: 'assistant', content: assistantContent || '', tool_calls: toolCalls })
      }
      
      // Execute server tools automatically (ReAct: Observe after Action)
      for (const call of serverToolCalls) {
        const name: string | undefined = call?.function?.name || call?.name
        const argsRaw: string | object | undefined = call?.function?.arguments || call?.arguments
        const callId: string | undefined = call?.id || call?.call_id
        const spec = name ? serverRegistry[name] : undefined
        
        if (!name || !spec) {
          console.warn(`[Chat API] Tool not found: ${name || 'unknown'}`)
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
          console.error(`[Chat API] Invalid args for ${name}:`, { argsRaw, error: e?.message || e, threadId })
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
          const errorMsg = `Error executing ${name}: ${String(e?.message || e)}`
          console.error(`[Chat API] Tool execution error:`, { tool: name, args: parsed, error: errorMsg, threadId })
          turnMessages.push({ 
            role: 'tool', 
            content: errorMsg,
            tool_call_id: callId || 'unknown'
          })
        }
      }
      
      // If we had UI tool calls, break after executing server tools
      if (uiToolCalls.length > 0) {
        break
      }
    }
    
    // Return streaming response with UI intents
    // Stream the content in chunks to enable real-time TTS and progressive display
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }
        
        // First send tool intents if any
        if (finalUIIntents.length > 0) {
          send({ type: 'toolIntents', toolIntents: finalUIIntents })
        }
        
        // Stream content in chunks for progressive display and TTS
        const content = finalContent || 'I processed your request.'
        const chunkSize = 50 // Characters per chunk
        let offset = 0
        
        while (offset < content.length) {
          const chunk = content.substring(offset, offset + chunkSize)
          send({ type: 'content', delta: chunk })
          offset += chunkSize
          // Small delay to make streaming visible
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        
        // Send completion
        send({ type: 'done', content })
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
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

  // Tool-enabled loop (non-stream with a synthetic SSE response)
  const registry = buildTools(threadId) // Pass threadId to tools
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
        const errorMsg = `Error executing ${name}: ${String(e?.message || e)}`
        console.error(`[Chat API] Tool execution error:`, { tool: name, args: parsed, error: errorMsg, threadId })
        turnMessages.push({ 
          role: 'tool', 
          content: errorMsg,
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

