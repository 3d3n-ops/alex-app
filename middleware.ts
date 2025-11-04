import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/api/chat(.*)"])
const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"])

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth()
  const url = request.nextUrl.clone()

  // Protect all routes except public ones
  if (!isPublicRoute(request)) {
    await auth.protect()
  }

  // Handle redirects for authenticated users
  if (userId) {
    // Get user metadata to check onboarding status
    // Note: We can't easily access user metadata in middleware, so we'll handle this in page components
    // But we can handle the basic routing here
    
    // If user is trying to access onboarding but already completed it, redirect to dashboard
    if (isOnboardingRoute(request)) {
      // We'll let the onboarding pages check and redirect if needed
      // This is because we can't easily access user metadata in middleware
    }
    
    // If user is trying to access sign-in/sign-up while authenticated, redirect to dashboard
    if (url.pathname === '/sign-in' || url.pathname === '/sign-up') {
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } else {
    // Not authenticated - if trying to access protected routes (except onboarding), redirect to sign-in
    // Onboarding routes are handled by the pages themselves
    if (!isPublicRoute(request) && !isOnboardingRoute(request)) {
      url.pathname = '/sign-in'
      return NextResponse.redirect(url)
    }
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
