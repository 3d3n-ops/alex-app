"use client"

import { useEffect, useRef } from 'react'
import { getStreak } from '@/lib/streak'

type NotificationPermissionState = 'default' | 'granted' | 'denied'

interface NotificationSettings {
  enabled: boolean
  time: string // Format: "HH:MM" (e.g., "09:00")
}

/**
 * Hook for managing daily notifications with user-configurable settings
 */
export function useNotifications(settings?: NotificationSettings) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const scheduledRef = useRef<boolean>(false)
  const hourlyCheckRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Default settings if not provided
    const notificationSettings: NotificationSettings = settings || {
      enabled: true,
      time: '09:00'
    }

    // Only proceed if notifications are enabled
    if (!notificationSettings.enabled) {
      // Clean up any existing schedules
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
      if (hourlyCheckRef.current) {
        clearInterval(hourlyCheckRef.current)
        hourlyCheckRef.current = null
      }
      scheduledRef.current = false
      return
    }

    // Request notification permission only if enabled and permission is default
    if ('Notification' in window && Notification.permission === 'default') {
      // Show a custom message before requesting permission
      const shouldRequest = window.confirm(
        'Alex would like to send you daily learning reminders to help you maintain your streak. ' +
        'These notifications will remind you to continue learning at your preferred time. ' +
        'Would you like to enable notifications?'
      )
      
      if (shouldRequest) {
        Notification.requestPermission().catch(console.error)
      }
    }

    const scheduleNotification = async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') {
        return
      }

      // Don't schedule if already scheduled
      if (scheduledRef.current) {
        return
      }

      // Parse notification time (format: "HH:MM")
      const [hours, minutes] = notificationSettings.time.split(':').map(Number)
      
      // Calculate time until next notification time
      const now = new Date()
      const nextNotification = new Date()
      nextNotification.setHours(hours, minutes, 0, 0)
      
      // If it's already past the notification time today, schedule for tomorrow
      if (now >= nextNotification) {
        nextNotification.setDate(nextNotification.getDate() + 1)
      }

      const msUntilNotification = nextNotification.getTime() - now.getTime()

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
      }, msUntilNotification)

      scheduledRef.current = true
      intervalRef.current = timeoutId
    }

    // Schedule initial notification
    scheduleNotification()

    // Also check every hour to reschedule if needed (for reliability)
    hourlyCheckRef.current = setInterval(() => {
      if (!scheduledRef.current && notificationSettings.enabled) {
        scheduleNotification()
      }
    }, 60 * 60 * 1000) // Every hour

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current)
        intervalRef.current = null
      }
      if (hourlyCheckRef.current) {
        clearInterval(hourlyCheckRef.current)
        hourlyCheckRef.current = null
      }
      scheduledRef.current = false
    }
  }, [settings?.enabled, settings?.time])

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

