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
            else if (name === 'editor.runCode' || name === 'editor_runCode') await editor.runCode()
            else if (name === 'terminal.write' || name === 'terminal_write') { editor.openTerminal(); editor.writeToTerminal(String(args.text || '')) }
          }
        }}
        isLoading={isLoading}
      />
    </div>
  )
}

