'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { chatDb, type ChatMessageRow } from '@/lib/chat-db'

export type AgentMode = 'alexTutor' | 'alexExplore'

export function useChatThread(initialThreadId?: string, defaultMode: AgentMode = 'alexTutor') {
  const router = useRouter()
  const search = useSearchParams()
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId)
  const [mode, setMode] = useState<AgentMode>((search.get('mode') as AgentMode) || defaultMode)
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  // Load existing thread messages
  useEffect(() => {
    if (!threadId) return
    let cancelled = false
    ;(async () => {
      const rows = await chatDb.messages.where('threadId').equals(threadId).sortBy('createdAt')
      if (!cancelled) setMessages(rows)
    })()
    return () => { cancelled = true }
  }, [threadId])

  async function ensureThread(): Promise<string> {
    if (threadId) return threadId
    const res = await fetch('/api/thread', { method: 'POST' })
    const { id, sig } = await res.json()
    const next = `/chat/${id}?sig=${encodeURIComponent(sig)}&mode=${mode}`
    router.push(next)
    setThreadId(id)
    return id
  }

  async function append(role: 'user' | 'assistant', content: string, tid?: string) {
    const t = tid ?? threadId!
    const row: ChatMessageRow = {
      threadId: t,
      role,
      content,
      createdAt: Date.now(),
    }
    const id = await chatDb.messages.add(row)
    setMessages((prev) => [...prev, { ...row, id }])
    return id
  }

  async function sendMessage(text: string) {
    const tid = await ensureThread()
    await append('user', text, tid)
    setIsLoading(true)
    controllerRef.current?.abort()
    controllerRef.current = new AbortController()
    try {
      // Use clientIntents mode to allow agent to decide when to use tools
      // The agent should respond conversationally when no tools are needed
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: mode,
          clientIntents: true,
          messages: messages
            .concat([{ threadId: tid, role: 'user', content: text, createdAt: Date.now() }])
            .map(m => ({ role: m.role, content: m.content }))
        }),
        signal: controllerRef.current.signal
      })
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        throw new Error(`Chat request failed: ${res.status} ${errorText.substring(0, 100)}`)
      }
      const data = await res.json()
      const toolIntents = Array.isArray(data?.toolIntents) ? data.toolIntents : []
      let assistantContent: string = data?.content || ''
      
      // Log for debugging
      if (!assistantContent && toolIntents.length === 0) {
        console.warn('Empty response from API:', { data, toolIntents, text })
      }
      
      // Fallback handling for empty responses
      if (!assistantContent) {
        if (toolIntents.length > 0) {
          // Has tool intents but no content - create a summary
          const previews = toolIntents.slice(0, 3).map((t: any) => String(t?.name || 'tool')).join(', ')
          const more = toolIntents.length > 3 ? ` (+${toolIntents.length - 3} more)` : ''
          assistantContent = `I'll help you with that. Executing: ${previews}${more}.`
        } else {
          // No content and no tools - this indicates an API issue
          assistantContent = "I'm having trouble processing that right now. Please try rephrasing your question or check the console for errors."
        }
      }
      
      const savedId = await append('assistant', assistantContent, tid)
      return { toolIntents, assistantMessageId: savedId }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    threadId,
    mode,
    setMode,
    messages,
    isLoading,
    sendMessage
  }
}

