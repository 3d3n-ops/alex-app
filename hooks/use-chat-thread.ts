'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { chatDb, type ChatMessageRow } from '@/lib/chat-db'
import { splitMessageIntoBubbles } from '@/lib/message-splitter'
import type { AgentId } from '@/lib/agents'
import { useStreamingTTS } from './use-tts'
import { useWorkspaceSync } from './use-workspace-sync'

export type AgentMode = 'alexTutor' | 'alexExplore'

export function useChatThread(initialThreadId?: string, defaultMode: AgentMode = 'alexTutor') {
  const router = useRouter()
  const search = useSearchParams()
  const [threadId, setThreadId] = useState<string | undefined>(initialThreadId)
  const [mode, setMode] = useState<AgentMode>((search.get('mode') as AgentMode) || defaultMode)
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const autoSentRef = useRef<boolean>(false)
  const autoSendInProgressRef = useRef<boolean>(false)
  const sendMessageRef = useRef<((text: string, skipUserAppend?: boolean) => Promise<any>) | null>(null)
  
  // Streaming TTS support - speaks as text arrives
  const streamingTTS = useStreamingTTS({
    voice: 'alloy',
    speed: mode === 'alexTutor' ? 1.0 : 1.1, // Slightly faster for Explore mode
    model: 'tts-1',
  })
  
  // For backward compatibility
  const tts = {
    isEnabled: streamingTTS.isEnabled,
    setIsEnabled: streamingTTS.setIsEnabled,
    stop: streamingTTS.stop,
  }
  
  // Sync workspace IndexedDB to server cache
  useWorkspaceSync(threadId)

  // Load existing thread messages
  useEffect(() => {
    if (!threadId) return
    autoSentRef.current = false // Reset when thread changes
    autoSendInProgressRef.current = false
    let cancelled = false
    ;(async () => {
      const rows = await chatDb.messages.where('threadId').equals(threadId).sortBy('createdAt')
      if (!cancelled) {
        setMessages(rows)
      }
    })()
    return () => { cancelled = true }
  }, [threadId])

  // Auto-send if last message is from user and hasn't been responded to
  useEffect(() => {
    if (!threadId || autoSentRef.current || autoSendInProgressRef.current || isLoading || messages.length === 0) {
      return
    }

    // Check if last message is from user
    // Since messages are sorted by createdAt, if last message is user, there's no assistant response yet
    const lastMessage = messages[messages.length - 1]
    if (lastMessage.role !== 'user') {
      // If last message is not user, mark as sent (either already responded or no user message)
      autoSentRef.current = true
      return
    }

    // Auto-send the user message (skip appending since it already exists)
    if (!sendMessageRef.current) return
    
    autoSendInProgressRef.current = true
    autoSentRef.current = true
    
    sendMessageRef.current(lastMessage.content, true).finally(() => {
      autoSendInProgressRef.current = false
    })
  }, [threadId, messages, isLoading])

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
    
    // If this is the first user message, update thread title
    if (role === 'user') {
      const { ensureThread } = await import('@/lib/chat-threads')
      const title = content.length > 50 ? content.substring(0, 47) + '...' : content
      await ensureThread(t, title)
    }
    
    return id
  }

  const sendMessage = async (text: string, skipUserAppend: boolean = false) => {
    const tid = await ensureThread()
    if (!skipUserAppend) {
      await append('user', text, tid)
    }
    setIsLoading(true)
    
    // Stop any ongoing TTS when new message starts
    streamingTTS.stop()
    
    controllerRef.current?.abort()
    controllerRef.current = new AbortController()
    
    let assistantContent = ''
    let toolIntents: any[] = []
    let streamingContentId: number | undefined
    
    try {
      // Use clientIntents mode to allow agent to decide when to use tools
      // The agent should respond conversationally when no tools are needed
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: mode,
          clientIntents: true,
          threadId: tid, // Pass threadId to chat API for workspace scoping
          messages: (skipUserAppend 
            ? messages // Message already in array from IndexedDB
            : messages.concat([{ threadId: tid, role: 'user', content: text, createdAt: Date.now() }]) // Add new message
          ).map(m => {
              // Preserve tool_calls for assistant messages and tool_call_id for tool messages
              // Note: ChatMessageRow doesn't include 'tool' role, but API messages might
              const base: any = { role: m.role, content: m.content }
              if (m.role === 'assistant' && (m as any).tool_calls) {
                base.tool_calls = (m as any).tool_calls
              }
              // Handle tool messages (if present in extended message structure)
              if ((m as any).role === 'tool' && (m as any).tool_call_id) {
                base.role = 'tool'
                base.tool_call_id = (m as any).tool_call_id
              }
              return base
            })
        }),
        signal: controllerRef.current.signal
      })
      
      if (!res.ok) {
        const errorText = await res.text().catch(() => '')
        throw new Error(`Chat request failed: ${res.status} ${errorText.substring(0, 100)}`)
      }
      
      // Check if response is streaming (SSE) or JSON
      const contentType = res.headers.get('content-type') || ''
      
      if (contentType.includes('event-stream')) {
        // Handle streaming response
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        
        if (!reader) {
          throw new Error('No response body')
        }
        
        // Create streaming message in DB
        const streamingMessage: ChatMessageRow = {
          threadId: tid,
          role: 'assistant',
          content: '', // Will be updated as chunks arrive
          createdAt: Date.now(),
        }
        streamingContentId = await chatDb.messages.add(streamingMessage)
        setMessages(prev => [...prev, { ...streamingMessage, id: streamingContentId }])
        
        let buffer = ''
        
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const dataStr = line.slice(6).trim()
            if (dataStr === '[DONE]' || !dataStr) continue
            
            try {
              const data = JSON.parse(dataStr)
              
              if (data.type === 'toolIntents') {
                toolIntents = Array.isArray(data.toolIntents) ? data.toolIntents : []
              } else if (data.type === 'content' && data.delta) {
                // Append delta to content
                assistantContent += data.delta
                
                // Update streaming message in DB
                if (streamingContentId) {
                  await chatDb.messages.update(streamingContentId, { content: assistantContent })
                  setMessages(prev => prev.map(m => 
                    m.id === streamingContentId ? { ...m, content: assistantContent } : m
                  ))
                }
                
                // Feed to streaming TTS
                if (streamingTTS.isEnabled) {
                  streamingTTS.addText(data.delta)
                }
              } else if (data.type === 'done') {
                // Finalize
                if (data.content) assistantContent = data.content
                if (streamingContentId) {
                  await chatDb.messages.update(streamingContentId, { content: assistantContent })
                }
                // Flush remaining TTS buffer
                if (streamingTTS.isEnabled) {
                  streamingTTS.flush()
                }
              }
            } catch (e) {
              // Ignore JSON parse errors for malformed chunks
            }
          }
        }
      } else {
        // Fallback to JSON response (non-streaming)
        const data = await res.json()
        toolIntents = Array.isArray(data?.toolIntents) ? data.toolIntents : []
        assistantContent = data?.content || ''
        
        // Fallback handling for empty responses
        if (!assistantContent) {
          if (toolIntents.length > 0) {
            const previews = toolIntents.slice(0, 3).map((t: any) => String(t?.name || 'tool')).join(', ')
            const more = toolIntents.length > 3 ? ` (+${toolIntents.length - 3} more)` : ''
            assistantContent = `I'll help you with that. Executing: ${previews}${more}.`
          } else {
            assistantContent = "I'm having trouble processing that right now. Please try rephrasing your question or check the console for errors."
          }
        }
        
        const savedId = await append('assistant', assistantContent, tid)
        
        // Trigger TTS for the assistant response
        if (assistantContent && streamingTTS.isEnabled) {
          streamingTTS.addText(assistantContent)
          streamingTTS.flush()
        }
        
        return { toolIntents, assistantMessageId: savedId }
      }
      
      return { toolIntents, assistantMessageId: streamingContentId }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Request was cancelled, cleanup
        if (streamingContentId) {
          await chatDb.messages.delete(streamingContentId)
          setMessages(prev => prev.filter(m => m.id !== streamingContentId))
        }
        return { toolIntents: [], assistantMessageId: undefined }
      }
      
      // Handle error - create error message
      const errorMsg = error?.message || 'An error occurred'
      const savedId = await append('assistant', `Sorry, I encountered an error: ${errorMsg}`, tid)
      return { toolIntents: [], assistantMessageId: savedId }
    } finally {
      setIsLoading(false)
    }
  }

  // Keep sendMessage ref updated
  useEffect(() => {
    sendMessageRef.current = sendMessage
  }, [sendMessage])

  return {
    threadId,
    mode,
    setMode,
    messages,
    isLoading,
    sendMessage,
    tts,
  }
}

