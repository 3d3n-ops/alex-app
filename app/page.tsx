"use client"

import { Button } from "@/components/ui/button"
import { useSignIn, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { ThemeSelector } from "@/components/theme-selector"
import { AlexLogo } from "@/components/alex-logo"

export default function Home() {
  const { signIn } = useSignIn()
  const { user, isLoaded } = useUser()
  const router = useRouter()

  // Redirect if already signed in
  useEffect(() => {
    if (isLoaded && user) {
      const onboardingCompleted = Boolean(user.publicMetadata?.onboardingCompleted)
      if (onboardingCompleted) {
        router.push('/dashboard')
      } else {
        router.push('/onboarding/level')
      }
    }
  }, [isLoaded, user, router])

  const handleStartBuilding = async () => {
    try {
      // Open Clerk sign-in modal - will redirect based on onboarding status after auth
      await signIn?.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/dashboard",
        redirectUrlComplete: "/dashboard",
      })
    } catch (error) {
      // If OAuth fails, redirect to sign-in page
      router.push("/sign-in")
    }
  }

  // Show loading state while checking auth
  if (!isLoaded) {
    return null
  }

  // If user is signed in, we'll redirect in useEffect, so return null
  if (user) {
    return null
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="px-6 py-6 md:px-12">
        <div className="flex items-center gap-3">
          <AlexLogo height={32} width={32} className="shrink-0" />
          <div className="font-mono font-bold text-lg">Alex</div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-16 md:px-12 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-mono font-bold text-4xl md:text-5xl lg:text-6xl leading-tight mb-6">
            The AI Programming Tutor
          </h1>

          <p className="text-foreground/70 text-sm md:text-base mb-8 max-w-2xl mx-auto leading-relaxed">
            Built for the next generation of builders with AI, made for students and professionals
          </p>

          <Button
            onClick={handleStartBuilding}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold px-6 py-2 rounded-md mb-12 border border-border"
          >
            Start building
          </Button>

          {/* Demo Video */}
          <div className="mx-auto max-w-3xl">
            <video
              className="rounded-2xl aspect-video w-full object-cover shadow-2xl"
              autoPlay
              loop
              muted
              playsInline
              controls
            >
              <source src="/alex-demo.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>
      <ThemeSelector />
    </main>
  )
}
