'use client'

import { Suspense } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useRef, useMemo } from 'react'
import type { CodeEditorHandle } from '@/components/code-editor'
import ChatField from '@/components/chat-field'
import { useChatThread } from '@/hooks/use-chat-thread'
import { splitMessageIntoBubbles } from '@/lib/message-splitter'
import { useEditorWorkspaceSync } from '@/hooks/use-editor-workspace-sync'

const CodeEditor = dynamic(() => import('@/components/code-editor'), { ssr: false })

function ThreadPageContent() {
  const params = useParams<{ threadId: string }>()
  const { threadId } = params
  const { messages, isLoading, sendMessage, mode, tts } = useChatThread(threadId, 'alexTutor')
  const editorRef = useRef<CodeEditorHandle>(null)
  
  // Sync editor files with workspace
  useEditorWorkspaceSync(threadId, true)

  // Convert messages to display format with bubbles
  const displayMessages = useMemo(() => {
    return messages.map(m => {
      const base = {
        id: String(m.id),
        role: m.role,
        timestamp: new Date(m.createdAt)
      }
      
      // Split assistant messages into bubbles
      if (m.role === 'assistant') {
        const bubbles = splitMessageIntoBubbles(m.content, mode)
        return { ...base, content: bubbles.length > 1 ? bubbles : bubbles[0] }
      }
      
      // User messages stay as single strings
      return { ...base, content: m.content }
    })
  }, [messages, mode])

  return (
    <div className="h-screen w-screen relative">
      <CodeEditor ref={editorRef} className="h-full" threadId={threadId} />
      <ChatField
        messages={displayMessages}
        onSendMessage={async (msg) => {
          const result = await sendMessage(msg)
          const intents = (result as any)?.toolIntents || []
          const editor = editorRef.current
          for (const intent of intents) {
            const name = intent?.name
            const args = intent?.args || {}
            if (!editor) continue
            // Support both old dot notation and new underscore notation for backward compatibility
            if (name === 'editor.setCode' || name === 'editor_setCode') editor.setCode(String(args.code || ''), args.language)
            else if (name === 'editor.insertCode' || name === 'editor_insertCode') editor.insertCode(String(args.code || ''), args.position)
            else if (name === 'editor.createFile' || name === 'editor_createFile') await editor.createFile(String(args.name || 'new.txt'), String(args.language || 'plaintext'), String(args.content || ''))
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
