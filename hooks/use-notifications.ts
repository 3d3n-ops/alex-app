"use client"

import { useEffect, useRef } from 'react'
import { getStreak } from '@/lib/streak'

type NotificationPermissionState = 'default' | 'granted' | 'denied'


/**
 * Hook for managing daily notifications at 9AM
 */
export function useNotifications() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const scheduledRef = useRef<boolean>(false)

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error)
    }

    const scheduleNotification = async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        return
      }

      // Don't schedule if already scheduled
      if (scheduledRef.current) {
        return
      }

      // Calculate time until next 9AM
      const now = new Date()
      const next9AM = new Date()
      next9AM.setHours(9, 0, 0, 0)
      
      // If it's already past 9AM today, schedule for tomorrow
      if (now >= next9AM) {
        next9AM.setDate(next9AM.getDate() + 1)
      }

      const msUntil9AM = next9AM.getTime() - now.getTime()

      // Schedule the notification
      const timeoutId = setTimeout(async () => {
        try {
          // Get current streak
          const streakData = await getStreak()
          const streakDays = streakData?.currentStreak || 0
          const lastActiveDate = streakData?.lastActiveDate || null

          // Generate AI notification
          const response = await fetch('/api/notifications/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              streakDays,
              lastActiveDate
            })
          })

          if (response.ok) {
            const data = await response.json()
            const notificationText = data.notification || 'Time to continue learning!'

            // Show notification
            new Notification('Alex Learning', {
              body: notificationText,
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              tag: 'daily-reminder',
              requireInteraction: false
            })
          }

          // Schedule next notification
          scheduledRef.current = false
          scheduleNotification()
        } catch (error) {
          console.error('Error showing notification:', error)
          // Retry scheduling
          scheduledRef.current = false
          scheduleNotification()
        }
      }, msUntil9AM)

      scheduledRef.current = true
      intervalRef.current = timeoutId
    }

    // Schedule initial notification
    scheduleNotification()

    // Also check every hour to reschedule if needed (for reliability)
    const hourlyCheck = setInterval(() => {
      if (!scheduledRef.current) {
        scheduleNotification()
      }
    }, 60 * 60 * 1000) // Every hour

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
      }
      clearInterval(hourlyCheck)
      scheduledRef.current = false
    }
  }, [])

  return {
    requestPermission: async (): Promise<NotificationPermissionState> => {
      if ('Notification' in window) {
        return (await Notification.requestPermission()) as NotificationPermissionState
      }
      return 'denied'
    },
    permission: (typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied') as NotificationPermissionState
  }
}

