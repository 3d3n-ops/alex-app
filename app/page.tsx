"use client"

import { Button } from "@/components/ui/button"
import { useSignIn } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

export default function Home() {
  const { signIn } = useSignIn()
  const router = useRouter()

  const handleStartBuilding = async () => {
    try {
      // Open Clerk sign-in modal
      await signIn?.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/onboarding/level",
        redirectUrlComplete: "/onboarding/level",
      })
    } catch (error) {
      // If OAuth fails, redirect to sign-in page
      router.push("/sign-in")
    }
  }

  return (
    <main className="min-h-screen bg-[#161210] text-white">
      {/* Header */}
      <header className="px-6 py-6 md:px-12">
        <div className="font-mono font-bold text-lg">Alex</div>
      </header>

      {/* Hero Section */}
      <section className="px-6 py-16 md:px-12 md:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-mono font-bold text-4xl md:text-5xl lg:text-6xl leading-tight mb-6">
            The AI Programming Tutor
          </h1>

          <p className="text-white/70 text-sm md:text-base mb-8 max-w-2xl mx-auto leading-relaxed">
            Built for the next generation of builders with AI, made for students and professionals
          </p>

          <Button
            onClick={handleStartBuilding}
            className="bg-white text-[#161210] hover:bg-white/90 font-mono font-bold px-6 py-2 rounded-md mb-12"
          >
            Start building
          </Button>

          {/* Placeholder Demo Area */}
          <div className="mx-auto max-w-3xl">
            <div className="bg-[#C9B59A] rounded-2xl aspect-video w-full" />
          </div>
        </div>
      </section>
    </main>
  )
}
