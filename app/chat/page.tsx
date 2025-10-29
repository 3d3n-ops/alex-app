'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { CodeEditorHandle } from '@/components/code-editor'
import ChatField, { type ChatMessage } from '@/components/chat-field'

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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSendMessage = async (message: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])

    // Simulate AI response (replace with actual API call)
    setIsLoading(true)
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I received your message: "' + message + '". This is a placeholder response. Connect me to your AI API to get real responses!',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
    }, 1000)
  }

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
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
      />
    </div>
  )
}

