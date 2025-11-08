'use client'

import { Suspense, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { CodeEditorHandle } from '@/components/code-editor'
import ChatField from '@/components/chat-field'
import { useChatThread } from '@/hooks/use-chat-thread'
import { splitMessageIntoBubbles } from '@/lib/message-splitter'
import { useEditorWorkspaceSync } from '@/hooks/use-editor-workspace-sync'

// Dynamically import CodeEditor to ensure it only loads on client side
const CodeEditor = dynamic(() => import('@/components/code-editor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Loading code editor...</p>
    </div>
  ),
})

function ChatPageContent() {
  const editorRef = useRef<CodeEditorHandle>(null)
  const { messages, isLoading, sendMessage, mode, tts, threadId } = useChatThread(undefined, 'alexTutor')
  
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
      <CodeEditor
        ref={editorRef}
        className="h-full"
        initialLanguage="python"
        threadId={threadId}
        onCodeChange={(code) => {
          // Handle code changes if needed
          console.log('Code changed:', code.length, 'characters')
        }}
      />
      <ChatField
        messages={displayMessages}
        onSendMessage={async (msg) => {
          // Clear spotlight when user sends a new message
          const editor = editorRef.current
          if (editor) {
            editor.clearSpotlight()
          }
          
          const result = await sendMessage(msg)
          const intents = (result as any)?.toolIntents || []
          for (const intent of intents) {
            const name = intent?.name
            const args = intent?.args || {}
            if (!editor) continue
            // Support both old dot notation and new underscore notation for backward compatibility
            if (name === 'editor.setCode' || name === 'editor_setCode') editor.setCode(String(args.code || ''), args.language)
            else if (name === 'editor.insertCode' || name === 'editor_insertCode') editor.insertCode(String(args.code || ''), args.position)
            else if (name === 'editor.createFile' || name === 'editor_createFile') {
              const fileName = String(args.name || '')
              const fileLanguage = String(args.language || 'plaintext')
              const fileContent = String(args.content || '')
              if (!fileContent || fileContent.trim().length === 0) {
                console.error('editor_createFile: content is required and cannot be empty')
              } else {
                await editor.createFile(fileName, fileLanguage, fileContent)
              }
            }
            else if (name === 'editor.editFile' || name === 'editor_editFile') {
              const filePath = String(args.path || '')
              const fileContent = String(args.content || '')
              if (!fileContent || fileContent.trim().length === 0) {
                console.error('editor_editFile: content is required and cannot be empty')
              } else {
                await editor.editFile(filePath, fileContent)
              }
            }
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

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
}

