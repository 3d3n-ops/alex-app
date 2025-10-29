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
    <div className="h-screen w-screen">
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
  )
}

