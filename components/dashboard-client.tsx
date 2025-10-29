"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Menu, Send, MessageSquare, Settings, X } from "lucide-react"

interface DashboardClientProps {
  firstName: string
}

export default function DashboardClient({ firstName }: DashboardClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())

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

  const handleSend = () => {
    if (message.trim()) {
      console.log("[v0] Sending message:", message)
      // Handle message sending logic here
      setMessage("")
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
          <div className="w-full max-w-2xl">
            <h1 className="font-mono font-bold text-2xl md:text-3xl text-white text-center mb-2">Hi, {firstName}</h1>
            <p className="font-mono text-white text-center mb-8">What will you learn today?</p>

            {/* Chat input */}
            <div className="relative">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask me anything..."
                className="w-full bg-[#2A2622] border-none text-white placeholder:text-white/40 font-mono px-6 py-6 pr-14 rounded-lg"
              />
              <Button
                onClick={handleSend}
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#C9B59A] hover:bg-[#B8A589] text-[#161210]"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Date and time - bottom right */}
        <div className="fixed bottom-6 right-6 text-right font-mono text-sm text-white/60">
          <div>{formatDate(currentTime)}</div>
          <div>{formatTime(currentTime)}</div>
        </div>
      </div>
    </div>
  )
}
