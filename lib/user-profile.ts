/**
 * User profile utilities
 * Fetches user profile data for use in agents and components
 */

export interface UserProfile {
  programmingLevel?: 'beginner' | 'intermediate' | 'advanced'
  languages: string[]
  onboardingCompleted: boolean
  createdAt?: number
  updatedAt?: number
}

/**
 * Get user profile from API (server-side)
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/user/profile`, {
      cache: 'no-store'
    })
    
    if (!res.ok) {
      return null
    }
    
    return await res.json()
  } catch (error) {
    console.error('Error fetching user profile:', error)
    return null
  }
}

/**
 * Format user profile as context string for agent
 */
export function formatUserProfileAsContext(profile: UserProfile | null): string {
  if (!profile) {
    return ''
  }

  const parts: string[] = []
  
  if (profile.programmingLevel) {
    parts.push(`Programming Level: ${profile.programmingLevel.charAt(0).toUpperCase() + profile.programmingLevel.slice(1)}`)
  }
  
  if (profile.languages && profile.languages.length > 0) {
    parts.push(`Known Languages: ${profile.languages.join(', ')}`)
  }

  if (parts.length === 0) {
    return ''
  }

  return `\n\nStudent Profile:\n${parts.join('\n')}\n`
}

