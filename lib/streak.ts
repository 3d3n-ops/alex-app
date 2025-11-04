import { chatDb, type StreakRow } from './chat-db'

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
function getYesterdayDate(): string {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return yesterday.toISOString().split('T')[0]
}

/**
 * Check if two dates are consecutive days
 */
function isConsecutiveDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2.getTime() - d1.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays === 1
}

/**
 * Update streak when user is active
 */
export async function updateStreak(): Promise<StreakRow> {
  const today = getTodayDate()
  const now = Date.now()
  
  // Get existing streak data
  let streak = await chatDb.streak.orderBy('updatedAt').reverse().first()
  
  if (!streak) {
    // Initialize streak data - first day counts as day 1
    streak = {
      date: today,
      lastActiveDate: now,
      currentStreak: 1,
      longestStreak: 1,
      createdAt: now,
      updatedAt: now
    }
    const id = await chatDb.streak.add(streak)
    return { ...streak, id }
  }
  
  const lastActiveDate = new Date(streak.lastActiveDate)
  const lastActiveDateStr = lastActiveDate.toISOString().split('T')[0]
  const todayDate = new Date(today)
  
  // Check if user was active today
  if (lastActiveDateStr === today) {
    // Already active today, no update needed
    return streak
  }
  
  // Check if user was active yesterday
  const yesterday = getYesterdayDate()
  if (lastActiveDateStr === yesterday) {
    // Consecutive day - increment streak
    const newStreak = streak.currentStreak + 1
    const updatedStreak: Partial<StreakRow> = {
      date: today,
      lastActiveDate: now,
      currentStreak: newStreak,
      longestStreak: Math.max(streak.longestStreak, newStreak),
      updatedAt: now
    }
    await chatDb.streak.update(streak.id!, updatedStreak)
    return { ...streak, ...updatedStreak } as StreakRow
  } else {
    // Streak broken - reset to 1
    const updatedStreak: Partial<StreakRow> = {
      date: today,
      lastActiveDate: now,
      currentStreak: 1,
      updatedAt: now
    }
    await chatDb.streak.update(streak.id!, updatedStreak)
    return { ...streak, ...updatedStreak } as StreakRow
  }
}

/**
 * Get current streak data
 */
export async function getStreak(): Promise<StreakRow | null> {
  const streak = await chatDb.streak.orderBy('updatedAt').reverse().first()
  return streak || null
}

