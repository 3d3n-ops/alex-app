"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

export default function OnboardingLevelPage() {
  const router = useRouter()
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)

  // Check if already completed onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok) {
          const profile = await res.json()
          if (profile.onboardingCompleted) {
            router.push('/dashboard')
          }
        }
      } catch (error) {
        // Ignore errors, just proceed with onboarding
      }
    }
    checkOnboarding()
  }, [router])

  const handleLevelSelect = async (level: string) => {
    setSelectedLevel(level)
    // Store temporarily in localStorage for next step
    localStorage.setItem("programmingLevel", level)
    // Navigate to next onboarding step
    setTimeout(() => {
      router.push("/onboarding/languages")
    }, 300)
  }

  return (
    <div className="min-h-screen bg-[#161210] flex">
      {/* Left side - Question */}
      <div className="w-full md:w-1/2 flex flex-col p-6 md:p-12">
        {/* Header */}
        <div className="font-mono font-bold text-lg text-white mb-16">Alex</div>

        {/* Question */}
        <div className="flex-1 flex flex-col justify-center max-w-md">
          <h1 className="font-mono font-bold text-2xl md:text-3xl text-white mb-8 leading-tight">
            What level of programming are you at?
          </h1>

          <div className="space-y-4">
            <Button
              onClick={() => handleLevelSelect("beginner")}
              className="w-full bg-[#C9B59A] hover:bg-[#B8A589] text-[#161210] font-mono font-bold text-left px-6 py-6 rounded-lg text-base justify-start"
            >
              A. Beginner
            </Button>

            <Button
              onClick={() => handleLevelSelect("intermediate")}
              className="w-full bg-[#C9B59A] hover:bg-[#B8A589] text-[#161210] font-mono font-bold text-left px-6 py-6 rounded-lg text-base justify-start"
            >
              B. Intermediate
            </Button>

            <Button
              onClick={() => handleLevelSelect("advanced")}
              className="w-full bg-[#C9B59A] hover:bg-[#B8A589] text-[#161210] font-mono font-bold text-left px-6 py-6 rounded-lg text-base justify-start"
            >
              C. Advanced
            </Button>
          </div>
        </div>
      </div>

      {/* Right side - Beige area */}
      <div className="hidden md:block w-1/2 bg-[#C9B59A]" />
    </div>
  )
}
