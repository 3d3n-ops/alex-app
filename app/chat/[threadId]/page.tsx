'use client'

import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useRef } from 'react'
import type { CodeEditorHandle } from '@/components/code-editor'
import ChatField from '@/components/chat-field'
import { useChatThread } from '@/hooks/use-chat-thread'

const CodeEditor = dynamic(() => import('@/components/code-editor'), { ssr: false })

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>()
  const { threadId } = params
  const { messages, isLoading, sendMessage } = useChatThread(threadId, 'alexTutor')
  const editorRef = useRef<CodeEditorHandle>(null)

  return (
    <div className="h-screen w-screen relative">
      <CodeEditor ref={editorRef} className="h-full" />
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

