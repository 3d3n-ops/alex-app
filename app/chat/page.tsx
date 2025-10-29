'use client'

import { useRef } from 'react'
import dynamic from 'next/dynamic'
import type { CodeEditorHandle } from '@/components/code-editor'
import ChatField from '@/components/chat-field'
import { useChatThread } from '@/hooks/use-chat-thread'

// Dynamically import CodeEditor to ensure it only loads on client side
const CodeEditor = dynamic(() => import('@/components/code-editor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Loading code editor...</p>
    </div>
  ),
})

export default function ChatPage() {
  const editorRef = useRef<CodeEditorHandle>(null)
  const { messages, isLoading, sendMessage } = useChatThread(undefined, 'alexTutor')

  return (
    <div className="h-screen w-screen relative">
      <CodeEditor
        ref={editorRef}
        className="h-full"
        initialLanguage="python"
        onCodeChange={(code) => {
          // Handle code changes if needed
          console.log('Code changed:', code.length, 'characters')
        }}
      />
      <ChatField
        messages={messages.map(m => ({ id: String(m.id), role: m.role, content: m.content, timestamp: new Date(m.createdAt) }))}
        onSendMessage={sendMessage}
        isLoading={isLoading}
      />
    </div>
  )
}

