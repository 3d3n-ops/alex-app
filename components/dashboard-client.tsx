"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Menu, Send, MessageSquare, Settings, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { chatDb } from "@/lib/chat-db"

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
      await chatDb.messages.add({ threadId: id, role: 'user', content: message.trim(), createdAt: Date.now() })

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

  return (
    <div className="min-h-screen bg-[#161210] text-white relative">
      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-64 bg-[#1E1A18] transform transition-transform duration-300 ease-in-out z-50 ${
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
              className="text-white hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Chat History */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-white/60 font-mono text-sm mb-4">
              <MessageSquare className="h-4 w-4" />
              <span>Chat History</span>
            </div>
            <div className="space-y-2">
              <div className="text-white/40 font-mono text-sm p-2 hover:bg-white/5 rounded cursor-pointer">
                No chats yet
              </div>
            </div>
          </div>

          {/* Settings */}
          <div>
            <div className="flex items-center gap-2 text-white/60 font-mono text-sm mb-4">
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </div>
            <div className="space-y-2">
              <div className="text-white/40 font-mono text-sm p-2 hover:bg-white/5 rounded cursor-pointer">Profile</div>
              <div className="text-white/40 font-mono text-sm p-2 hover:bg-white/5 rounded cursor-pointer">
                Preferences
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <div className="min-h-screen flex flex-col">
        {/* Header with hamburger menu */}
        <div className="p-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="text-white hover:bg-white/10"
          >
            <Menu className="h-6 w-6" />
          </Button>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
          <div className="w-full max-w-3xl">
            <h1 className="font-mono font-bold text-2xl md:text-3xl text-white text-center mb-2">Hi, {firstName}</h1>
            <p className="font-mono text-white text-center mb-8">What will you learn today?</p>

            {/* Chat input with mode toggle and attachments */}
            <div className="relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask me anything..."
                className="w-full bg-[#2A2622] border-none text-white placeholder:text-white/40 font-mono pl-28 pr-36 py-12 rounded-xl text-base md:text-lg min-h-[80px]"
              />
              {/* Left actions: attachments first, then mode toggle */}
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-white/80 hover:text-white bg-white/10 hover:bg-white/15 transition-colors rounded-full w-8 h-8 inline-flex items-center justify-center"
                  title="Attach file"
                >
                  +
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFiles(e.target.files ? Array.from(e.target.files) : [])} />

                <button
                  type="button"
                  onClick={() => setMode(prev => prev === 'learn' ? 'explore' : 'learn')}
                  className="inline-flex items-center gap-2 text-xs text-white/80 hover:text-white"
                  title={mode === 'learn' ? 'Switch to Explore Mode' : 'Switch to Learn Mode'}
                >
                  <span className={`inline-block w-10 h-5 rounded-full border border-white/20 relative transition-colors ${mode === 'learn' ? 'bg-white/20' : 'bg-[#C9B59A]'}`}>
                    <span className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#161210] transition-all ${mode === 'learn' ? 'left-0.5' : 'left-5'}`}></span>
                  </span>
                  <span className="sr-only">{mode === 'learn' ? 'Learn Mode' : 'Explore Mode'}</span>
                </button>
              </div>
              <Button
                onClick={handleSend}
                size="icon"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#C9B59A] hover:bg-[#B8A589] text-[#161210] h-12 w-12"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
            {/* Small attachments summary */}
            {(selectedFiles.length > 0 || selectedImages.length > 0) && (
              <div className="mt-2 flex items-center gap-3 text-xs text-white/70 font-mono">
                {selectedFiles.length > 0 && <span>{selectedFiles.length} file(s) attached</span>}
                {selectedImages.length > 0 && <span>{selectedImages.length} image(s) attached</span>}
              </div>
            )}
          </div>
        </div>

        {/* Date and time - bottom right */}
        <div className="fixed bottom-6 right-6 text-right font-mono text-sm text-white/60">
          <div>{formatDate(currentTime)}</div>
          <div>{formatTime(currentTime)}</div>
        </div>
      </div>
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-[#1E1A18] text-white px-6 py-4 rounded-md border border-white/10 font-mono text-sm flex items-center gap-3">
            <span className="inline-flex gap-1">
              <span className="size-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="size-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="size-2 rounded-full bg-white/70 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            Preparing your chat…
          </div>
        </div>
      )}
    </div>
  )
}
