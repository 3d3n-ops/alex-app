import { getBestModel, getModelConfig, getFallbackModels, recordModelPerformance } from './model-router'

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
  // Use model router to get best available model
  if (p.includes('openai') || p.includes('gpt')) {
    // User specifically requested GPT
    return 'openai/gpt-5'
  }
  // Default: use model router to get best available model
  return getBestModel()
}

// Non-streaming one-off chat completion (supports tools) with automatic fallback
export async function openRouterChatOnce(params: OpenRouterChatParams): Promise<any> {
  const { model: initialModel, messages, tools, temperature = 0.3, maxTokens } = params
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENROUTER_API_KEY')
  }

  // Start with the requested model, or best available
  let currentModel = initialModel || getBestModel()
  const fallbackModels = getFallbackModels(currentModel)
  const modelsToTry = [currentModel, ...fallbackModels]
  
  let lastError: Error | null = null

  // Try models in order until one succeeds
  for (const model of modelsToTry) {
    const modelConfig = getModelConfig(model)
    const timeout = modelConfig?.timeout || 30000
    const startTime = Date.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

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
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const error = new Error(`OpenRouter error (${model}): ${res.status} ${text}`)
        recordModelPerformance(model, responseTime, false, false)
        lastError = error
        
        // If it's a rate limit or server error, try next model
        if (res.status === 429 || res.status >= 500) {
          if (process.env.NODE_ENV === 'development') {
            console.warn(`[Model Router] Model ${model} returned ${res.status}, trying fallback...`)
          }
          continue
        }
        // For other errors, throw immediately
        throw error
      }

      const result = await res.json()
      recordModelPerformance(model, responseTime, true, false)

      // If response took too long, mark as slow and log for future requests
      if (responseTime > 30000) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[Model Router] Model ${model} took ${responseTime}ms, considering fallback for next request`)
        }
      }

      return result

    } catch (error: any) {
      const responseTime = Date.now() - startTime
      const isTimeout = error.name === 'AbortError' || error.message?.includes('timeout')
      
      recordModelPerformance(model, responseTime, false, isTimeout)
      lastError = error

      if (isTimeout) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[Model Router] Model ${model} timed out after ${responseTime}ms, trying fallback...`)
        }
        // Continue to next model
        continue
      }

      // For non-timeout errors, try next model if available
      if (modelsToTry.indexOf(model) < modelsToTry.length - 1) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[Model Router] Model ${model} failed: ${error.message}, trying fallback...`)
        }
        continue
      }

      // Last model failed, throw error
      throw error
    }
  }

  // All models failed
  throw lastError || new Error('All models failed')
}

