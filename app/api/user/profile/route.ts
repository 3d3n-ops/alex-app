import { auth, currentUser } from '@clerk/nextjs/server'
import { clerkClient } from '@clerk/nextjs/server'

export const runtime = 'nodejs'

export interface UserProfile {
  programmingLevel?: 'beginner' | 'intermediate' | 'advanced'
  languages: string[]
  onboardingCompleted: boolean
  createdAt?: number
  updatedAt?: number
}

/**
 * Get user profile
 */
export async function GET() {
  const { userId } = await auth()
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const user = await currentUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Get profile from Clerk public metadata
    const profile: UserProfile = {
      programmingLevel: user.publicMetadata?.programmingLevel as any,
      languages: Array.isArray(user.publicMetadata?.languages) 
        ? user.publicMetadata.languages as string[]
        : [],
      onboardingCompleted: Boolean(user.publicMetadata?.onboardingCompleted),
      createdAt: user.publicMetadata?.createdAt as number,
      updatedAt: user.publicMetadata?.updatedAt as number,
    }

    return new Response(JSON.stringify(profile), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Error fetching user profile:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

/**
 * Update user profile
 */
export async function PUT(req: Request) {
  const { userId } = await auth()
  
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const updates: Partial<UserProfile> = {}

    if (body.programmingLevel !== undefined) {
      updates.programmingLevel = body.programmingLevel
    }
    if (body.languages !== undefined) {
      updates.languages = Array.isArray(body.languages) ? body.languages : []
    }
    if (body.onboardingCompleted !== undefined) {
      updates.onboardingCompleted = Boolean(body.onboardingCompleted)
    }

    // Get current user to merge with existing metadata
    const user = await currentUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Merge updates with existing metadata
    const client = await clerkClient()
    const existingMetadata = user.publicMetadata || {}
    const newMetadata = {
      ...existingMetadata,
      ...updates,
      updatedAt: Date.now(),
    }

    // If this is first update, set createdAt
    if (!existingMetadata.createdAt) {
      newMetadata.createdAt = Date.now()
    }

    await client.users.updateUserMetadata(userId, {
      publicMetadata: newMetadata
    })

    return new Response(JSON.stringify({ success: true, profile: newMetadata }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('Error updating user profile:', error)
    return new Response(JSON.stringify({ error: 'Failed to update profile' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

