'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Send, Bot, User, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string | string[] // Can be single string or array of bubbles
  timestamp: Date
}

interface ChatFieldProps {
  className?: string
  onSendMessage?: (message: string) => void
  messages?: ChatMessage[]
  isLoading?: boolean
  ttsEnabled?: boolean
  onToggleTTS?: (enabled: boolean) => void
}

export default function ChatField({
  className,
  onSendMessage,
  messages = [],
  isLoading = false,
  ttsEnabled = false,
  onToggleTTS,
}: ChatFieldProps) {
  const [inputValue, setInputValue] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Default collapsed size (current size)
  const DEFAULT_WIDTH = 448 // 28rem
  const DEFAULT_HEIGHT = 320 // h-80
  
  // Resizable size state
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const lastExpandedSize = useRef<{ width: number; height: number } | null>(null)
  const resizeState = useRef<{ resizing: boolean; startX: number; startY: number; startWidth: number; startHeight: number }>({
    resizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  })

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
      const margin = 24
      const left = Math.max(margin, Math.round(window.innerWidth / 2 - size.width / 2))
      const top = Math.max(margin, window.innerHeight - size.height - margin)
      setPosition({ top, left })
    }
    handle()
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [size.width, size.height])

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
    if (!containerRef.current || resizeState.current.resizing) return
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

  // Resize handlers
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!containerRef.current) return
    resizeState.current.resizing = true
    setIsResizing(true)
    resizeState.current.startX = e.clientX
    resizeState.current.startY = e.clientY
    resizeState.current.startWidth = size.width
    resizeState.current.startHeight = size.height
    window.addEventListener('mousemove', onResize)
    window.addEventListener('mouseup', onResizeEnd)
  }

  const onResize = (e: MouseEvent) => {
    if (!resizeState.current.resizing) return
    const margin = 8
    const minWidth = DEFAULT_WIDTH
    const minHeight = 200
    const maxWidth = window.innerWidth - margin * 2
    const maxHeight = window.innerHeight - margin * 2
    
    const deltaX = e.clientX - resizeState.current.startX
    const deltaY = e.clientY - resizeState.current.startY
    
    const newWidth = Math.min(
      Math.max(minWidth, resizeState.current.startWidth + deltaX),
      maxWidth
    )
    const newHeight = Math.min(
      Math.max(minHeight, resizeState.current.startHeight + deltaY),
      maxHeight
    )
    
    setSize({ width: newWidth, height: newHeight })
    
    // Adjust position to keep within bounds
    const newLeft = Math.min(
      position.left,
      window.innerWidth - newWidth - margin
    )
    const newTop = Math.min(
      position.top,
      window.innerHeight - newHeight - margin
    )
    setPosition({ top: Math.max(margin, newTop), left: Math.max(margin, newLeft) })
  }

  const onResizeEnd = () => {
    resizeState.current.resizing = false
    setIsResizing(false)
    // Save the expanded size if it's larger than default
    if (size.width > DEFAULT_WIDTH || size.height > DEFAULT_HEIGHT) {
      lastExpandedSize.current = { ...size }
      setIsExpanded(true)
    }
    window.removeEventListener('mousemove', onResize)
    window.removeEventListener('mouseup', onResizeEnd)
  }

  // Toggle expand/collapse
  const toggleExpand = () => {
    if (isExpanded) {
      // Collapse to default size
      // Save current size if it's expanded
      if (size.width > DEFAULT_WIDTH || size.height > DEFAULT_HEIGHT) {
        lastExpandedSize.current = { ...size }
      }
      setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
      setIsExpanded(false)
    } else {
      // Expand to a larger size (or restore previous expanded size)
      const targetSize = lastExpandedSize.current || {
        width: DEFAULT_WIDTH * 1.5,
        height: DEFAULT_HEIGHT * 1.5,
      }
      setSize(targetSize)
      setIsExpanded(true)
    }
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
        'fixed rounded-lg',
        !isResizing && 'transition-all duration-200 ease-out',
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
        width: `${size.width}px`,
        height: `${size.height}px`,
        maxWidth: '90vw',
        maxHeight: '90vh',
      }}
    >
      {/* Drag handle with expand/collapse button */}
      <div className="h-3 cursor-move bg-transparent flex items-center justify-between px-2 select-none">
        <div 
          onMouseDown={onDragStart}
          className="flex-1 flex items-center justify-center h-full"
          title="Drag to move (toggle with Ctrl/Cmd + K)"
        >
          <div className="w-10 h-1 rounded-full bg-foreground/20" />
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation()
            toggleExpand()
          }}
          className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
          title={isExpanded ? "Collapse to default size" : "Expand"}
        >
          {isExpanded ? (
            <Minimize2 className="size-3" />
          ) : (
            <Maximize2 className="size-3" />
          )}
        </Button>
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
              messages.map((message) => {
                // Normalize content to array for assistant messages with multiple bubbles
                const contentBubbles = Array.isArray(message.content) 
                  ? message.content 
                  : [message.content]
                
                // User messages always show as single bubble
                if (message.role === 'user') {
                  return (
                    <div
                      key={message.id}
                      className={cn('flex gap-3 justify-end')}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words text-right max-w-[80%]">
                        {message.content}
                      </p>
                    </div>
                  )
                }
                
                // Assistant messages can have multiple bubbles
                return (
                  <div key={message.id} className="flex flex-col gap-2">
                    {contentBubbles.map((bubble, idx) => (
                      <div
                        key={`${message.id}-${idx}`}
                        className={cn('flex gap-3 justify-start')}
                      >
                        <div className="bg-muted text-foreground rounded-lg px-3 py-2 max-w-[80%]">
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {bubble}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })
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
          {onToggleTTS && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onToggleTTS(!ttsEnabled)}
              className="shrink-0"
              title={ttsEnabled ? "Disable voice" : "Enable voice"}
            >
              {ttsEnabled ? (
                <Volume2 className="size-4" />
              ) : (
                <VolumeX className="size-4" />
              )}
            </Button>
          )}
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

      {/* Resize handle */}
      <div
        onMouseDown={onResizeStart}
        className={cn(
          'absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize',
          'bg-transparent hover:bg-border/20 transition-colors',
          'flex items-end justify-end p-1'
        )}
        title="Drag to resize"
      >
        <div className="w-3 h-3 border-r-2 border-b-2 border-foreground/30 rounded-sm" />
      </div>
    </div>
  )
}

