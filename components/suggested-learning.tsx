"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { chatDb } from "@/lib/chat-db"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Info } from "lucide-react"

interface Suggestion {
  title: string
  prompt: string
}

interface SuggestedLearningProps {
  onSuggestionClick: (suggestion: string) => void
}

const GENERAL_SUGGESTIONS: Suggestion[] = [
  {
    title: "Learn to code in Python",
    prompt: "Learn to code in Python: Teach me Python programming from the ground up. Walk me through fundamental concepts like variables, data types, control flow, functions, and object-oriented programming. Include practical examples and exercises."
  },
  {
    title: "Making REST APIs",
    prompt: "Making REST APIs: Guide me through building REST APIs. Explain HTTP methods, request/response formats, status codes, authentication, and best practices. Show me how to create endpoints and handle different types of requests."
  },
  {
    title: "Website building: HTML, CSS & Javascript",
    prompt: "Website building: HTML, CSS & Javascript: Instruct me on the basics of website building with HTML & CSS & Javascript. Walk me through key concepts like css design, how the dom works, and the basics of javascript for web development"
  }
]

export default function SuggestedLearning({ onSuggestionClick }: SuggestedLearningProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(GENERAL_SUGGESTIONS)
  const [isLoading, setIsLoading] = useState(false)
  const lastThreadCountRef = useRef<number>(0)
  const lastThreadUpdateRef = useRef<number>(0)

  const loadSuggestions = useCallback(async () => {
    // Check if user has any chat history
    const threads = await chatDb.threads.orderBy('updatedAt').reverse().limit(10).toArray()
    
    // Check if there's a new thread (thread count increased or new thread with later timestamp)
    const currentThreadCount = threads.length
    const latestThreadUpdate = threads.length > 0 ? threads[0].updatedAt : 0
    
    // Only reload if this is the first load or if there's actually a new thread
    const isFirstLoad = lastThreadCountRef.current === 0
    const hasNewThread = currentThreadCount > lastThreadCountRef.current || 
                         (currentThreadCount > 0 && latestThreadUpdate > lastThreadUpdateRef.current)
    
    if (!isFirstLoad && !hasNewThread) {
      // No new threads, keep existing suggestions
      return
    }
    
    // Update refs
    lastThreadCountRef.current = currentThreadCount
    lastThreadUpdateRef.current = latestThreadUpdate
    
    if (threads.length === 0) {
      // No chat history, use general suggestions
      setSuggestions(GENERAL_SUGGESTIONS)
      return
    }

    // Get recent messages from recent threads
    const recentMessages: string[] = []
    for (const thread of threads.slice(0, 3)) {
      const messages = await chatDb.messages
        .where('threadId')
        .equals(thread.threadId)
        .filter(m => m.role === 'user')
        .sortBy('createdAt')
      
      recentMessages.push(...messages.slice(-2).map(m => m.content))
    }

    if (recentMessages.length === 0) {
      // No messages, use general suggestions
      setSuggestions(GENERAL_SUGGESTIONS)
      return
    }

    // Fetch AI-generated suggestions based on chat history
    setIsLoading(true)
    try {
      const response = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recentMessages })
      })

      if (response.ok) {
        const data = await response.json()
        if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
          // Validate that suggestions have the correct format
          const validSuggestions = data.suggestions
            .filter((s: any) => s && typeof s === 'object' && s.title && s.prompt)
            .map((s: any) => ({
              title: String(s.title).trim(),
              prompt: String(s.prompt).trim()
            }))
            .filter((s: Suggestion) => s.title.length > 0 && s.prompt.length > 0)
          
          if (validSuggestions.length > 0) {
            setSuggestions(validSuggestions.slice(0, 3))
          } else {
            setSuggestions(GENERAL_SUGGESTIONS)
          }
        } else {
          setSuggestions(GENERAL_SUGGESTIONS)
        }
      } else {
        setSuggestions(GENERAL_SUGGESTIONS)
      }
    } catch (error) {
      console.error('Failed to load AI suggestions:', error)
      setSuggestions(GENERAL_SUGGESTIONS)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // Load suggestions on mount
    loadSuggestions()
    
    // Poll for new threads (check every 2 seconds when dashboard is visible)
    const intervalId = setInterval(() => {
      loadSuggestions()
    }, 2000)
    
    return () => clearInterval(intervalId)
  }, [loadSuggestions])

  return (
    <div className="w-full max-w-3xl mt-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-mono text-white text-left text-sm md:text-base">
          Suggested learning
        </h2>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center justify-center text-white/60 hover:text-white/80 transition-colors cursor-help focus:outline-none focus:ring-2 focus:ring-white/20 rounded"
              aria-label="Learn more about suggested learning"
            >
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={8}
            className="bg-[#2A2622] text-white border border-white/20 max-w-xs font-mono"
          >
            These suggestions are personalized based on what you&apos;ve been learning. 
            They help you dive deeper into topics and explore related concepts for thorough understanding.
          </TooltipContent>
        </Tooltip>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="font-mono text-white text-sm md:text-base animate-pulse"
            >
              <div className="h-5 bg-white/10 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick(suggestion.prompt)}
              className="block w-full text-left font-mono text-white text-sm md:text-base hover:text-white/80 transition-colors cursor-pointer"
            >
              {suggestion.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

