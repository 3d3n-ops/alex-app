'use client'

import { useRef } from 'react'
import dynamic from 'next/dynamic'
import type { CodeEditorHandle } from '@/components/code-editor'

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

  return (
    <div className="h-screen w-screen flex flex-col">
      <div className="border-b border-border p-4">
        <h1 className="text-2xl font-bold">Code Editor</h1>
        <p className="text-sm text-muted-foreground">
          Write and run code in multiple languages. AI can interact with the editor.
        </p>
      </div>
      <div className="flex-1 overflow-hidden p-4">
        <CodeEditor
          ref={editorRef}
          className="h-full"
          initialLanguage="python"
          onCodeChange={(code) => {
            // Handle code changes if needed
            console.log('Code changed:', code.length, 'characters')
          }}
        />
      </div>
    </div>
  )
}

