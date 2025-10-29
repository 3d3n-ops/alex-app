'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatFieldProps {
  className?: string
  onSendMessage?: (message: string) => void
  messages?: ChatMessage[]
  isLoading?: boolean
}

export default function ChatField({
  className,
  onSendMessage,
  messages = [],
  isLoading = false,
}: ChatFieldProps) {
  const [inputValue, setInputValue] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Draggable position + visibility
  const [isOpen, setIsOpen] = useState(true)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const dragState = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({
    dragging: false,
    offsetX: 0,
    offsetY: 0,
  })

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize default position (bottom-left-ish by design, can be moved)
  useEffect(() => {
    const handle = () => {
      const width = 448 // ~28rem default width
      const height = 320 // ~h-80
      const margin = 24
      const left = Math.max(margin, Math.round(window.innerWidth / 2 - width / 2))
      const top = Math.max(margin, window.innerHeight - height - margin)
      setPosition({ top, left })
    }
    handle()
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  // Keyboard shortcut: Ctrl/Cmd + K to toggle visibility
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Drag handlers
  const onDragStart = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    dragState.current.dragging = true
    const rect = containerRef.current.getBoundingClientRect()
    dragState.current.offsetX = e.clientX - rect.left
    dragState.current.offsetY = e.clientY - rect.top
    window.addEventListener('mousemove', onDrag)
    window.addEventListener('mouseup', onDragEnd)
  }

  const onDrag = (e: MouseEvent) => {
    if (!dragState.current.dragging) return
    const margin = 8
    const width = containerRef.current?.offsetWidth ?? 0
    const height = containerRef.current?.offsetHeight ?? 0
    const left = Math.min(
      Math.max(margin, e.clientX - dragState.current.offsetX),
      window.innerWidth - width - margin,
    )
    const top = Math.min(
      Math.max(margin, e.clientY - dragState.current.offsetY),
      window.innerHeight - height - margin,
    )
    setPosition({ top, left })
  }

  const onDragEnd = () => {
    dragState.current.dragging = false
    window.removeEventListener('mousemove', onDrag)
    window.removeEventListener('mouseup', onDragEnd)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() && !isLoading) {
      onSendMessage?.(inputValue.trim())
      setInputValue('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'fixed w-[28rem] max-w-[90vw] h-80 rounded-lg',
        'transition-all duration-200 ease-out',
        isOpen
          ? 'opacity-100 pointer-events-auto translate-y-0 scale-100'
          : 'opacity-0 pointer-events-none translate-y-2 scale-[0.98]',
        'bg-background/80 backdrop-blur-md border border-border/50',
        'shadow-[0_0_20px_rgba(201,181,154,0.15)]',
        'flex flex-col overflow-hidden',
        className
      )}
      style={{
        boxShadow: '0 0 20px rgba(201, 181, 154, 0.15), 0 0 40px rgba(201, 181, 154, 0.08)',
        top: position.top,
        left: position.left,
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={onDragStart}
        className="h-3 cursor-move bg-transparent flex items-center justify-center select-none"
        title="Drag to move (toggle with Ctrl/Cmd + K)"
      >
        <div className="w-10 h-1 rounded-full bg-foreground/20" />
      </div>
      {/* Messages Area */}
      <div className="flex-1 overflow-hidden bg-muted/20">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <div className="text-center">
                  <p>Ask the AI anything about your code…</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {/* Assistant message (no bot icon, keep subtle bubble) */}
                  {message.role === 'assistant' && (
                    <div className="bg-muted text-foreground rounded-lg px-3 py-2 max-w-[80%]">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                    </div>
                  )}

                  {/* User message (text only, no bubble or avatar) */}
                  {message.role === 'user' && (
                    <p className="text-sm whitespace-pre-wrap break-words text-right max-w-[80%]">
                      {message.content}
                    </p>
                  )}
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex gap-1">
                    <div className="size-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="size-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="size-2 rounded-full bg-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="border-t border-border/50 bg-background/60 backdrop-blur-sm p-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI for help with your code..."
            disabled={isLoading}
            className="flex-1 bg-background/50 border-border/50 focus:bg-background/80"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!inputValue.trim() || isLoading}
            className="shrink-0"
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}

