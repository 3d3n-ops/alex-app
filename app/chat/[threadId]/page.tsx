'use client'

import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import ChatField from '@/components/chat-field'
import { useChatThread } from '@/hooks/use-chat-thread'

const CodeEditor = dynamic(() => import('@/components/code-editor'), { ssr: false })

export default function ThreadPage() {
  const params = useParams<{ threadId: string }>()
  const { threadId } = params
  const { messages, isLoading, sendMessage, mode, setMode } = useChatThread(threadId, 'alexTutor')

  return (
    <div className="h-screen w-screen relative">
      <CodeEditor className="h-full" />
      <ChatField
        messages={messages.map(m => ({ id: String(m.id), role: m.role, content: m.content, timestamp: new Date(m.createdAt) }))}
        onSendMessage={sendMessage}
        isLoading={isLoading}
        defaultMode={mode === 'alexTutor' ? 'learn' : 'explore'}
        onToggleMode={() => setMode(mode === 'alexTutor' ? 'alexExplore' : 'alexTutor')}
      />
    </div>
  )
}

