'use client'

import { Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { CodeEditorHandle } from '@/components/code-editor'
import ChatField from '@/components/chat-field'
import { useChatThread } from '@/hooks/use-chat-thread'
import { splitMessageIntoBubbles } from '@/lib/message-splitter'
import { useEditorWorkspaceSync } from '@/hooks/use-editor-workspace-sync'
import { useState } from 'react'

const CodeEditor = dynamic(() => import('@/components/code-editor'), { ssr: false })

function ThreadPageContent() {
  const params = useParams<{ threadId: string }>()
  const router = useRouter()
  const { threadId } = params
  const { messages, isLoading, sendMessage, mode, tts } = useChatThread(threadId, 'alexTutor')
  const editorRef = useRef<CodeEditorHandle>(null)
  const [currentTodos, setCurrentTodos] = useState<any[] | null>(null)
  
  // Sync editor files with workspace
  useEditorWorkspaceSync(threadId, true)

  // Convert messages to display format - single stream for assistant messages (no bubbles when TTS enabled)
  const displayMessages = useMemo(() => {
    return messages.map(m => {
      const base = {
        id: String(m.id),
        role: m.role,
        timestamp: new Date(m.createdAt)
      }
      
      // Assistant messages - render as single continuous stream (TTS enabled by default)
      // Keep content as single string for streaming display
      if (m.role === 'assistant') {
        return { ...base, content: m.content }
      }
      
      // User messages stay as single strings
      return { ...base, content: m.content }
    })
  }, [messages, mode])

  return (
    <div className="h-screen w-screen relative">
      <CodeEditor ref={editorRef} className="h-full" threadId={threadId} />
      {/* Back Button - bottom left */}
      <div className="fixed bottom-6 left-6 z-50">
        <Button
          variant="ghost"
          onClick={() => router.push('/dashboard')}
          className="text-foreground/80 hover:text-foreground hover:bg-muted font-mono"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
      <ChatField
        messages={displayMessages}
        todos={currentTodos}
        onSendMessage={async (msg) => {
          // Clear spotlight and todos when user sends a new message
          const editor = editorRef.current
          if (editor) {
            editor.clearSpotlight()
          }
          setCurrentTodos(null) // Clear previous todos
          
          const result = await sendMessage(msg)
          const intents = (result as any)?.toolIntents || []
          const todos = (result as any)?.todos || null
          
          // Store todos in state for display
          if (todos) {
            setCurrentTodos(todos)
          }
          
          for (const intent of intents) {
            const name = intent?.name
            const args = intent?.args || {}
            if (!editor) continue
            // Support both old dot notation and new underscore notation for backward compatibility
            if (name === 'editor.setCode' || name === 'editor_setCode') editor.setCode(String(args.code || ''), args.language)
            else if (name === 'editor.insertCode' || name === 'editor_insertCode') editor.insertCode(String(args.code || ''), args.position)
            else if (name === 'editor.createFile' || name === 'editor_createFile') await editor.createFile(String(args.name || 'new.txt'), String(args.language || 'plaintext'), String(args.content || ''))
            else if (name === 'editor.spotlight' || name === 'editor_spotlight') {
              const lineStart = Number(args.lineStart) || 1
              const lineEnd = args.lineEnd ? Number(args.lineEnd) : undefined
              editor.spotlight(lineStart, lineEnd, args.message)
            }
          }
        }}
        isLoading={isLoading}
        ttsEnabled={tts.isEnabled}
        onToggleTTS={tts.setIsEnabled}
      />
    </div>
  )
}

export default function ThreadPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    }>
      <ThreadPageContent />
    </Suspense>
  )
}
