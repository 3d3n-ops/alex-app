"use client"

import { useState, useEffect } from "react"
import { Flame } from "lucide-react"
import { getStreak, updateStreak } from "@/lib/streak"

export default function StreakCounter() {
  const [streak, setStreak] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStreak()
  }, [])

  const loadStreak = async () => {
    try {
      // Update streak when component loads (user is active)
      const streakData = await updateStreak()
      setStreak(streakData.currentStreak)
    } catch (error) {
      console.error('Failed to load streak:', error)
      // Try to get existing streak
      const existingStreak = await getStreak()
      if (existingStreak) {
        setStreak(existingStreak.currentStreak)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return null
  }

  return (
    <div className="flex items-center gap-2 text-white/80 font-mono text-sm">
      <Flame className="h-5 w-5 text-orange-500" fill="currentColor" />
      <span>{streak} day{streak !== 1 ? 's' : ''} streak</span>
    </div>
  )
}

