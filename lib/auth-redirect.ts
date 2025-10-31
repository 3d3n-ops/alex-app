import { auth, currentUser } from '@clerk/nextjs/server'

/**
 * Get the appropriate redirect URL based on auth and onboarding status
 */
export async function getAuthRedirect(): Promise<string> {
  const { userId } = await auth()

  // Not signed in -> sign in page
  if (!userId) {
    return '/sign-in'
  }

  // Signed in -> check onboarding status
  const user = await currentUser()
  if (!user) {
    return '/sign-in'
  }

  const onboardingCompleted = Boolean(user.publicMetadata?.onboardingCompleted)

  // Not completed onboarding -> onboarding
  if (!onboardingCompleted) {
    return '/onboarding/level'
  }

  // Completed onboarding -> dashboard
  return '/dashboard'
}

