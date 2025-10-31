export type ORMessage = 
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: any[] }
  | { role: 'tool'; content: string; tool_call_id: string }

export type ORTool = {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: unknown // JSON Schema
  }
}

export interface OpenRouterChatParams {
  model: string
  messages: ORMessage[]
  tools?: ORTool[]
  temperature?: number
  maxTokens?: number
}

// Create a streaming Response that proxies OpenRouter SSE chunks to the client
export async function streamOpenRouterChat(params: OpenRouterChatParams): Promise<Response> {
  const { model, messages, tools, temperature = 0.3, maxTokens } = params
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return new Response('Missing OPENROUTER_API_KEY', { status: 500 })
  }
  const body = {
    model,
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens,
    tools: tools && tools.length > 0 ? tools : undefined
  }
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Alex App'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    return new Response(`OpenRouter error: ${res.status} ${text}`, { status: 500 })
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

export function mapProviderToModel(provider?: string) {
  const p = (provider || '').toLowerCase()
  // Default to Anthropic Sonnet 4.5
  if (p.includes('openai') || p.includes('gpt')) return 'openai/gpt-5'
  return 'anthropic/claude-sonnet-4.5'
}

// Non-streaming one-off chat completion (supports tools)
export async function openRouterChatOnce(params: OpenRouterChatParams): Promise<any> {
  const { model, messages, tools, temperature = 0.3, maxTokens } = params
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY')
  }
  const body = {
    model,
    messages,
    stream: false,
    temperature,
    max_tokens: maxTokens,
    tools: tools && tools.length > 0 ? tools : undefined
  }
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
      'X-Title': 'Alex App'
    },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`OpenRouter error: ${res.status} ${text}`)
  }
  return await res.json()
}

