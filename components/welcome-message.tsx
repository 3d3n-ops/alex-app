"use client"

import { useEffect, useState } from "react"

interface WelcomeMessageProps {
  firstName: string
}

export default function WelcomeMessage({ firstName }: WelcomeMessageProps) {
  const [message, setMessage] = useState("")

  useEffect(() => {
    const getTimeOfDay = () => {
      const hour = new Date().getHours()
      if (hour >= 5 && hour < 12) return "morning"
      if (hour >= 12 && hour < 17) return "afternoon"
      if (hour >= 17 && hour < 22) return "evening"
      return "late-night"
    }

    const isReturnVisit = () => {
      const lastVisit = localStorage.getItem("lastVisitDate")
      const today = new Date().toDateString()
      
      if (!lastVisit) {
        // First visit - store today's date
        localStorage.setItem("lastVisitDate", today)
        return false
      }
      
      if (lastVisit !== today) {
        // Return visit - update date
        localStorage.setItem("lastVisitDate", today)
        return true
      }
      
      // Same day visit - not a return visit
      return false
    }

    const getWelcomeMessage = () => {
      const timeOfDay = getTimeOfDay()
      const isReturn = isReturnVisit()

      if (!isReturn) {
        // First visit or same day
        const timeMessages = {
          morning: `Good morning, ${firstName}!`,
          afternoon: `Good afternoon, ${firstName}!`,
          evening: `Good evening, ${firstName}!`,
          "late-night": `Good evening, ${firstName}!`,
        }
        return timeMessages[timeOfDay]
      }

      // Return visit messages
      const returnMessages = [
        `Welcome back, ${firstName}!`,
        `You're back, ${firstName}!`,
        `Happy to see you again, ${firstName}!`,
      ]

      const timeBasedReturnMessages = {
        morning: [
          `Welcome back, ${firstName}!`,
          `Good morning again, ${firstName}!`,
          `Happy to see you this morning, ${firstName}!`,
        ],
        afternoon: [
          `Welcome back, ${firstName}!`,
          `You're back, ${firstName}!`,
          `Happy to see you again this afternoon, ${firstName}!`,
        ],
        evening: [
          `Welcome back, ${firstName}!`,
          `You're back, ${firstName}!`,
          `Happy to see you again this evening, ${firstName}!`,
        ],
        "late-night": [
          `Welcome back, ${firstName}!`,
          `You're back, ${firstName}!`,
          `Happy to see you again, ${firstName}!`,
        ],
      }

      const messages = timeBasedReturnMessages[timeOfDay]
      // Randomly select a message for variety
      return messages[Math.floor(Math.random() * messages.length)]
    }

    setMessage(getWelcomeMessage())
  }, [firstName])

  if (!message) {
    return (
      <h1 className="font-mono font-bold text-2xl md:text-3xl text-foreground text-center mb-2">
        Hi, {firstName}
      </h1>
    )
  }

  return (
    <h1 className="font-mono font-bold text-2xl md:text-3xl text-foreground text-center mb-2">
      {message}
    </h1>
  )
}

