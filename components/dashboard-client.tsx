"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Menu, Send, MessageSquare, Settings, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { chatDb } from "@/lib/chat-db"
import { getAllThreads, ensureThread, getFirstUserMessage } from "@/lib/chat-threads"
import type { ChatThreadRow } from "@/lib/chat-db"
import SuggestedLearning from "@/components/suggested-learning"
import StreakCounter from "@/components/streak-counter"
import { useNotifications } from "@/hooks/use-notifications"
import ThemeSelector from "@/components/theme-selector"

interface DashboardClientProps {
  firstName: string
}

export default function DashboardClient({ firstName }: DashboardClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())
  const [mode, setMode] = useState<'learn' | 'explore'>("learn")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [chatThreads, setChatThreads] = useState<ChatThreadRow[]>([])
  
  // Initialize notifications
  useNotifications()

  // Load chat threads on mount and when sidebar opens
  useEffect(() => {
    if (sidebarOpen) {
      loadChatThreads()
    }
  }, [sidebarOpen])

  const loadChatThreads = async () => {
    try {
      const threads = await getAllThreads()
      setChatThreads(threads)
    } catch (error) {
      console.error('Failed to load chat threads:', error)
    }
  }

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatDate = (date: Date) => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`
  }

  const formatTime = (date: Date) => {
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, "0")
    const ampm = hours >= 12 ? "PM" : "AM"
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes} ${ampm}`
  }

  const handleSend = async () => {
    if (!message.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/thread', { method: 'POST' })
      const { id, sig } = await res.json()
      
      // Save user message
      await chatDb.messages.add({ threadId: id, role: 'user', content: message.trim(), createdAt: Date.now() })

      // Create thread with first message as title
      const threadTitle = message.trim().length > 50 ? message.trim().substring(0, 47) + '...' : message.trim()
      await ensureThread(id, threadTitle)

      // Persist attachments in Dexie
      const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
        reader.onerror = reject
        reader.readAsDataURL(f)
      })
      for (const f of selectedFiles) {
        const contentBase64 = await toBase64(f)
        await chatDb.attachments.add({ threadId: id, type: 'file', name: f.name, mimeType: f.type || 'application/octet-stream', contentBase64, createdAt: Date.now() })
      }
      for (const f of selectedImages) {
        const contentBase64 = await toBase64(f)
        await chatDb.attachments.add({ threadId: id, type: 'image', name: f.name, mimeType: f.type || 'image/*', contentBase64, createdAt: Date.now() })
      }

      setMessage("")
      setSelectedFiles([])
      setSelectedImages([])
      const agent = mode === 'learn' ? 'alexTutor' : 'alexExplore'
      router.push(`/chat/${id}?sig=${encodeURIComponent(sig)}&mode=${agent}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleThreadClick = (threadId: string) => {
    setSidebarOpen(false)
    router.push(`/chat/${threadId}`)
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-card border-r border-border transform transition-transform duration-300 ease-in-out z-50 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="font-mono font-bold text-lg">Alex</div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="text-foreground hover:bg-accent/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Chat History */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm mb-4">
              <MessageSquare className="h-4 w-4" />
              <span>Chat History</span>
            </div>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {chatThreads.length === 0 ? (
                <div className="text-muted-foreground/60 font-mono text-sm p-2 hover:bg-accent/5 rounded cursor-pointer">
                  No chats yet
                </div>
              ) : (
                chatThreads.map((thread) => (
                  <div
                    key={thread.threadId}
                    onClick={() => handleThreadClick(thread.threadId)}
                    className="text-foreground/80 font-mono text-sm p-2 hover:bg-accent/10 rounded cursor-pointer transition-colors truncate"
                    title={thread.title}
                  >
                    {thread.title}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Settings */}
          <div>
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm mb-4">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </div>
            <div className="space-y-2">
              <div
                onClick={() => router.push('/settings')}
                className="text-foreground/80 font-mono text-sm p-2 hover:bg-accent/10 rounded cursor-pointer transition-colors"
              >
                Settings
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 dark:bg-black/50 light:bg-black/20 z-40" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <div className="min-h-screen flex flex-col">
        {/* Header with hamburger menu */}
        <div className="p-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-foreground hover:bg-accent/10"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
          <div className="w-full max-w-3xl">
            <h1 className="font-mono font-bold text-2xl md:text-3xl text-foreground text-center mb-2">Hi, {firstName}</h1>
            <p className="font-mono text-foreground text-center mb-8">What will you learn today?</p>

            {/* Chat input with mode toggle and attachments */}
            <div className="relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask me anything..."
                className="w-full bg-input border-none text-foreground placeholder:text-muted-foreground font-mono pl-28 pr-36 py-12 rounded-xl text-base md:text-lg min-h-[80px]"
              />
              {/* Left actions: attachments first, then mode toggle */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-foreground/80 hover:text-foreground bg-accent/10 hover:bg-accent/15 transition-colors rounded-full w-8 h-8 inline-flex items-center justify-center"
                  title="Attach file"
                >
                  +
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFiles(e.target.files ? Array.from(e.target.files) : [])} />

                <button
                  type="button"
                  onClick={() => setMode(prev => prev === 'learn' ? 'explore' : 'learn')}
                  className="inline-flex items-center gap-2 text-xs text-foreground/80 hover:text-foreground"
                  title={mode === 'learn' ? 'Switch to Explore Mode' : 'Switch to Learn Mode'}
                >
                  <span className={`inline-block w-10 h-5 rounded-full border border-foreground/20 relative transition-colors ${mode === 'learn' ? 'bg-foreground/20' : 'bg-accent'}`}>
                    <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-background transition-all ${mode === 'learn' ? 'left-0.5' : 'left-5'}`}></span>
                  </span>
                  <span className="sr-only">{mode === 'learn' ? 'Learn Mode' : 'Explore Mode'}</span>
                </button>
              </div>
              <Button
                onClick={handleSend}
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-accent hover:bg-accent/80 text-accent-foreground h-12 w-12"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
            {/* Small attachments summary */}
            {(selectedFiles.length > 0 || selectedImages.length > 0) && (
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground font-mono">
                {selectedFiles.length > 0 && <span>{selectedFiles.length} file(s) attached</span>}
                {selectedImages.length > 0 && <span>{selectedImages.length} image(s) attached</span>}
              </div>
            )}

            {/* Suggested learning component */}
            <SuggestedLearning onSuggestionClick={(suggestion) => setMessage(suggestion)} />
          </div>
        </div>

        {/* Streak counter and Date/Time - bottom right, above theme selector */}
        <div className="fixed bottom-24 right-6 flex flex-col items-end gap-3 z-40">
          <StreakCounter />
          <div className="text-right font-mono text-sm text-muted-foreground">
            <div>{formatDate(currentTime)}</div>
            <div>{formatTime(currentTime)}</div>
          </div>
        </div>
        
        <ThemeSelector />
      </div>
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card text-foreground px-6 py-4 rounded-md border border-border font-mono text-sm flex items-center gap-3">
            <span className="inline-flex gap-1">
              <span className="size-2 rounded-full bg-foreground/70 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="size-2 rounded-full bg-foreground/70 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="size-2 rounded-full bg-foreground/70 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            Preparing your chat…
          </div>
        </div>
      )}
    </div>
  )
}
