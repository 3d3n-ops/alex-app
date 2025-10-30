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
      // Phase 2: non-stream request that returns assistant content + tool intents
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
      if (!res.ok) throw new Error('Chat request failed')
      const data = await res.json()
      const assistantContent: string = data?.content || ''
      const savedId = await append('assistant', assistantContent, tid)
      return { toolIntents: Array.isArray(data?.toolIntents) ? data.toolIntents : [], assistantMessageId: savedId }
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

